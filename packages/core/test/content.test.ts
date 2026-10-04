import { describe, expect, it } from "vitest";
import {
  type AddonContent,
  type ChecksFile,
  ChecksFileSchema,
  ClipSourceSchema,
  ClipsFileSchema,
  FactsFileSchema,
  FarmCardFileSchema,
  ProductsFileSchema,
  parseTestQuestions,
  RecipeFileSchema,
  RecordingsFileSchema,
  SmsTemplatesFileSchema,
  toAddons,
} from "../src/content.ts";
import { FarmPackManifestSchema } from "../src/schemas.ts";
import { THEME_IDS } from "../src/types.ts";

const ok = (schema: { safeParse: (x: unknown) => { success: boolean } }, value: unknown) =>
  schema.safeParse(value).success;

const clip = (over: object = {}) => ({
  id: 3,
  kind: "stop",
  stopCode: "NOOR-STOP-3",
  published: true,
  momentId: "c3-m1",
  script: { en: "We roast in a pan." },
  topic: { en: "roasting the coffee", de: "das Rösten", nl: "het roosteren", sv: "rostningen" },
  draft: { de: true, nl: true, sv: true },
  ...over,
});

describe("clips.json", () => {
  it("accepts a stop clip and a held-back answer clip", () => {
    expect(ok(ClipSourceSchema, clip())).toBe(true);
    const answer = clip({
      id: 8,
      kind: "answer",
      stopCode: undefined,
      published: false,
      momentId: "c8-m1",
    });
    expect(ok(ClipSourceSchema, answer)).toBe(true);
  });

  it("requires the stop code and moment id to match the clip id", () => {
    expect(ok(ClipSourceSchema, clip({ stopCode: "NOOR-STOP-4" }))).toBe(false);
    expect(ok(ClipSourceSchema, clip({ stopCode: undefined }))).toBe(false);
    expect(ok(ClipSourceSchema, clip({ momentId: "c4-m1" }))).toBe(false);
  });

  it("gives an answer clip no stop code and lets only an answer clip be held back", () => {
    expect(ok(ClipSourceSchema, clip({ kind: "answer" }))).toBe(false);
    expect(ok(ClipSourceSchema, clip({ published: false }))).toBe(false);
  });

  it("needs a topic in all four languages, all marked draft", () => {
    expect(ok(ClipSourceSchema, clip({ topic: { en: "x", de: "x", nl: "x" } }))).toBe(false);
    expect(ok(ClipSourceSchema, clip({ draft: { de: true, nl: true, sv: false } }))).toBe(false);
    expect(ok(ClipSourceSchema, clip({ draft: { de: true, nl: true } }))).toBe(false);
  });

  it("rejects unknown fields and duplicate clip ids", () => {
    expect(ok(ClipSourceSchema, clip({ extra: 1 }))).toBe(false);
    expect(ok(ClipsFileSchema, { farmSlug: "ondera-noor", clips: [clip(), clip()] })).toBe(false);
    expect(ok(ClipsFileSchema, { farmSlug: "Bad Slug", clips: [clip()] })).toBe(false);
    expect(ok(ClipsFileSchema, { farmSlug: "ondera-noor", clips: [] })).toBe(false);
  });
});

