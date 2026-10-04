import { execFileSync } from "node:child_process";
import { cp, mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PackError } from "@asknoor/core";
import { describe, expect, it } from "vitest";
import { verifyPack } from "../src/build.ts";
import { FIXTURE_DIR } from "../src/fixture.ts";

// The files git tracks in the fixture folder. A developer may stage the model there to run the
// offline e2e (it is gitignored); that must not count as committed.
const committed = (): string[] =>
  execFileSync("git", ["ls-files", "--", "."], { cwd: FIXTURE_DIR, encoding: "utf8" })
    .split("\n")
    .filter(Boolean)
    .sort();

describe("the committed fixture pack", () => {
  it("validates against the core schema, with every file's size and sha256 matching", async () => {
    const manifest = await verifyPack(FIXTURE_DIR, { requireModel: false });
    expect(manifest.mode).toBe("demo");
    expect(manifest.clips).toHaveLength(3);
  });

  it("is labeled synthetic and is demo-only: a stand-in label that the schema refuses in production", async () => {
    const manifest = await verifyPack(FIXTURE_DIR, { requireModel: false });
    expect(manifest.labels.standIn).toEqual(["Synthetic test tone, not a voice"]);
    expect(manifest.labels.standInVoice).toEqual([]);
    expect(manifest.labels.aiDubbed).toEqual([]);
  });

  it("holds no model files (135 MB) and stays small", async () => {
    expect(committed().some((f) => f.startsWith("model/"))).toBe(false);
    const manifest = await verifyPack(FIXTURE_DIR, { requireModel: false });
    expect(Object.values(manifest.sizes).reduce((a, b) => a + b, 0)).toBeLessThan(500_000);
    expect(manifest.model.sizeBytes).toBeGreaterThan(100e6); // still records the model it was embedded with
  });

  it("has no stray files: everything on disk is in the manifest, and the other way round", async () => {
    const manifest = await verifyPack(FIXTURE_DIR, { requireModel: false });
    expect(committed().filter((f) => f !== "manifest.json")).toEqual(
      Object.keys(manifest.checksums).sort(),
    );
  });

  it("has one embedding row per moment and language, in the order the matrix was written", async () => {
    const m = await verifyPack(FIXTURE_DIR, { requireModel: false });
    expect(m.embeddings.rows).toHaveLength(12);
    expect(m.embeddings.rows.slice(0, 4).map((r) => r.lang)).toEqual(["en", "de", "nl", "sv"]);
    expect(m.embeddings.rows.map((r) => r.momentId)).toEqual(
      m.moments.flatMap((x) => [x.id, x.id, x.id, x.id]),
    );
    expect(m.embeddings.passagePrefix).toBe("passage: ");
    expect(m.model.queryPrefix).toBe("query: ");
    expect(m.model.revision).toMatch(/^[0-9a-f]{40}$/);
  });

  it("writes valid WebVTT with the estimated-timing note", async () => {
    const vtt = await readFile(join(FIXTURE_DIR, "subtitles", "clip01.en.vtt"), "utf8");
    expect(vtt.startsWith("WEBVTT\n")).toBe(true);
    expect(vtt).toContain("NOTE timing estimated from the script");
    expect(vtt).toMatch(/\d\d:\d\d:\d\d\.\d{3} --> \d\d:\d\d:\d\d\.\d{3}/);
  });
});

describe("verifyPack catches tampering", () => {
  const copy = async () => {
    const dir = await mkdtemp(join(tmpdir(), "pack-"));
    await cp(FIXTURE_DIR, dir, { recursive: true });
    return dir;
  };

  it("fails on a changed byte (sha256), a changed size and a missing file", async () => {
    let dir = await copy();
    const audio = await readFile(join(dir, "audio", "clip01.m4a"));
    audio[100] = (audio[100] ?? 0) ^ 0xff;
    await writeFile(join(dir, "audio", "clip01.m4a"), audio);
    await expect(verifyPack(dir, { requireModel: false })).rejects.toThrow(/sha256 differs/);

    dir = await copy();
    await writeFile(join(dir, "audio", "clip02.m4a"), "short");
    await expect(verifyPack(dir, { requireModel: false })).rejects.toThrow(/size differs/);

    dir = await copy();
    await rm(join(dir, "subtitles", "clip03.sv.vtt"));
    await expect(verifyPack(dir, { requireModel: false })).rejects.toThrow(PackError);
  });

  it("fails when the embedding matrix does not match the declared rows", async () => {
    const dir = await copy();
    const m = JSON.parse(await readFile(join(dir, "manifest.json"), "utf8"));
    m.embeddings.count = 13;
    m.embeddings.rows.push({ momentId: "c1-m1", lang: "en" });
    await writeFile(join(dir, "manifest.json"), JSON.stringify(m));
    await expect(verifyPack(dir, { requireModel: false })).rejects.toThrow(/embedding matrix size/);
  });

  it("fails on a manifest that is not valid against the core schema", async () => {
    const dir = await copy();
    const m = JSON.parse(await readFile(join(dir, "manifest.json"), "utf8"));
    m.mode = "production"; // a production pack may not list a stand-in
    await writeFile(join(dir, "manifest.json"), JSON.stringify(m));
    await expect(verifyPack(dir, { requireModel: false })).rejects.toThrow();
  });
});
