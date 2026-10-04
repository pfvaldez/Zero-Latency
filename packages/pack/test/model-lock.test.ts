import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { PACK_MODEL_ID, readLock, sha256, verifyModelDir } from "../src/model.ts";

describe("model.lock.json", () => {
  it("pins one Hugging Face revision and a hash for every file", async () => {
    const lock = await readLock();
    expect(lock.repo).toBe("Xenova/multilingual-e5-small");
    expect(lock.revision).toMatch(/^[0-9a-f]{40}$/);
    expect(lock.files.map((f) => f.path)).toEqual(
      expect.arrayContaining([
        "config.json",
        "tokenizer.json",
        "tokenizer_config.json",
        "special_tokens_map.json",
        "onnx/model_quantized.onnx",
      ]),
    );
    for (const f of lock.files) {
      expect(f.sha256).toMatch(/^[0-9a-f]{64}$/);
      expect(f.size).toBeGreaterThan(0);
    }
  });

  it("is the int8 file, about 118 MB, so the pack fits the 150 MB budget with the tokenizer", async () => {
    const lock = await readLock();
    const onnx = lock.files.find((f) => f.path === "onnx/model_quantized.onnx");
    expect(onnx?.size).toBeGreaterThan(100e6);
    expect(onnx?.size).toBeLessThan(130e6);
    expect(lock.files.reduce((n, f) => n + f.size, 0)).toBeLessThan(150e6);
    expect(PACK_MODEL_ID).toBe("multilingual-e5-small");
  });
});

describe("verifyModelDir", () => {
  const tiny = async () => {
    const dir = await mkdtemp(join(tmpdir(), "model-"));
    await mkdir(join(dir, "onnx"), { recursive: true });
    await writeFile(join(dir, "a.json"), "hello");
    const lock = {
      repo: "x/y",
      revision: "0".repeat(40),
      license: "x",
      dtype: "q8",
      files: [{ path: "a.json", size: 5, sha256: sha256(new TextEncoder().encode("hello")) }],
    };
    return { dir, lock };
  };

  it("accepts files that match the lock", async () => {
    const { dir, lock } = await tiny();
    expect(await verifyModelDir(dir, lock)).toBe(true);
  });

  it("rejects a corrupted file, a wrong size and a missing file", async () => {
    const { dir, lock } = await tiny();
    await writeFile(join(dir, "a.json"), "hellp"); // same size, different bytes
    expect(await verifyModelDir(dir, lock)).toBe(false);
    await writeFile(join(dir, "a.json"), "hello!");
    expect(await verifyModelDir(dir, lock)).toBe(false);
    expect(await verifyModelDir(join(dir, "nowhere"), lock)).toBe(false);
  });
});
