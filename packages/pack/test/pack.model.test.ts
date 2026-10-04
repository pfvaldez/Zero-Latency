// Needs the pinned model files: run `bun run pack:model` once, then `bun run test:model`
// (the CI `model` job does both). Uses the real model through Transformers.js on Node.
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { buildPack } from "../src/build.ts";
import { dot, loadEmbedder } from "../src/embed.ts";
import { MARGIN_PLACEHOLDER, runEval } from "../src/eval-run.ts";
import { FIXTURE_DIR, fixtureInput } from "../src/fixture.ts";
import {
  DEFAULT_CACHE,
  ensureModelCache,
  PACK_MODEL_ID,
  REPO_ROOT,
  readTrimmedLock,
  stageModel,
  stageTrimmedModel,
  verifyTrimmedDir,
} from "../src/model.ts";

const STAGE = join(REPO_ROOT, ".cache", "stage");

describe("the embedder", () => {
  it("produces unit-length 384-dim vectors, the same twice, from the verified local files", async () => {
    await ensureModelCache(DEFAULT_CACHE);
    await stageModel(STAGE, DEFAULT_CACHE);
    const e = await loadEmbedder(join(STAGE, "model"));
    const [a] = await e.embed(["We roast in a pan."], "passage: ");
    const [b] = await e.embed(["We roast in a pan."], "passage: ");
    await e.dispose();
    expect(a).toHaveLength(384);
    expect(Math.sqrt(dot(a as Float32Array, a as Float32Array))).toBeCloseTo(1, 4);
    expect(dot(a as Float32Array, b as Float32Array)).toBeGreaterThan(0.99999);
  });

  it("scores a paraphrase and a translation far above an unrelated sentence", async () => {
    const e = await loadEmbedder(join(STAGE, "model"));
    const [passage, german, unrelated] = await e.embed(
      [
        "We roast the beans in a pan over the fire.",
        "Wir rösten die Bohnen in einer Pfanne über dem Feuer.",
        "The bus to the airport leaves at nine.",
      ],
      "passage: ",
    );
    const [q] = await e.embed(["How do you roast the coffee?"], "query: ");
    await e.dispose();
    const score = (v?: Float32Array) => dot(q as Float32Array, v as Float32Array);
    expect(score(passage)).toBeGreaterThan(score(unrelated) + 0.05);
    expect(score(german)).toBeGreaterThan(score(unrelated) + 0.03);
  });
});

