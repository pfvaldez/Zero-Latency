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
