// The pack builder: reads content/, the prepared audio and the checks, asks planPack (core) what
// goes in, then does the I/O: embeddings with the pinned model, files, checksums and a manifest
// that the core schema validates. Never runs at guest runtime.

import { createHash } from "node:crypto";
import { copyFile, mkdir, readdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { dirname, join, relative } from "node:path";
import {
  type AddonContent,
  type AudioMeta,
  FactsFileSchema,
  FarmCardFileSchema,
  type FarmPackManifest,
  FarmPackManifestSchema,
  IndexPassagesFileSchema,
  makeFarmCode,
  PackError,
  type PackInput,
  type PackMode,
  type PackPlan,
  ProductsFileSchema,
  parseConsent,
  planPack,
  RecipeFileSchema,
  RecordingsFileSchema,
  type Translations,
} from "@asknoor/core";
import { DIM, loadEmbedder } from "./embed.ts";
import { contentDir, loadChecks, loadClips, loadTranscripts } from "./load-content.ts";
import {
  DEFAULT_CACHE,
  PACK_MODEL_ID,
  REPO_ROOT,
  readLock,
  readTrimmedLock,
  sha256,
  stageModel,
  stageTrimmedModel,
} from "./model.ts";

export interface BuildOptions {
  farm: string;
  mode: PackMode;
  publish?: number[];
  outDir?: string;
  /** Where the prepared recordings are: <dir>/en/clipNN.m4a and <dir>/wo/clipNN_wo.m4a. */
  audioDir?: string;
  /** Recordings registry file; defaults to the farm's recordings.json. */
  recordingsPath?: string;
  /** Fixed for reproducible packs (the fixture). */
  now?: Date;
  farmId?: string;
  /** Match threshold and margin; defaults to the farm's eval/threshold.json. */
  thresholds?: { match: number; margin: number };
  /** Skip content/ lookups for fixtures that bring their own input. */
  input?: PackInput;
  /** Copy the model into the pack. The committed fixture leaves it out (it is 135 MB). */
  includeModel?: boolean;
  /** Which model files go in the pack: the pinned full model (default) or the trimmed-vocabulary one. */
  model?: "full" | "trimmed";
  /** Only the fixture builder sets this: generated tones need no consent row. */
  allowSyntheticTones?: boolean;
  /** Noor's 4-digit farm code. Only its salted hash goes in the manifest. Without it the shop cannot confirm an order. */
  farmCode?: string;
  stageRoot?: string;
}

export interface BuiltPack {
  dir: string;
  manifest: FarmPackManifest;
  plan: PackPlan;
  changed: boolean;
}

const json = async (path: string): Promise<unknown> => JSON.parse(await readFile(path, "utf8"));
const hex = (bytes: Uint8Array | string) => createHash("sha256").update(bytes).digest("hex");

async function optionalJson(path: string): Promise<unknown | null> {
  try {
    return await json(path);
  } catch {
    return null;
  }
}

async function walk(dir: string, base = dir): Promise<string[]> {
  const out: string[] = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...(await walk(full, base)));
    else out.push(relative(base, full));
  }
  return out.sort();
}

interface AudioReport {
  clips: Record<string, { duration_ms: number; head_silence_s: number; tail_silence_s: number }>;
}

/** The index-only phrasings, or null when the farm has none yet. */
async function loadIndexPassages(dir: string) {
  const raw = await optionalJson(join(dir, "index-passages.json"));
  return raw === null ? null : IndexPassagesFileSchema.parse(raw);
}