describe("recordings.json", () => {
  const en = {
    clip: 1,
    lang: "en",
    file: "en/clip01.m4a",
    person: "Preet Patel",
    kind: "stand-in-voice",
    label: "Stand-in for Noor's voice (recorded by Preet Patel)",
  };
  const wo = {
    clip: 1,
    lang: "wo",
    file: "wo/clip01_wo.flac",
    person: "Preet Patel",
    kind: "ai-dubbed",
    label: "AI-dubbed (ElevenLabs)",
    status: "draft",
    demoOnly: true,
    consentPerson: "Preet Patel",
  };
  const file = (...recordings: object[]) => ({ farmSlug: "ondera-noor", recordings });

  it("accepts an English stand-in and a labeled, draft, demo-only AI dub", () => {
    expect(ok(RecordingsFileSchema, file(en, wo))).toBe(true);
  });

  it("refuses an AI dub that is not labeled, not draft, not demo-only or has no consent person", () => {
    for (const bad of [
      { ...wo, label: "Wolof" },
      { ...wo, status: "checked" },
      { ...wo, demoOnly: false },
      { ...wo, consentPerson: undefined },
    ]) {
      expect(ok(RecordingsFileSchema, file(bad))).toBe(false);
    }
  });

  it("refuses a dub cleared by someone else's consent and a stand-in label that is not one", () => {
    expect(ok(RecordingsFileSchema, file({ ...wo, consentPerson: "Someone Else" }))).toBe(false);
    expect(ok(RecordingsFileSchema, file({ ...en, label: "Noor" }))).toBe(false);
  });

  it("refuses odd file paths, an English file marked as a dub and unknown fields", () => {
    expect(ok(RecordingsFileSchema, file({ ...en, file: "../x.m4a" }))).toBe(false);
    expect(ok(RecordingsFileSchema, file({ ...en, kind: "ai-dubbed" }))).toBe(false);
    expect(ok(RecordingsFileSchema, file({ ...en, extra: 1 }))).toBe(false);
  });
});

describe("checks.json", () => {
  const sha = "a".repeat(64);
  it("accepts unchecked entries and a signed checked entry", () => {
    expect(ok(ChecksFileSchema, { checks: [{ id: "clip-1/subtitles/en", checked: false }] })).toBe(
      true,
    );
    const signed = {
      id: "clip-1/subtitles/en",
      checked: true,
      by: "Preet Patel",
      at: "2026-10-03T22:00:00Z",
      transcriptSha256: sha,
    };
    expect(ok(ChecksFileSchema, { checks: [signed] })).toBe(true);
  });

  it("refuses a checked entry without who and when", () => {
    expect(ok(ChecksFileSchema, { checks: [{ id: "recipe", checked: true }] })).toBe(false);
    expect(
      ok(ChecksFileSchema, { checks: [{ id: "recipe", checked: true, by: "Preet Patel" }] }),
    ).toBe(false);
  });

  it("rejects duplicate ids, bad ids and a malformed hash", () => {
    const e = { id: "recipe", checked: false };
    expect(ok(ChecksFileSchema, { checks: [e, e] })).toBe(false);
    expect(ok(ChecksFileSchema, { checks: [{ id: "Bad Id", checked: false }] })).toBe(false);
    expect(ok(ChecksFileSchema, { checks: [{ ...e, transcriptSha256: "abc" }] })).toBe(false);
  });
});

const facts = {
  facts: [{ id: "fact-1", afterClip: 2, text: { en: "Two seeds." }, needs: ["source"] }],
};
const recipe = {
  id: "recipe",
  title: { en: "Spiced farm coffee" },
  steps: [{ en: "Grind." }, { en: "Pour." }],
  noorConfirmsBeforeGuestsSee: true,
};
const products = {
  products: [
    { id: "beans-250", name: { en: "Roasted beans 250 g" }, currency: "GMD", needs: ["price"] },
    { id: "kit", name: { en: "Recipe kit" }, price: 500, currency: "GMD" },
  ],
};
const farmCard = { id: "farm-card", lines: [{ en: "Call or text to order." }], needs: ["phone"] };
const content = (): AddonContent => ({
  facts: FactsFileSchema.parse(facts),
  recipe: RecipeFileSchema.parse(recipe),
  products: ProductsFileSchema.parse(products),
  farmCard: FarmCardFileSchema.parse(farmCard),
});

