import { describe, expect, it } from "vitest";
import { fixtureFetch, fixtureManifest, MemoryCacheStorage } from "@/test/fakes.ts";
import { LocalPackRepository } from "./pack-repository.ts";

const make = (log: string[] = [], tamper?: string, storage = new MemoryCacheStorage()) => ({
  storage,
  repo: new LocalPackRepository({
    base: "/packs/fixture/",
    fetchFile: fixtureFetch(log, tamper),
    cacheStorage: storage as unknown as CacheStorage,
  }),
});

describe("LocalPackRepository", () => {
  it("has no pack before the first download", async () => {
    expect(await make().repo.current()).toBeNull();
  });

  it("downloads every manifest file plus the model files into pack-<slug>-v<version>, and reads them back", async () => {
    const log: string[] = [];
    const { repo, storage } = make(log);
    const progress: number[] = [];
    const manifest = await repo.download((p) => progress.push(p));
    expect(storage.caches.has("pack-fixture-v1")).toBe(true);
    expect(manifest.farmSlug).toBe("fixture");
    expect(log).toContain("model/multilingual-e5-small/onnx/model_quantized.onnx");
    expect(log).toContain("subtitles/clip01.en.vtt");
    expect(progress.at(-1)).toBe(1);
    expect(progress).toEqual([...progress].sort((a, b) => a - b));
    expect((await repo.current())?.packId).toBe(manifest.packId);
    expect(await repo.text("subtitles/clip01.en.vtt")).toContain("WEBVTT");
    expect(await repo.text("subtitles/nope.vtt")).toBeNull();
  });

  it("reports the download size before downloading", async () => {
    const size = await make().repo.size();
    const m = fixtureManifest();
    expect(size).toBeGreaterThanOrEqual(Object.values(m.sizes).reduce((a, b) => a + b, 0));
  });

  it("rejects a file whose checksum does not match the manifest, and saves no manifest (control: untampered passes)", async () => {
    const bad = make([], "subtitles/clip01.en.vtt");
    await expect(bad.repo.download(() => {})).rejects.toThrow(/checksum/);
    expect(await bad.repo.current()).toBeNull();
    await expect(make().repo.download(() => {})).resolves.toBeDefined();
  });

  it("drops an older version of the same farm's pack after a newer one is saved", async () => {
    const { repo, storage } = make();
    await storage.open("pack-fixture-v0");
    await repo.download(() => {});
    expect([...storage.caches.keys()]).toEqual(["pack-fixture-v1"]);
  });
});