describe("the pack builder", () => {
  // The int8 model gives slightly different vectors on different CPUs (found in CI on Linux x64:
  // cosine 0.9948 against the vectors committed from macOS arm64). So everything that is not an
  // embedding must match byte for byte, and the embeddings must match to a documented tolerance.
  it("rebuilds the committed fixture: every file but the embeddings byte for byte", async () => {
    const out = await mkdtemp(join(tmpdir(), "fixture-"));
    const built = await buildPack({
      farm: "fixture",
      mode: "demo",
      input: await fixtureInput(),
      outDir: out,
      audioDir: join(REPO_ROOT, "packages", "pack", "fixtures", "audio"),
      now: new Date("2026-10-04T00:00:00Z"),
      farmId: "00000000-0000-4000-8000-0000000000f1",
      includeModel: false,
      allowSyntheticTones: true,
      thresholds: { match: 0.8525, margin: 0.05 },
    });
    const committed = JSON.parse(await readFile(join(FIXTURE_DIR, "manifest.json"), "utf8"));
    const without = (c: Record<string, string>) =>
      Object.fromEntries(Object.entries(c).filter(([k]) => k !== "embeddings.f32"));
    expect(without(built.manifest.checksums)).toEqual(without(committed.checksums));
    expect(built.manifest.embeddings.rows).toEqual(committed.embeddings.rows);
  });

  it("re-embedding the fixture passages matches the committed vectors (cosine at least 0.99 across CPUs)", async () => {
    const committed = JSON.parse(await readFile(join(FIXTURE_DIR, "manifest.json"), "utf8"));
    const buf = await readFile(join(FIXTURE_DIR, "embeddings.f32"));
    const matrix = new Float32Array(buf.buffer, buf.byteOffset, buf.byteLength / 4);
    const input = await fixtureInput();
    const texts = committed.embeddings.rows.map((r: { momentId: string; lang: string }) => {
      const clip = Number(r.momentId.slice(1, -3));
      const item = input.clipTranslations?.[String(clip)];
      return r.lang === "en"
        ? input.clips.clips[clip - 1]?.script.en
        : item?.sentences.map((s) => (s as Record<string, string>)[r.lang]).join(" ");
    });
    const e = await loadEmbedder(join(STAGE, "model"));
    const fresh = await e.embed(texts, "passage: ");
    await e.dispose();
    for (const [i, v] of fresh.entries()) {
      expect(dot(v, matrix.slice(i * 384, (i + 1) * 384))).toBeGreaterThan(0.99); // worst seen: 0.9948 (Linux x64 vs macOS arm64)
    }
  });

  it("bumps the version only when the content changes", async () => {
    const out = await mkdtemp(join(tmpdir(), "versions-"));
    const base = {
      farm: "fixture",
      mode: "demo" as const,
      outDir: out,
      audioDir: join(REPO_ROOT, "packages", "pack", "fixtures", "audio"),
      includeModel: false,
      allowSyntheticTones: true,
      thresholds: { match: 0.85, margin: 0.05 },
    };
    const first = await buildPack({ ...base, input: await fixtureInput() });
    const again = await buildPack({ ...base, input: await fixtureInput() });
    expect([first.manifest.version, again.manifest.version, again.changed]).toEqual([1, 1, false]);
    const changed = await fixtureInput();
    const clip = changed.clips.clips[0];
    if (clip) clip.script.en = "A different English sentence for the fixture.";
    const third = await buildPack({ ...base, input: { ...changed, clipTranslations: null } });
    expect([third.manifest.version, third.changed]).toEqual([2, true]);
  });
});

describe("index-only passages in a built pack", () => {
  it("become flagged matrix rows that the builder embeds and verifies, and are never in a subtitle file", async () => {
    const out = await mkdtemp(join(tmpdir(), "index-"));
    const input = await fixtureInput();
    const phrases = [
      "Where do the cherries come from",
      "Wie werden die Kirschen gepflückt",
      "Hoe worden de bessen geplukt",
      "Hur plockas bären",
    ];
    input.indexPassages = {
      writer: "an isolated assistant",
      draft: true,
      neverShown: true,
      removedAsDuplicates: [],
      clips: Object.fromEntries(
        [1, 2, 3].map((n) => [
          String(n),
          {
            en: [phrases[0] as string],
            de: [phrases[1] as string],
            nl: [phrases[2] as string],
            sv: [phrases[3] as string],
          },
        ]),
      ),
    };
    const built = await buildPack({
      farm: "fixture",
      mode: "demo",
      input,
      outDir: out,
      audioDir: join(REPO_ROOT, "packages", "pack", "fixtures", "audio"),
      now: new Date("2026-10-04T00:00:00Z"),
      includeModel: false,
      allowSyntheticTones: true,
      thresholds: { match: 0.85, margin: 0.05 },
    });
    const rows = built.manifest.embeddings.rows;
    expect(rows).toHaveLength(12 + 12);
    expect(rows.filter((r) => r.indexOnly)).toHaveLength(12);
    expect(rows.filter((r) => !r.indexOnly)).toHaveLength(12);
    for (const f of Object.keys(built.manifest.checksums).filter((k) => k.endsWith(".vtt"))) {
      expect(await readFile(join(out, f), "utf8")).not.toContain(phrases[0] as string);
    }
    const buf = await readFile(join(out, "embeddings.f32"));
    expect(buf.byteLength).toBe(24 * 384 * 4);
  });
});