describe("add-on content files", () => {
  it("accepts gaps declared in needs", () => {
    expect(ok(FactsFileSchema, facts)).toBe(true);
    expect(ok(ProductsFileSchema, products)).toBe(true);
    expect(ok(FarmCardFileSchema, farmCard)).toBe(true);
  });

  it("rejects a fact with neither a source nor needs", () => {
    expect(ok(FactsFileSchema, { facts: [{ id: "f", afterClip: 2, text: { en: "x" } }] })).toBe(
      false,
    );
    expect(
      ok(FactsFileSchema, {
        facts: [{ id: "f", afterClip: 2, text: { en: "x" }, source: "ICO", needs: ["source"] }],
      }),
    ).toBe(false);
  });

  it("rejects a product with neither a price nor needs, and a farm card with neither a phone nor needs", () => {
    const bad = { products: [{ id: "p", name: { en: "x" }, currency: "GMD" }] };
    expect(ok(ProductsFileSchema, bad)).toBe(false);
    expect(ok(FarmCardFileSchema, { id: "farm-card", lines: [{ en: "x" }] })).toBe(false);
  });

  it("requires Noor's confirmation flag on the recipe and at least one step", () => {
    expect(ok(RecipeFileSchema, { ...recipe, noorConfirmsBeforeGuestsSee: false })).toBe(false);
    expect(ok(RecipeFileSchema, { ...recipe, steps: [] })).toBe(false);
  });

  it("never lets a content file claim to be checked", () => {
    expect(ok(FactsFileSchema, { facts: [{ ...facts.facts[0], checked: true }] })).toBe(false);
  });
});

describe("toAddons", () => {
  const unchecked: ChecksFile = { checks: [] };

  it("maps every file to manifest add-ons, all unchecked without checks.json entries", () => {
    const addons = toAddons(content(), unchecked);
    expect(addons.map((a) => a.id)).toEqual(["fact-1", "recipe", "beans-250", "kit", "farm-card"]);
    expect(addons.every((a) => !a.checked)).toBe(true);
    expect(addons.find((a) => a.id === "recipe")?.text.en).toBe(
      "Spiced farm coffee\n1. Grind.\n2. Pour.",
    );
  });

  it("takes `checked` only from a checked entry in checks.json", () => {
    const checks: ChecksFile = {
      checks: [
        { id: "recipe", checked: true, by: "Preet Patel", at: "2026-10-03T22:00:00Z" },
        { id: "kit", checked: false },
      ],
    };
    const byId = Object.fromEntries(toAddons(content(), checks).map((a) => [a.id, a.checked]));
    expect(byId).toMatchObject({ recipe: true, kit: false, "fact-1": false });
  });

  it("carries needs through, so a demo pack shows the labels and a production pack refuses them", () => {
    const addons = toAddons(content(), unchecked);
    expect(addons.find((a) => a.id === "fact-1")?.needs).toEqual(["source"]);
    expect(addons.find((a) => a.id === "kit")?.needs).toBeUndefined();
    const base = {
      packId: "p",
      farmId: "7c9e6679-7425-40de-944b-e07fc1f90ae7",
      farmSlug: "ondera-noor",
      version: 1,
      createdAt: "2026-10-03T20:15:00Z",
      noorLang: "wo",
      visitorLangs: ["en"],
      clips: [],
      moments: [],
      addons,
      model: {
        id: "multilingual-e5-small",
        dir: "m",
        dim: 384,
        quantization: "int8",
        vocab: "full",
        sizeBytes: 1,
      },
      embeddings: { file: "e", count: 0, dim: 384, dtype: "float32" },
      thresholds: { match: 0.8, margin: 0.05 },
      sizes: {},
      checksums: {},
      labels: { standIn: [], syntheticVoice: [] },
    };
    expect(ok(FarmPackManifestSchema, { ...base, mode: "demo" })).toBe(true);
    expect(ok(FarmPackManifestSchema, { ...base, mode: "production" })).toBe(false);
  });
});

