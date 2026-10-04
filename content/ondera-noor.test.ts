// Validates every content file in content/ondera-noor/ against the schemas in packages/core, and
// checks the things only the files together can show (clips, recordings, checks, questions).
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  assignSlots,
  ChecksFileSchema,
  ClipsFileSchema,
  decideSafety,
  FactsFileSchema,
  FarmCardFileSchema,
  fillTemplate,
  IndexPassagesFileSchema,
  leakageAudit,
  normalize,
  ProductsFileSchema,
  parseTestQuestions,
  RecipeFileSchema,
  RecordingsFileSchema,
  redact,
  SmsTemplatesFileSchema,
  splitSentences,
  THEME_IDS,
  toAddons,
  VISITOR_LANGS,
  WolofEvidenceSchema,
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
const indexFile = IndexPassagesFileSchema.parse(json("index-passages.json"));

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

  it("keeps the audio out of git (publishing consent covers the demo site, not the repository)", () => {
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

  it("has Wolof as NLLB machine drafts only: never marked checked, placeholders intact", () => {
    for (const entry of [
      sms.monthly,
      sms.orderLine,
      ...THEME_IDS.map((id) => sms.themeLabels[id]),
    ]) {
      expect(entry.wo.status).toBe("draft");
      expect(entry.wo.text).not.toBeNull();
    }
    const ph = (t: string) => [...t.matchAll(/\{[^{}]*\}/g)].map((m) => m[0]).sort();
    expect(ph(sms.monthly.wo.text ?? "")).toEqual(ph(sms.monthly.en));
    expect(ph(sms.orderLine.wo.text ?? "")).toEqual(ph(sms.orderLine.en));
  });

  it("fits the Wolof draft into two SMS segments by dropping the lowest-priority parts, and lists what it dropped", () => {
    // Before this step the NLLB draft needed 3 UCS-2 segments and was refused. It is still an
    // unchecked draft, so Noor's report stays held until a Wolof speaker checks it.
    const wo = sms.monthly.wo.text ?? "";
    const label = { text: sms.themeLabels.stay.wo.text ?? "", checked: true };
    const counts = { guests: 12, orders: 3, items: 5, askedCount: 4 };
    const r = fillTemplate(wo, counts, { loved: label, asked: label, wished: label });
    expect(r.segments).toBeLessThanOrEqual(2);
    expect(r.body).not.toMatch(/[{}]/);
    expect(r.body).toContain(String(counts.askedCount)); // the most important part is kept
    expect(sms.monthly.wo.status).toBe("draft");
  });

  it("fits the English monthly text, even with the longest labels, by dropping parts if it must", () => {
    const longest =
      THEME_IDS.map((id) => sms.themeLabels[id].en).sort((a, b) => b.length - a.length)[0] ?? "";
    const label = { text: longest, checked: true };
    const r = fillTemplate(
      sms.monthly.en,
      { guests: 999, orders: 999, items: 999, askedCount: 999 },
      { loved: label, asked: label, wished: label },
    );
    expect(r.segments).toBeLessThanOrEqual(2);
    expect(r.body).toContain("Most asked");
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

  it("are parallel across languages (slot i is the same question everywhere), so the honest split can be by slot", () => {
    const scored = questions.map((x) => ({
      id: x.id,
      lang: x.lang,
      variant: x.variant,
      expected: x.expected,
      safetyHit: false,
      results: [],
    }));
    const slots = assignSlots(scored); // throws if the languages are not parallel
    expect(new Set(slots).size).toBe(questions.length / 4);
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

describe("index-passages.json", () => {
  const flat = Object.entries(indexFile.clips).flatMap(([clip, byLang]) =>
    Object.entries(byLang).flatMap(([lang, texts]) => texts.map((t) => ({ clip, lang, text: t }))),
  );

  it("covers every clip in all four languages, with at least two phrasings each", () => {
    expect(Object.keys(indexFile.clips).sort()).toEqual(
      clips.clips.map((c) => String(c.id)).sort(),
    );
    for (const byLang of Object.values(indexFile.clips)) {
      for (const lang of VISITOR_LANGS) expect(byLang[lang].length).toBeGreaterThanOrEqual(2);
    }
  });

  it("is a draft that is never shown, labeled as such", () => {
    expect(indexFile.draft).toBe(true);
    expect(indexFile.neverShown).toBe(true);
    expect(indexFile.writer).toContain("isolated");
  });

  it("repeats no test question exactly (the audit removed those), and records what it removed", () => {
    const qs = questions.map((q) => ({ id: q.id, lang: q.lang, question: q.question }));
    expect(leakageAudit(flat, qs).exact).toEqual([]);
    for (const r of indexFile.removedAsDuplicates) {
      const q = questions.find((x) => x.id === r.questionId);
      expect(q, r.questionId).toBeDefined();
      expect(normalize(q?.question ?? "")).toBe(normalize(r.text)); // the record is true
    }
  });

  it("copies no sentence of a clip's script", () => {
    const script = new Set(clips.clips.flatMap((c) => splitSentences(c.script.en).map(normalize)));
    for (const p of flat.filter((x) => x.lang === "en"))
      expect(script.has(normalize(p.text)), p.text).toBe(false);
  });

  it("holds no email addresses or phone numbers", () => {
    for (const p of flat) expect(redact(p.text), p.text).toBe(p.text);
  });
});

describe("eval/wolof.json (Wolof evidence)", () => {
  const evidence = WolofEvidenceSchema.parse(json("eval/wolof.json"));

  it("records every sample size, so no number is reported without its n", () => {
    expect(evidence.flores?.n).toBeGreaterThanOrEqual(300);
    expect(evidence.fleurs?.n).toBe(100);
    expect(evidence.roundtrip?.n).toBe(8);
    for (const d of Object.values(evidence.flores?.directions ?? {}))
      expect(d.n).toBe(evidence.flores?.n);
  });

  it("covers English to Wolof and English to German on the same sentences, and Wolof back to English", () => {
    expect(Object.keys(evidence.flores?.directions ?? {}).sort()).toEqual([
      "eng_Latn to deu_Latn",
      "eng_Latn to wol_Latn",
      "wol_Latn to eng_Latn",
    ]);
  });

  it("round-trips all eight dubbed clips against Preet's own script", () => {
    const clipsById = new Map(clips.clips.map((c) => [c.id, c.script.en]));
    expect(evidence.roundtrip?.clips.map((c) => c.clip)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    for (const c of evidence.roundtrip?.clips ?? []) expect(c.script).toBe(clipsById.get(c.clip));
  });

  it("names the models and revisions it used, with their non-commercial licenses", () => {
    const v = evidence.versions as {
      nllb: { revision: string; license: string };
      mms: { revision: string; license: string };
    };
    expect(v.nllb.license).toBe("CC-BY-NC-4.0");
    expect(v.mms.license).toBe("CC-BY-NC-4.0");
    expect(v.nllb.revision).toMatch(/^[0-9a-f]{40}$/);
    expect(v.mms.revision).toMatch(/^[0-9a-f]{40}$/);
  });
});
