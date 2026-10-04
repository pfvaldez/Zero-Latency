// The pinned embedding model. model.lock.json names the Hugging Face repo, the exact revision and
// the sha256 of every file. The same files are copied into each pack, and the builder embeds with
// those copies, so the phone runs the bytes that were evaluated.

import { createHash } from "node:crypto";
import { copyFile, mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export interface ModelFile {
  path: string;
  size: number;
  sha256: string;
}
export interface ModelLock {
  repo: string;
  revision: string;
  license: string;
  dtype: string;
  files: ModelFile[];
}

/** The id the pack and the phone use for the model folder: <localModelPath>/<PACK_MODEL_ID>/… */
export const PACK_MODEL_ID = "multilingual-e5-small";

const HERE = dirname(fileURLToPath(import.meta.url));
export const REPO_ROOT = join(HERE, "..", "..", "..");
export const DEFAULT_CACHE = join(REPO_ROOT, ".cache", "models");

/** The trimmed-vocabulary variant: the same int8 model with the embedding rows we do not need cut away. */
export interface TrimmedLock {
  baseRepo: string;
  baseRevision: string;
  license: string;
  dtype: string;
  recipe: string;
  /** sha256 of packages/pack/trim/keep-ids.json (the kept rows of the base vocabulary, in order). */
  keepIdsSha256: string;
  keepCount: number;
  /** The GitHub Release that holds the files, one asset per file (see releaseAssetName). */
  release: { repo: string; tag: string };
  files: ModelFile[];
}

export const TRIMMED_RELEASE = { repo: "pfvaldez/Zero-Latency", tag: "model-trimmed-v1" } as const;
/** The asset name of a model file: folders are flattened, so onnx/model_quantized.onnx is onnx__model_quantized.onnx. */
export const releaseAssetName = (path: string) => path.replaceAll("/", "__");

/** Where `pipeline asknoor.trim.run apply` (or ensureTrimmedModel) puts the trimmed folder. */
export const TRIMMED_CACHE = join(REPO_ROOT, ".cache", "trimmed", PACK_MODEL_ID);
export const KEEP_IDS_PATH = join(HERE, "..", "trim", "keep-ids.json");
export const TRIMMED_RECIPE =
  "Slice the rows of the 8-bit word-embedding table of the base int8 model to the kept ids; renumber the tokenizer; change nothing else";

export async function readTrimmedLock(): Promise<TrimmedLock> {
  return JSON.parse(
    await readFile(join(HERE, "..", "model-trimmed.lock.json"), "utf8"),
  ) as TrimmedLock;
}

export async function readLock(): Promise<ModelLock> {
  return JSON.parse(await readFile(join(HERE, "..", "model.lock.json"), "utf8")) as ModelLock;
}

export const sha256 = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex");

async function fileMatches(path: string, file: ModelFile): Promise<boolean> {
  try {
    if ((await stat(path)).size !== file.size) return false;
    return sha256(await readFile(path)) === file.sha256;
  } catch {
    return false;
  }
}

/** Download any missing or corrupted file from the pinned revision and verify it. */
export async function ensureModelCache(
  cacheRoot = DEFAULT_CACHE,
  lock?: ModelLock,
): Promise<string> {
  const l = lock ?? (await readLock());
  const dir = join(cacheRoot, l.repo, l.revision);
  for (const file of l.files) {
    const path = join(dir, file.path);
    if (await fileMatches(path, file)) continue;
    const url = `https://huggingface.co/${l.repo}/resolve/${l.revision}/${file.path}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`download failed (${res.status}): ${url}`);
    const bytes = new Uint8Array(await res.arrayBuffer());
    if (bytes.length !== file.size || sha256(bytes) !== file.sha256) {
      throw new Error(`${file.path}: the download does not match model.lock.json (size or sha256)`);
    }
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, bytes);
  }
  return dir;
}

/** Copy the verified model files to `<root>/model/<PACK_MODEL_ID>/…` and return that folder. */
export async function stageModel(root: string, cacheRoot = DEFAULT_CACHE): Promise<string> {
  const lock = await readLock();
  const src = await ensureModelCache(cacheRoot, lock);
  const dest = join(root, "model", PACK_MODEL_ID);
  for (const file of lock.files) {
    await mkdir(dirname(join(dest, file.path)), { recursive: true });
    await copyFile(join(src, file.path), join(dest, file.path));
  }
  return dest;
}

/** True when every locked file in `dir` is present and matches its hash. */
export async function verifyModelDir(dir: string, lock?: ModelLock): Promise<boolean> {
  const l = lock ?? (await readLock());
  for (const file of l.files) if (!(await fileMatches(join(dir, file.path), file))) return false;
  return true;
}

/** True when every file of the trimmed folder matches the trimmed lock, and the kept-id list is the locked one. */
export async function verifyTrimmedDir(
  dir = TRIMMED_CACHE,
  lock?: TrimmedLock,
  keepIdsPath = KEEP_IDS_PATH,
): Promise<boolean> {
  const l = lock ?? (await readTrimmedLock());
  try {
    if (sha256(await readFile(keepIdsPath)) !== l.keepIdsSha256) return false;
  } catch {
    return false;
  }
  for (const file of l.files) if (!(await fileMatches(join(dir, file.path), file))) return false;
  return true;
}

/**
 * Where to fetch each release asset. A public repository serves them from the plain download URL.
 * A private one answers 404 there, so with GITHUB_TOKEN (or GH_TOKEN) set we ask the API for the
 * asset URLs and send the token. The token is read from the environment and never stored.
 */
async function releaseSources(
  lock: TrimmedLock,
  token: string | undefined,
  fetchFile: typeof fetch,
): Promise<(path: string) => { url: string; init?: RequestInit }> {
  const { repo, tag } = lock.release;
  if (!token) {
    return (path) => ({
      url: `https://github.com/${repo}/releases/download/${tag}/${releaseAssetName(path)}`,
    });
  }
  const headers = { Authorization: `Bearer ${token}`, "X-GitHub-Api-Version": "2022-11-28" };
  const res = await fetchFile(`https://api.github.com/repos/${repo}/releases/tags/${tag}`, {
    headers: { ...headers, Accept: "application/vnd.github+json" },
  });
  if (!res.ok) throw new Error(`release lookup failed (${res.status}): ${repo} ${tag}`);
  const assets = ((await res.json()) as { assets: { name: string; url: string }[] }).assets;
  return (path) => {
    const asset = assets.find((a) => a.name === releaseAssetName(path));
    if (!asset) throw new Error(`release ${tag} has no asset ${releaseAssetName(path)}`);
    return {
      url: asset.url,
      init: { headers: { ...headers, Accept: "application/octet-stream" } },
    };
  };
}