describe("sms-templates.json", () => {
  const label = (en: string) => ({ en, wo: { text: null, status: "needs-nllb-draft" } });
  const file = () => ({
    monthly: {
      en: "This month: {guests} guests shared feedback. {orders} orders ({items} items). Loved: {loved}. Most asked: {asked} ({askedCount}). Most wished for: {wished}.",
      wo: { text: null, status: "needs-nllb-draft" },
    },
    orderLine: {
      en: "Order: {items} items, {total} {currency}.",
      wo: { text: null, status: "needs-nllb-draft" },
    },
    themeLabels: Object.fromEntries(THEME_IDS.map((id) => [id, label(id)])),
  });

  it("accepts English templates with Wolof still to be drafted", () => {
    expect(ok(SmsTemplatesFileSchema, file())).toBe(true);
  });

  it("accepts a Wolof draft once it has text, and rejects text with the wrong status or a status without text", () => {
    const f = file();
    expect(
      ok(SmsTemplatesFileSchema, {
        ...f,
        monthly: { ...f.monthly, wo: { text: "draft", status: "draft" } },
      }),
    ).toBe(true);
    expect(
      ok(SmsTemplatesFileSchema, {
        ...f,
        monthly: { ...f.monthly, wo: { text: "x", status: "needs-nllb-draft" } },
      }),
    ).toBe(false);
    expect(
      ok(SmsTemplatesFileSchema, {
        ...f,
        monthly: { ...f.monthly, wo: { text: null, status: "draft" } },
      }),
    ).toBe(false);
  });

  it("allows no Wolof status that claims a check (checks.json is the only place)", () => {
    const f = file();
    expect(
      ok(SmsTemplatesFileSchema, {
        ...f,
        monthly: { ...f.monthly, wo: { text: "x", status: "checked" } },
      }),
    ).toBe(false);
  });

  it("rejects unknown placeholders and unbalanced braces", () => {
    const f = file();
    expect(ok(SmsTemplatesFileSchema, { ...f, monthly: { ...f.monthly, en: "Hi {name}" } })).toBe(
      false,
    );
    expect(ok(SmsTemplatesFileSchema, { ...f, monthly: { ...f.monthly, en: "{guests" } })).toBe(
      false,
    );
    expect(
      ok(SmsTemplatesFileSchema, { ...f, orderLine: { ...f.orderLine, en: "{guests} guests" } }),
    ).toBe(false);
  });

  it("needs a label for every theme", () => {
    const f = file();
    const { wifi: _w, ...rest } = f.themeLabels;
    expect(ok(SmsTemplatesFileSchema, { ...f, themeLabels: rest })).toBe(false);
  });
});

describe("parseTestQuestions", () => {
  const H = "id,lang,question,expected,variant,synthetic\n";
  it("parses rows, including quoted commas and doubled quotes", () => {
    const rows = parseTestQuestions(
      `${H}q001,en,"Is it hot, or cold?",clip03,plain,true\nq002,de,"Er sagte ""Hallo""",none,paraphrase,true\n`,
    );
    expect(rows.map((r) => r.question)).toEqual(["Is it hot, or cold?", 'Er sagte "Hallo"']);
    expect(rows[1]).toMatchObject({ lang: "de", expected: "none", variant: "paraphrase" });
  });

  it("handles CRLF line endings and blank lines", () => {
    const rows = parseTestQuestions(`${H.trimEnd()}\r\n\r\nq001,en,Hello,safety,typo,true\r\n\r\n`);
    expect(rows).toHaveLength(1);
  });

  it("handles a quoted field with a newline inside", () => {
    expect(parseTestQuestions(`${H}q001,en,"two\nlines",none,plain,true`)[0]?.question).toBe(
      "two\nlines",
    );
  });

  it("throws on a wrong header, a short row, an unknown expected value and synthetic other than true", () => {
    expect(() => parseTestQuestions("id,lang\nq001,en")).toThrow(/header/);
    expect(() => parseTestQuestions(`${H}q001,en,Hello`)).toThrow(/row 2 has 3 fields/);
    expect(() => parseTestQuestions(`${H}q001,en,Hello,maybe,plain,true`)).toThrow(/row 2/);
    expect(() => parseTestQuestions(`${H}q001,en,Hello,none,plain,false`)).toThrow(/row 2/);
    expect(() => parseTestQuestions(`${H}q001,fr,Hello,none,plain,true`)).toThrow(/row 2/);
  });

  it("throws on an unclosed quote", () => {
    expect(() => parseTestQuestions(`${H}q001,en,"oops,none,plain,true`)).toThrow(/quote/);
  });

  it("returns no rows for a header only", () => {
    expect(parseTestQuestions(H)).toEqual([]);
  });
});
