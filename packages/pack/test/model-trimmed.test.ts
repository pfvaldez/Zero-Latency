import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { PACK_BUDGET_BYTES, TOP1_TOLERANCE } from "../src/compare-models.ts";
import { loadQuestions } from "../src/load-content.ts";
import {
  ensureTrimmedModel,
  KEEP_IDS_PATH,
  readLock,
  readTrimmedLock,
  releaseAssetName,
  sha256,
  type TrimmedLock,
  verifyTrimmedDir,
} from "../src/model.ts";
import type { ModelComparison } from "../src/report.ts";
import { vocabSeed } from "../src/vocab-seed.ts";

describe("model-trimmed.lock.json", () => {
  it("is pinned to the same base revision as model.lock.json and to the committed kept-id list", async () => {
    const trimmed = await readTrimmedLock();
    const base = await readLock();
    expect(trimmed.baseRepo).toBe(base.repo);
    expect(trimmed.baseRevision).toBe(base.revision);
    expect(trimmed.keepIdsSha256).toBe(sha256(await readFile(KEEP_IDS_PATH)));
    const keep = JSON.parse(await readFile(KEEP_IDS_PATH, "utf8")) as number[];
    expect(keep).toHaveLength(trimmed.keepCount);
    expect(new Set(keep).size).toBe(keep.length);
    expect(keep).toEqual([...keep].sort((a, b) => a - b));
    // The specials and the unknown token keep their ids 0 to 3 at the front.
    expect(keep.slice(0, 4)).toEqual([0, 1, 2, 3]);
  });

  it("lists the same files as the full model, each with a sha256, and fits the 50 MB pack target with room for audio", async () => {
    const trimmed = await readTrimmedLock();
    const base = await readLock();
    expect(trimmed.files.map((f) => f.path)).toEqual(base.files.map((f) => f.path));
    for (const f of trimmed.files) expect(f.sha256).toMatch(/^[0-9a-f]{64}$/);
    const total = trimmed.files.reduce((n, f) => n + f.size, 0);
    expect(total).toBeLessThan(PACK_BUDGET_BYTES - 3_000_000);
    expect(total).toBeLessThan(base.files.reduce((n, f) => n + f.size, 0) / 2);
  });
});

describe("verifyTrimmedDir", () => {
  const tiny = async () => {
    const dir = await mkdtemp(join(tmpdir(), "trimmed-"));
    await mkdir(join(dir, "m"), { recursive: true });
    await writeFile(join(dir, "m", "a.bin"), "hello");
    const keepPath = join(dir, "keep.json");
    await writeFile(keepPath, "[0,1,2,3]");
    const lock: TrimmedLock = {
      baseRepo: "x/y",
      baseRevision: "0".repeat(40),
      license: "x",
      dtype: "q8",
      recipe: "r",
      keepIdsSha256: sha256(await readFile(keepPath)),
      keepCount: 4,
      release: { repo: "o/r", tag: "t" },
      files: [{ path: "a.bin", size: 5, sha256: sha256(new TextEncoder().encode("hello")) }],
    };
    await writeFile(join(dir, "a.bin"), "hello");
    return { dir, keepPath, lock };
  };

  it("accepts files and a kept-id list that match the lock", async () => {
    const { dir, keepPath, lock } = await tiny();
    expect(await verifyTrimmedDir(dir, lock, keepPath)).toBe(true);
  });

  it("rejects a corrupted file, a missing file and a changed kept-id list", async () => {
    const { dir, keepPath, lock } = await tiny();
    await writeFile(join(dir, "a.bin"), "hellp"); // same size, different bytes
    expect(await verifyTrimmedDir(dir, lock, keepPath)).toBe(false);
    expect(await verifyTrimmedDir(join(dir, "nowhere"), lock, keepPath)).toBe(false);
    const fresh = await tiny();
    await writeFile(fresh.keepPath, "[0,1,2,4]");
    expect(await verifyTrimmedDir(fresh.dir, fresh.lock, fresh.keepPath)).toBe(false);
  });
});