export async function loadPackInput(farm: string): Promise<PackInput> {
  const dir = contentDir(farm);
  const report = (await json(join(dir, "recordings", "audio-report.json"))) as AudioReport;
  const audio: Record<string, AudioMeta> = {};
  for (const [file, r] of Object.entries(report.clips)) {
    audio[file] = {
      durationMs: r.duration_ms,
      headSilenceMs: Math.round(r.head_silence_s * 1000),
      tailSilenceMs: Math.round(r.tail_silence_s * 1000),
    };
  }
  const addonContent: AddonContent = {
    facts: FactsFileSchema.parse(await json(join(dir, "facts.json"))),
    recipe: RecipeFileSchema.parse(await json(join(dir, "recipe.json"))),
    products: ProductsFileSchema.parse(await json(join(dir, "products.json"))),
    farmCard: FarmCardFileSchema.parse(await json(join(dir, "farm-card.json"))),
  };
  const translations = async (name: string, key: string): Promise<Translations | null> => {
    const file = (await optionalJson(join(dir, "translations", name))) as Record<
      string,
      Translations
    > | null;
    return file ? (file[key] ?? {}) : null;
  };
  const transcripts = await loadTranscripts(farm);
  return {
    clips: await loadClips(farm),
    checks: await loadChecks(farm),
    addonContent,
    recordings: RecordingsFileSchema.parse(await json(join(dir, "recordings", "recordings.json"))),
    audio,
    transcripts: new Map([...transcripts].map(([n, t]) => [n, t])),
    clipTranslations: await translations("clips.json", "clips"),
    addonTranslations: await translations("addons.json", "items"),
    indexPassages: await loadIndexPassages(dir),
    consent: parseConsent(await readFile(join(REPO_ROOT, "docs", "CONSENT.md"), "utf8")),
    sha256: (text) => hex(text),
  };
}

/** Where a planned recording is on disk: wo/clip01_wo.flac was prepared as wo/clip01_wo.m4a. */
function preparedPath(audioDir: string, registryFile: string): string {
  return join(audioDir, registryFile.replace(/\.(flac|m4a)$/, ".m4a"));
}

async function readThreshold(farm: string): Promise<{ match: number; margin: number }> {
  const t = (await json(join(contentDir(farm), "eval", "threshold.json"))) as {
    match: number;
    margin: number;
  };
  return { match: t.match, margin: t.margin };
}

