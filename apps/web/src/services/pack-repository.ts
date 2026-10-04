// LocalPackRepository: downloads the farm pack once into a named cache (`pack-<slug>-v<version>`),
// checks every file against the manifest's SHA-256, and then serves it with no network at all.
// The manifest is written last, so a download that stopped half way is never "current".

import { type FarmPackManifest, FarmPackManifestSchema } from "@asknoor/core";
import type { PackRepository } from "./types.ts";

// The files Transformers.js loads from the pack's model folder.
export const MODEL_FILES = [
  "config.json",
  "tokenizer.json",
  "tokenizer_config.json",
  "special_tokens_map.json",
  "onnx/model_quantized.onnx",
] as const;

const TYPES: Record<string, string> = {
  json: "application/json",
  vtt: "text/vtt",
  m4a: "audio/mp4",
  f32: "application/octet-stream",
  onnx: "application/octet-stream",
};

const typeOf = (path: string) => TYPES[path.split(".").pop() ?? ""] ?? "application/octet-stream";

async function sha256Hex(bytes: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export interface PackRepositoryOptions {
  /** Folder of the pack on the network, for example /packs/ondera-noor/demo (no trailing slash). */
  base: string;
  fetchFile?: typeof fetch;
  cacheStorage?: CacheStorage;
}

export class LocalPackRepository implements PackRepository {
  private readonly base: string;
  private readonly fetchFile: typeof fetch;
  private readonly storage: CacheStorage;
  private readonly urls = new Map<string, string>();

  constructor(options: PackRepositoryOptions) {
    this.base = options.base.replace(/\/$/, "");
    this.fetchFile = options.fetchFile ?? ((...args) => fetch(...args));
    this.storage = options.cacheStorage ?? caches;
  }

  baseUrl(): string {
    return this.base;
  }

  private url(path: string): string {
    return `${this.base}/${path}`;
  }

  private async match(path: string): Promise<Response | undefined> {
    return this.storage.match(this.url(path));
  }

  async current(): Promise<FarmPackManifest | null> {
    const res = await this.match("manifest.json");
    if (!res) return null;
    const parsed = FarmPackManifestSchema.safeParse(await res.json());
    return parsed.success ? (parsed.data as FarmPackManifest) : null;
  }

  private async fetchManifest(): Promise<FarmPackManifest> {
    const res = await this.fetchFile(this.url("manifest.json"), { cache: "no-store" });
    if (!res.ok) throw new Error(`manifest download failed (${res.status})`);
    return FarmPackManifestSchema.parse(await res.json()) as FarmPackManifest;
  }

  /** Every file the phone needs: what the manifest lists, plus the model files the manifest only names by folder. */
  private filesOf(manifest: FarmPackManifest): { path: string; size: number }[] {
    const files = Object.entries(manifest.sizes).map(([path, size]) => ({ path, size }));
    const have = new Set(files.map((f) => f.path));
    const modelFiles = MODEL_FILES.map((f) => `${manifest.model.dir}/${f}`).filter(
      (p) => !have.has(p),
    );
    if (modelFiles.length > 0) {
      // The sizes of unlisted model files are unknown; share the model's total across them.
      const each = Math.round(manifest.model.sizeBytes / modelFiles.length);
      for (const path of modelFiles) files.push({ path, size: each });
    }
    return files;
  }

  async size(): Promise<number> {
    return this.filesOf(await this.fetchManifest()).reduce((n, f) => n + f.size, 0);
  }

  async download(onProgress: (fraction: number) => void): Promise<FarmPackManifest> {
    const manifest = await this.fetchManifest();
    const name = `pack-${manifest.farmSlug}-v${manifest.version}`;
    const cache = await this.storage.open(name);
    const files = this.filesOf(manifest);
    const total = files.reduce((n, f) => n + f.size, 0) || 1;
    let done = 0;
    for (const { path, size } of files) {
      const res = await this.fetchFile(this.url(path));
      if (!res.ok) throw new Error(`download failed (${res.status}): ${path}`);
      const bytes = await res.arrayBuffer();
      const expected = manifest.checksums[path];
      if (expected && (await sha256Hex(bytes)) !== expected) {
        throw new Error(`${path}: the download does not match the manifest checksum`);
      }
      await cache.put(
        this.url(path),
        new Response(bytes, { headers: { "Content-Type": typeOf(path) } }),
      );
      done += size;
      onProgress(Math.min(1, done / total));
    }
    await cache.put(
      this.url("manifest.json"),
      new Response(JSON.stringify(manifest), { headers: { "Content-Type": "application/json" } }),
    );
    // Drop older versions of this farm's pack.
    for (const key of await this.storage.keys()) {
      if (key.startsWith(`pack-${manifest.farmSlug}-v`) && key !== name) {
        await this.storage.delete(key);
      }
    }
    onProgress(1);
    // Ask the browser to keep the pack (iOS may clear site data after a while).
    await navigator.storage?.persist?.().catch(() => false);
    return manifest;
  }

  async text(path: string): Promise<string | null> {
    const res = await this.match(path);
    return res ? res.text() : null;
  }

  async blobUrl(path: string): Promise<string | null> {
    const known = this.urls.get(path);
    if (known) return known;
    const res = await this.match(path);
    if (!res) return null;
    const url = URL.createObjectURL(await res.blob());
    this.urls.set(path, url);
    return url;
  }
}