/** Download any missing or corrupted trimmed file from the GitHub Release and verify it against the lock. */
export async function ensureTrimmedModel(
  dir = TRIMMED_CACHE,
  lock?: TrimmedLock,
  fetchFile: typeof fetch = fetch,
  token: string | undefined = process.env.GITHUB_TOKEN ?? process.env.GH_TOKEN,
): Promise<string> {
  const l = lock ?? (await readTrimmedLock());
  let source: Awaited<ReturnType<typeof releaseSources>> | undefined;
  for (const file of l.files) {
    const path = join(dir, file.path);
    if (await fileMatches(path, file)) continue;
    source ??= await releaseSources(l, token, fetchFile);
    const { url, init } = source(file.path);
    const res = await fetchFile(url, init);
    if (!res.ok) throw new Error(`download failed (${res.status}): ${url}`);
    const bytes = new Uint8Array(await res.arrayBuffer());
    if (bytes.length !== file.size || sha256(bytes) !== file.sha256) {
      throw new Error(
        `${file.path}: the download does not match model-trimmed.lock.json (size or sha256)`,
      );
    }
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, bytes);
  }
  return dir;
}

/** Copy the verified trimmed model to `<root>/model/<PACK_MODEL_ID>/…`. It is never downloaded unverified. */
export async function stageTrimmedModel(root: string, from = TRIMMED_CACHE): Promise<string> {
  const lock = await readTrimmedLock();
  if (!(await verifyTrimmedDir(from, lock))) {
    throw new Error(
      `the trimmed model in ${from} is missing or does not match model-trimmed.lock.json. Rebuild it: ` +
        "cd pipeline && uv run --group translate python -m asknoor.trim.run apply --keep ../packages/pack/trim/keep-ids.json --out ../.cache/trimmed",
    );
  }
  const dest = join(root, "model", PACK_MODEL_ID);
  for (const file of lock.files) {
    await mkdir(dirname(join(dest, file.path)), { recursive: true });
    await copyFile(join(from, file.path), join(dest, file.path));
  }
  return dest;
}

/** Write model-trimmed.lock.json from a folder (the maintainer's step after a new trim). */
export async function writeTrimmedLock(dir = TRIMMED_CACHE): Promise<TrimmedLock> {
  const base = await readLock();
  const keep = JSON.parse(await readFile(KEEP_IDS_PATH, "utf8")) as number[];
  const files: ModelFile[] = [];
  for (const f of base.files) {
    const bytes = await readFile(join(dir, f.path));
    files.push({ path: f.path, size: bytes.length, sha256: sha256(bytes) });
  }
  const lock: TrimmedLock = {
    baseRepo: base.repo,
    baseRevision: base.revision,
    license: base.license,
    dtype: base.dtype,
    recipe: TRIMMED_RECIPE,
    keepIdsSha256: sha256(await readFile(KEEP_IDS_PATH)),
    keepCount: keep.length,
    release: TRIMMED_RELEASE,
    files,
  };
  await writeFile(
    join(HERE, "..", "model-trimmed.lock.json"),
    `${JSON.stringify(lock, null, 2)}\n`,
  );
  return lock;
}