export async function buildPack(opts: BuildOptions): Promise<BuiltPack> {
  const input = opts.input ?? (await loadPackInput(opts.farm));
  const plan = planPack(input, opts.mode, {
    publish: opts.publish ?? [],
    allowSyntheticTones: opts.allowSyntheticTones ?? false,
  });

  const outDir =
    opts.outDir ?? join(REPO_ROOT, "apps", "web", "public", "packs", opts.farm, opts.mode);
  const audioDir = opts.audioDir ?? join(REPO_ROOT, "pipeline", "build", opts.farm, "audio");
  const previous = (await optionalJson(join(outDir, "manifest.json"))) as FarmPackManifest | null;

  // Build into a clean folder; the previous manifest is only read for its version.
  await rm(outDir, { recursive: true, force: true });
  await mkdir(outDir, { recursive: true });

  for (const file of plan.files) {
    const dest = join(outDir, file.dest);
    await mkdir(dirname(dest), { recursive: true });
    if ("recording" in file.source) {
      const src = preparedPath(audioDir, file.source.recording);
      try {
        await copyFile(src, dest);
      } catch {
        throw new PackError(
          `the prepared audio ${src} is missing: run \`uv run python -m asknoor.build --steps audio\``,
        );
      }
    } else {
      await writeFile(dest, file.source.text);
    }
  }

  // The model files the phone will load, and the embeddings made from those exact files.
  const includeModel = opts.includeModel ?? true;
  const stage = includeModel ? outDir : (opts.stageRoot ?? join(REPO_ROOT, ".cache", "stage"));
  const variant = opts.model ?? "full";
  if (variant === "trimmed") await stageTrimmedModel(stage);
  else await stageModel(stage, DEFAULT_CACHE);
  const embedder = await loadEmbedder(join(stage, "model"));
  const vectors = await embedder.embed(
    plan.passages.map((p) => p.text),
    "passage: ",
  );
  await embedder.dispose();
  const matrix = new Float32Array(vectors.length * DIM);
  for (const [i, v] of vectors.entries()) matrix.set(v, i * DIM);
  await writeFile(join(outDir, "embeddings.f32"), new Uint8Array(matrix.buffer));

  const lock = await readLock();
  const sizes: Record<string, number> = {};
  const checksums: Record<string, string> = {};
  for (const rel of await walk(outDir)) {
    if (rel === "manifest.json") continue;
    const bytes = await readFile(join(outDir, rel));
    sizes[rel] = bytes.length;
    checksums[rel] = hex(bytes);
  }
  const contentHash = hex(JSON.stringify(Object.entries(checksums))).slice(0, 12);
  const changed = !previous || previousHash(previous) !== contentHash;
  const version = previous ? (changed ? previous.version + 1 : previous.version) : 1;

  const trimmedLock = variant === "trimmed" ? await readTrimmedLock() : null;
  const modelBytes = (trimmedLock ?? lock).files.reduce((s, f) => s + f.size, 0);
  const manifest: FarmPackManifest = {
    packId: `${opts.farm}-${opts.mode}-${contentHash}`,
    farmId: opts.farmId ?? "00000000-0000-4000-8000-000000000001",
    farmSlug: opts.farm,
    version,
    mode: opts.mode,
    createdAt: (opts.now ?? new Date()).toISOString(),
    noorLang: "wo",
    visitorLangs: plan.visitorLangs,
    clips: plan.clips,
    moments: plan.moments,
    addons: plan.addons,
    model: {
      id: PACK_MODEL_ID,
      dir: `model/${PACK_MODEL_ID}`,
      source: trimmedLock?.baseRepo ?? lock.repo,
      revision: trimmedLock?.baseRevision ?? lock.revision,
      queryPrefix: "query: ",
      dim: 384,
      quantization: "int8",
      vocab: trimmedLock ? "trimmed" : "full",
      ...(trimmedLock
        ? {
            trim: {
              keptRows: trimmedLock.keepCount,
              keepIdsSha256: trimmedLock.keepIdsSha256,
              recipe: trimmedLock.recipe,
            },
          }
        : {}),
      sizeBytes: modelBytes,
    },
    embeddings: {
      file: "embeddings.f32",
      count: plan.passages.length,
      dim: 384,
      dtype: "float32",
      passagePrefix: "passage: ",
      rows: plan.passages.map((p) => ({
        momentId: p.momentId,
        lang: p.lang,
        ...(p.indexOnly ? { indexOnly: true as const } : {}),
      })),
    },
    thresholds: opts.thresholds ?? (await readThreshold(opts.farm)),
    ...(opts.farmCode ? { farmCode: await makeFarmCode(opts.farmCode, opts.farm) } : {}),
    sizes,
    checksums,
    labels: plan.labels,
  };
  const valid = FarmPackManifestSchema.parse(manifest);
  await writeFile(join(outDir, "manifest.json"), `${JSON.stringify(valid, null, 2)}\n`);
  await verifyPack(outDir);
  return { dir: outDir, manifest: valid, plan, changed };
}

const previousHash = (m: FarmPackManifest) =>
  hex(JSON.stringify(Object.entries(m.checksums))).slice(0, 12);

/** Check manifest.json against the files: schema, every listed file's size and sha256. */
export async function verifyPack(
  dir: string,
  opts: { requireModel?: boolean } = {},
): Promise<FarmPackManifest> {
  const manifest = FarmPackManifestSchema.parse(await json(join(dir, "manifest.json")));
  for (const [rel, sum] of Object.entries(manifest.checksums)) {
    if (rel.startsWith("model/") && opts.requireModel === false) continue;
    let bytes: Buffer;
    try {
      bytes = await readFile(join(dir, rel));
    } catch {
      throw new PackError(`${rel} is listed in the manifest but missing`);
    }
    if (bytes.length !== manifest.sizes[rel])
      throw new PackError(`${rel}: size differs from the manifest`);
    if (hex(bytes) !== sum) throw new PackError(`${rel}: sha256 differs from the manifest`);
  }
  const matrix = await stat(join(dir, manifest.embeddings.file));
  if (matrix.size !== manifest.embeddings.count * manifest.embeddings.dim * 4) {
    throw new PackError("the embedding matrix size does not match embeddings.count");
  }
  return manifest;
}

export { sha256 };