describe("the evaluation (smoke test on the real content, nothing written)", () => {
  it("finds a threshold that meets the 5% limit and reports consistent numbers", async () => {
    const r = await runEval("ondera-noor", new Date("2026-10-04"), { write: false });
    expect(r.threshold).toBeGreaterThan(0.6);
    expect(r.threshold).toBeLessThan(0.99);
    expect(r.primary.falseConfirmRate).toBeLessThanOrEqual(0.05);
    expect(r.margin).toBe(MARGIN_PLACEHOLDER);
    expect(r.questions.total).toBe(116);
    expect(r.unsafe.safetyRecall).toBe(1);
    expect(r.size.modelBytes + r.size.embeddingsBytes).toBeLessThan(150e6);
    expect(r.primary.answered + r.primary.neverAnswered).toBe(r.primary.questions);
    expect(r.study.length).toBe(5); // English only, before, after, production today, strict
    expect(r.leakage?.passages).toBeGreaterThan(80);
  });
});

// The trimmed model is a local build product (`cd pipeline && uv run --group translate python -m
// asknoor.trim.run apply ...`), verified against model-trimmed.lock.json. The CI model job does not
// build it, so these tests run where the folder exists and are reported as skipped where it does not.
const trimmedPresent = await verifyTrimmedDir();

describe.skipIf(!trimmedPresent)("the trimmed model", () => {
  it("loads through Transformers.js on Node and gives vectors close to the full model's, in every language", async () => {
    await ensureModelCache(DEFAULT_CACHE);
    await stageModel(STAGE, DEFAULT_CACHE);
    const trimmedStage = join(await mkdtemp(join(tmpdir(), "trimmed-stage-")));
    await stageTrimmedModel(trimmedStage);
    const full = await loadEmbedder(join(STAGE, "model"));
    const trimmed = await loadEmbedder(join(trimmedStage, "model"));
    const sentences = [
      "We roast the beans in a pan over the fire.",
      "Wir rösten die Bohnen in einer Pfanne über dem Feuer.",
      "We branden de bonen in een pan boven het vuur.",
      "Vi rostar bönorna i en panna över elden.",
      "Dama bëgg a jënd kafe.",
      "Can I stay overnight on the farm?",
    ];
    const a = await full.embed(sentences, "passage: ");
    const b = await trimmed.embed(sentences, "passage: ");
    await full.dispose();
    await trimmed.dispose();
    for (const [i, v] of a.entries()) {
      expect(dot(v, b[i] as Float32Array)).toBeGreaterThan(0.98);
    }
  });

  it("builds a pack that says it is trimmed, verifies, and stays under 50 MB", async () => {
    const out = await mkdtemp(join(tmpdir(), "trimmed-pack-"));
    const built = await buildPack({
      farm: "fixture",
      mode: "demo",
      input: await fixtureInput(),
      outDir: out,
      audioDir: join(REPO_ROOT, "packages", "pack", "fixtures", "audio"),
      now: new Date("2026-10-04T00:00:00Z"),
      farmId: "00000000-0000-4000-8000-0000000000f1",
      includeModel: true,
      allowSyntheticTones: true,
      thresholds: { match: 0.8675, margin: 0.05 },
      model: "trimmed",
    });
    const lock = await readTrimmedLock();
    const m = built.manifest.model;
    expect(m.vocab).toBe("trimmed");
    expect(m.revision).toBe(lock.baseRevision);
    expect(m.trim).toMatchObject({ keptRows: lock.keepCount, keepIdsSha256: lock.keepIdsSha256 });
    expect(m.dir).toBe(`model/${PACK_MODEL_ID}`);
    for (const f of lock.files) {
      expect(built.manifest.checksums[`model/${PACK_MODEL_ID}/${f.path}`]).toBe(f.sha256);
    }
    const total = Object.values(built.manifest.sizes).reduce((a, b) => a + b, 0);
    expect(total).toBeLessThan(50_000_000);
  });

  it("refuses a trimmed model whose files do not match the lock", async () => {
    const dir = await mkdtemp(join(tmpdir(), "bad-trimmed-"));
    await expect(stageTrimmedModel(join(dir, "out"), dir)).rejects.toThrow(
      /model-trimmed\.lock\.json/,
    );
  });
});
