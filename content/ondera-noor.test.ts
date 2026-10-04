// Validates every content file in content/ondera-noor/ against the schemas in packages/core, and
// checks the things only the files together can show (clips, recordings, checks, questions).
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  ChecksFileSchema,
  ClipsFileSchema,
  decideSafety,
  FactsFileSchema,
  FarmCardFileSchema,
  fillTemplate,
  ProductsFileSchema,
  parseTestQuestions,
  RecipeFileSchema,
  RecordingsFileSchema,
  redact,
  SmsTemplatesFileSchema,
  THEME_IDS,
  toAddons,
  VISITOR_LANGS,
} from "../packages/core/src/index.ts";

const DIR = join(dirname(fileURLToPath(import.meta.url)), "ondera-noor");
const text = (name: string) => readFileSync(join(DIR, name), "utf8");
const json = (name: string): unknown => JSON.parse(text(name));

// Parsing throws a readable error naming the file if a schema is not met.
const clips = ClipsFileSchema.parse(json("clips.json"));
const checks = ChecksFileSchema.parse(json("checks.json"));
const facts = FactsFileSchema.parse(json("facts.json"));
const recipe = RecipeFileSchema.parse(json("recipe.json"));
const products = ProductsFileSchema.parse(json("products.json"));
const farmCard = FarmCardFileSchema.parse(json("farm-card.json"));
const sms = SmsTemplatesFileSchema.parse(json("sms-templates.json"));
const recordings = RecordingsFileSchema.parse(json("recordings/recordings.json"));
const questions = parseTestQuestions(text("eval/test-questions.csv"));

