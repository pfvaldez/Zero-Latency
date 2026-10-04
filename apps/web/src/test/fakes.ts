// Test doubles: an in-memory CacheStorage, a fetch that serves the committed fixture pack from
// disk, and a FakeMatcher. Used only in tests.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { MatchResult, OutboxItem } from "@asknoor/core";
import { type FarmPackManifest, FarmPackManifestSchema } from "@asknoor/core";
import { LocalPackRepository } from "@/services/pack-repository.ts";
import type { Matcher, Outbox, Scanner, Services } from "@/services/types.ts";

export const FIXTURE_DIR = join(import.meta.dirname, "..", "..", "public", "packs", "fixture");
export const fixtureManifest = (): FarmPackManifest =>
  FarmPackManifestSchema.parse(
    JSON.parse(readFileSync(join(FIXTURE_DIR, "manifest.json"), "utf8")),
  ) as FarmPackManifest;

class MemoryCache {
  readonly entries = new Map<string, Response>();
  async put(url: string, res: Response) {
    this.entries.set(url, res);
  }
  async match(url: string) {
    return this.entries.get(url)?.clone();
  }
}

export class MemoryCacheStorage {
  readonly caches = new Map<string, MemoryCache>();
  async open(name: string) {
    const existing = this.caches.get(name);
    if (existing) return existing;
    const created = new MemoryCache();
    this.caches.set(name, created);
    return created;
  }
  async keys() {
    return [...this.caches.keys()];
  }
  async delete(name: string) {
    return this.caches.delete(name);
  }
  async match(url: string) {
    for (const c of this.caches.values()) {
      const r = await c.match(url);
      if (r) return r;
    }
    return undefined;
  }
}

/** Serves /packs/fixture/* from disk. Files the fixture does not commit (the model) are small stand-in bytes. */
export function fixtureFetch(log: string[] = [], tamper?: string): typeof fetch {
  return (async (input: RequestInfo | URL) => {
    const path = String(input).replace("/packs/fixture/", "");
    log.push(path);
    try {
      const bytes = readFileSync(join(FIXTURE_DIR, path));
      if (path === tamper) bytes[0] = (bytes[0] ?? 0) ^ 0xff;
      return new Response(bytes);
    } catch {
      if (path.startsWith("model/")) return new Response(new Uint8Array([1, 2, 3]));
      return new Response("not found", { status: 404 });
    }
  }) as typeof fetch;
}

export class MemoryOutbox implements Outbox {
  readonly items: OutboxItem[] = [];
  async add(item: OutboxItem) {
    this.items.push(item);
  }
  async pending() {
    return [...this.items];
  }
  async markSynced() {}
  async count() {
    return this.items.length;
  }
}

export class FakeMatcher implements Matcher {
  readonly queries: string[] = [];
  private readonly results: MatchResult[];
  constructor(results: MatchResult[] = []) {
    this.results = results;
  }
  async ready() {}
  async match(text: string) {
    this.queries.push(text);
    return this.results;
  }
}

export class FakeScanner implements Scanner {
  onCode: ((code: string) => void) | null = null;
  started = 0;
  stopped = 0;
  /** Set to make start() fail like a refused camera. */
  deny = false;
  async start(_video: HTMLVideoElement, onCode: (code: string) => void) {
    this.started++;
    if (this.deny) throw new Error("NotAllowedError");
    this.onCode = onCode;
  }
  stop() {
    this.stopped++;
    this.onCode = null;
  }
}

export function testServices(
  over: Partial<Services> = {},
): Services & { storage: MemoryCacheStorage } {
  const storage = new MemoryCacheStorage();
  return {
    storage,
    repo: new LocalPackRepository({
      base: "/packs/fixture",
      fetchFile: fixtureFetch(),
      cacheStorage: storage as unknown as CacheStorage,
    }),
    matcher: new FakeMatcher(),
    outbox: new MemoryOutbox(),
    scanner: new FakeScanner(),
    ...over,
  };
}