describe("the vocabulary seed", () => {
  it("is our own content and never contains a test question", async () => {
    const seed = await vocabSeed("ondera-noor");
    const questions = (await loadQuestions("ondera-noor")).map((q) => q.question.trim());
    expect(seed.length).toBeGreaterThan(300);
    expect(seed.some((line) => questions.includes(line))).toBe(false);
    expect(seed).toContain(
      "Welcome to my farm. I'm Noor. My family has worked on this hillside for years. Today I'll show you how our coffee goes from a flower to your cup.",
    );
  });
});

describe("content/ondera-noor/eval/models.json", () => {
  it("ships a model that met the pre-set rule and the size target", async () => {
    const m = JSON.parse(
      await readFile(
        new URL("../../../content/ondera-noor/eval/models.json", import.meta.url),
        "utf8",
      ),
    ) as ModelComparison;
    const full = m.rows[0];
    const shipped = m.rows.find((r) => r.name === m.shipped);
    expect(full?.name).toMatch(/^full/);
    expect(shipped).toBeDefined();
    expect(shipped?.withinTolerance).toBe(true);
    expect((full?.heldOut?.top1 ?? 0) - (shipped?.heldOut?.top1 ?? 0)).toBeLessThanOrEqual(
      TOP1_TOLERANCE + 1e-9,
    );
    expect(shipped?.modelBytes).toBeLessThan(PACK_BUDGET_BYTES - 3_000_000);
    expect(m.shippedReason.length).toBeGreaterThan(10);
  });

  it("recorded the control: re-quantizing from fp32 fails the rule, so the model is sliced instead", async () => {
    const m = JSON.parse(
      await readFile(
        new URL("../../../content/ondera-noor/eval/models.json", import.meta.url),
        "utf8",
      ),
    ) as ModelComparison;
    const controls = m.rows.filter((r) => r.name.startsWith("control:"));
    expect(controls.length).toBeGreaterThanOrEqual(2);
    for (const c of controls) expect(c.withinTolerance).toBe(false);
  });
});

describe("ensureTrimmedModel (release download)", () => {
  const bytes = new TextEncoder().encode("model bytes");
  const lock = (): TrimmedLock => ({
    baseRepo: "x/y",
    baseRevision: "r",
    license: "MIT",
    dtype: "q8",
    recipe: "r",
    keepIdsSha256: "0".repeat(64),
    keepCount: 1,
    release: { repo: "o/r", tag: "t1" },
    files: [{ path: "onnx/m.onnx", size: bytes.length, sha256: sha256(bytes) }],
  });

  it("flattens folders in asset names and fetches each missing file from the release tag", async () => {
    expect(releaseAssetName("onnx/model_quantized.onnx")).toBe("onnx__model_quantized.onnx");
    const dir = await mkdtemp(join(tmpdir(), "trim-dl-"));
    const urls: string[] = [];
    const fetchFile = (async (url: string) => {
      urls.push(url);
      return new Response(bytes);
    }) as unknown as typeof fetch;
    await ensureTrimmedModel(dir, lock(), fetchFile);
    expect(urls).toEqual(["https://github.com/o/r/releases/download/t1/onnx__m.onnx"]);
    expect(new Uint8Array(await readFile(join(dir, "onnx", "m.onnx")))).toEqual(bytes);
    await ensureTrimmedModel(dir, lock(), fetchFile); // already verified: no second download
    expect(urls).toHaveLength(1);
  });

  it("rejects a download whose sha256 does not match the lock, and writes nothing", async () => {
    const dir = await mkdtemp(join(tmpdir(), "trim-dl-"));
    const bad = (async () =>
      new Response(new TextEncoder().encode("model bytez"))) as unknown as typeof fetch;
    await expect(ensureTrimmedModel(dir, lock(), bad)).rejects.toThrow(/does not match/);
    await expect(readFile(join(dir, "onnx", "m.onnx"))).rejects.toThrow();
    const notFound = (async () => new Response("no", { status: 404 })) as unknown as typeof fetch;
    await expect(ensureTrimmedModel(dir, lock(), notFound)).rejects.toThrow(/404/);
  });

  it("names the real release in the committed lock", async () => {
    expect((await readTrimmedLock()).release).toEqual({
      repo: "pfvaldez/Zero-Latency",
      tag: "model-trimmed-v1",
    });
  });
});