describe("clips.json", () => {
  it("has clips 1 to 8, stops 1 to 7 and the held-back answer", () => {
    expect(clips.clips.map((c) => c.id)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    expect(clips.clips.filter((c) => c.kind === "stop")).toHaveLength(7);
    const eight = clips.clips.find((c) => c.id === 8);
    expect(eight).toMatchObject({ kind: "answer", published: false });
  });

  it("keeps the English script as the expected text", () => {
    expect(clips.clips[0]?.script.en).toMatch(/^Welcome to my farm\. I'm Noor\./);
    expect(clips.clips[3]?.script.en).toContain("Ondera Coffee Cooperative");
    expect(clips.clips[4]?.script.en).not.toMatch(/meal|lunch|eat/i); // clip 5 does not imply a meal
    expect(clips.clips[6]?.script.en).toContain("we'll stay down here"); // clip 7
  });
});

describe("recordings", () => {
  const files = new Set(recordings.recordings.map((r) => r.file));

  it("has an English and a Wolof recording for every clip", () => {
    for (const clip of clips.clips) {
      const n = String(clip.id).padStart(2, "0");
      expect(files.has(`en/clip${n}.m4a`), `en clip ${n}`).toBe(true);
      expect(files.has(`wo/clip${n}_wo.flac`), `wo clip ${n}`).toBe(true);
    }
  });

  it("labels every Wolof recording AI-dubbed, draft and demo-only", () => {
    const wo = recordings.recordings.filter((r) => r.lang === "wo");
    expect(wo).toHaveLength(8);
    expect(wo.every((r) => r.kind === "ai-dubbed" && r.demoOnly)).toBe(true);
  });

  it("has an audit row for every recording, mono-ready and at -16 LUFS", () => {
    const report = json("recordings/audio-report.json") as {
      clips: Record<
        string,
        { lufs: number; true_peak: number; head_silence_s: number; tail_silence_s: number }
      >;
    };
    expect(Object.keys(report.clips).sort()).toEqual([...files].sort());
    for (const [file, row] of Object.entries(report.clips)) {
      expect(Math.abs(row.lufs + 16), `${file} LUFS`).toBeLessThanOrEqual(1);
      expect(row.true_peak, `${file} true peak`).toBeLessThanOrEqual(-1.0);
      expect(row.head_silence_s, `${file} head`).toBeLessThanOrEqual(0.5);
      expect(row.tail_silence_s, `${file} tail`).toBeLessThanOrEqual(0.5);
    }
  });

  it("keeps the audio out of git (consent covers dubbing, not publishing)", () => {
    const gitignore = readFileSync(join(DIR, "..", "..", ".gitignore"), "utf8");
    expect(gitignore).toContain("content/**/recordings/en/");
    expect(gitignore).toContain("content/**/recordings/wo/");
    expect(gitignore).toContain("pipeline/build/");
    expect(gitignore.split("\n")).toContain(".env"); // pipeline/.env holds the ElevenLabs key
  });
});

describe("checks.json", () => {
  const ids = new Set([
    ...clips.clips.map((c) => `clip-${c.id}`),
    ...facts.facts.map((f) => f.id),
    recipe.id,
    ...products.products.map((p) => p.id),
    farmCard.id,
  ]);

  it("points only at things that exist", () => {
    for (const { id } of checks.checks) expect(ids.has(id.split("/")[0] ?? ""), id).toBe(true);
  });

  it("checks nothing in Wolof, German, Dutch or Swedish (those are drafts)", () => {
    for (const c of checks.checks)
      expect(c.checked && /\/(wo|de|nl|sv)$/.test(c.id), c.id).toBe(false);
  });

  it("lists every English clip subtitle for Preet", () => {
    for (const clip of clips.clips) {
      expect(
        checks.checks.some((c) => c.id === `clip-${clip.id}/subtitles/en`),
        `clip ${clip.id}`,
      ).toBe(true);
    }
  });
});

describe("add-ons", () => {
  it("are all drafts that still need something, so none can reach a production pack yet", () => {
    const addons = toAddons({ facts, recipe, products, farmCard }, checks);
    expect(addons).toHaveLength(facts.facts.length + 1 + products.products.length + 1);
    expect(addons.filter((a) => a.kind === "fact").every((a) => a.needs?.includes("source"))).toBe(
      true,
    );
    expect(
      addons.filter((a) => a.kind === "product").every((a) => a.needs?.includes("price")),
    ).toBe(true);
    expect(addons.find((a) => a.kind === "farm-card")?.needs).toEqual(["phone"]);
    expect(addons.some((a) => a.checked)).toBe(false);
  });

  it("give the recipe its four steps", () => {
    expect(recipe.steps).toHaveLength(4);
  });
});

describe("sms-templates.json", () => {
  const longest =
    THEME_IDS.map((id) => sms.themeLabels[id].en).sort((a, b) => b.length - a.length)[0] ?? "";
  const label = { text: longest, checked: true };

  it("fills the English monthly text through fillTemplate in at most two segments, even with the longest labels", () => {
    const counts = { guests: 999, orders: 999, items: 999, askedCount: 999 };
    const result = fillTemplate(sms.monthly.en, counts, {
      loved: label,
      asked: label,
      wished: label,
    });
    expect(result.segments).toBeLessThanOrEqual(2);
    expect(result.encoding).toBe("gsm7");
  });

  it("has no Wolof text yet (the NLLB step drafts it, a Wolof speaker checks it)", () => {
    expect(sms.monthly.wo.text).toBeNull();
    expect(sms.orderLine.wo.text).toBeNull();
    for (const id of THEME_IDS) expect(sms.themeLabels[id].wo.text).toBeNull();
  });
});

describe("eval/test-questions.csv", () => {
  const clipIds = new Set(clips.clips.map((c) => `clip${String(c.id).padStart(2, "0")}`));
  const byLang = (lang: string) => questions.filter((q) => q.lang === lang);

  it("has at least 100 synthetic questions and at least 25 that Noor never answers", () => {
    expect(questions.length).toBeGreaterThanOrEqual(100);
    expect(questions.filter((q) => q.expected === "none").length).toBeGreaterThanOrEqual(25);
  });

  it("covers every language, variant and answered clip", () => {
    for (const lang of VISITOR_LANGS) {
      expect(byLang(lang).length, lang).toBeGreaterThanOrEqual(25);
      for (const variant of ["plain", "paraphrase", "typo"]) {
        expect(
          byLang(lang).some((q) => q.variant === variant),
          `${lang} ${variant}`,
        ).toBe(true);
      }
      expect(
        byLang(lang).some((q) => q.expected === "safety"),
        `${lang} safety`,
      ).toBe(true);
      for (const id of clipIds)
        expect(
          byLang(lang).some((q) => q.expected === id),
          `${lang} ${id}`,
        ).toBe(true);
    }
  });

  it("only points at clips that exist, with unique ids", () => {
    for (const q of questions) {
      expect(
        q.expected === "none" || q.expected === "safety" || clipIds.has(q.expected),
        q.id,
      ).toBe(true);
    }
    expect(new Set(questions.map((q) => q.id)).size).toBe(questions.length);
  });

  it("sends every safety question to the safety card and no other question", () => {
    for (const q of questions) {
      expect(decideSafety(q.question), `${q.id} [${q.lang}] ${q.question}`).toBe(
        q.expected === "safety",
      );
    }
  });

  it("holds no email addresses or phone numbers", () => {
    for (const q of questions) expect(redact(q.question), q.id).toBe(q.question);
  });
});
