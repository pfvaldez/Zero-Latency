import { describe, expect, it } from "vitest";
import { parseConsent } from "../src/consent.ts";
import {
  type AddonContent,
  ChecksFileSchema,
  ClipsFileSchema,
  FactsFileSchema,
  FarmCardFileSchema,
  ProductsFileSchema,
  RecipeFileSchema,
  RecordingsFileSchema,
} from "../src/content.ts";
import {
  addonSentences,
  PackError,
  type PackInput,
  planPack,
  type Translations,
} from "../src/pack.ts";
import { FarmPackManifestSchema } from "../src/schemas.ts";
import { splitSentences } from "../src/vtt.ts";

// A fake hash: deterministic and different for different text. core cannot use Node's crypto.
const sha256 = (t: string): string => {
  let out = "";
  for (let seed = 0; seed < 8; seed++) {
    let h = 2166136261 ^ seed;
    for (const c of t) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
    out += (h >>> 0).toString(16).padStart(8, "0");
  }
  return out; // 64 hex characters, like a real sha256
};

const SCRIPT: Record<number, string> = {
  1: "Welcome to my farm. I'm Noor.",
  2: "We pick the cherries by hand. It is slow.",
  3: "We roast in a pan.",
  8: "We do not have rooms yet.",
};

const clip = (id: number, published = true) => ({
  id,
  kind: id === 8 ? "answer" : "stop",
  ...(id === 8 ? {} : { stopCode: `NOOR-STOP-${id}` }),
  published,
  momentId: `c${id}-m1`,
  script: { en: SCRIPT[id] as string },
  topic: { en: `topic ${id}`, de: `Thema ${id}`, nl: `onderwerp ${id}`, sv: `ämne ${id}` },
  draft: { de: true, nl: true, sv: true },
});

const recordings = RecordingsFileSchema.parse({
  farmSlug: "ondera-noor",
  recordings: [1, 2, 3, 8].flatMap((n) => [
    {
      clip: n,
      lang: "en",
      file: `en/clip0${n}.m4a`,
      person: "Preet Patel",
      kind: "stand-in-voice",
      label: "Stand-in for Noor's voice (recorded by Preet Patel)",
    },
    {
      clip: n,
      lang: "wo",
      file: `wo/clip0${n}_wo.flac`,
      person: "Preet Patel",
      kind: "ai-dubbed",
      label: "AI-dubbed (ElevenLabs)",
      status: "draft",
      demoOnly: true,
      consentPerson: "Preet Patel",
    },
  ]),
});

const addonContent: AddonContent = {
  facts: FactsFileSchema.parse({
    facts: [{ id: "fact-1", afterClip: 2, text: { en: "Two seeds." }, needs: ["source"] }],
  }),
  recipe: RecipeFileSchema.parse({
    id: "recipe",
    title: { en: "Spiced coffee" },
    steps: [{ en: "Grind." }, { en: "Pour." }],
    noorConfirmsBeforeGuestsSee: true,
  }),
  products: ProductsFileSchema.parse({
    products: [
      { id: "kit", name: { en: "Recipe kit" }, price: 500, currency: "GMD" },
      { id: "beans", name: { en: "Beans" }, currency: "GMD", needs: ["price"] },
    ],
  }),
  farmCard: FarmCardFileSchema.parse({
    id: "farm-card",
    lines: [{ en: "Call us." }],
    phone: "+220 000 0000",
  }),
};

const signed = (id: string, extra: object = {}) => ({
  id,
  checked: true,
  by: "Preet Patel",
  at: "2026-10-04T01:00:00Z",
  ...extra,
});
const CONSENT_ALL = parseConsent(
  `| Person | What they consented to | Where | Date | Status |\n|---|---|---|---|---|\n` +
    `| Preet Patel | AI dubbing of her English recordings | Discord | 2026-10-03 | confirmed |\n` +
    `| Preet Patel | Publishing: the demo app and video | Discord | 2026-10-04 | confirmed |\n`,
);
const CONSENT_NO_PUBLISHING = parseConsent(
  `| Person | What they consented to | Where | Date | Status |\n|---|---|---|---|---|\n` +
    `| Preet Patel | AI dubbing of her English recordings | Discord | 2026-10-03 | confirmed |\n` +
    `| Preet Patel | Publishing: the demo app and video | not yet | not yet | pending |\n`,
);

function translationsFor(): Translations {
  const out: Translations = {};
  for (const id of [1, 2, 3, 8]) {
    const en = splitSentences(SCRIPT[id] as string);
    out[String(id)] = {
      sourceSha256: sha256(en.join("\n")),
      sentences: en.map((s) => ({
        en: s,
        de: `de:${s}`,
        nl: `nl:${s}`,
        sv: `sv:${s}`,
        wo: `wo:${s}`,
      })),
    };
  }
  return out;
}
function addonTranslations(): Translations {
  const out: Translations = {};
  for (const [id, en] of Object.entries(addonSentences(addonContent))) {
    out[id] = {
      sourceSha256: sha256(en.join("\n")),
      sentences: en.map((s) => ({
        en: s,
        de: `de:${s}`,
        nl: `nl:${s}`,
        sv: `sv:${s}`,
        wo: `wo:${s}`,
      })),
    };
  }
  return out;
}

const META = { durationMs: 8000, headSilenceMs: 120, tailSilenceMs: 300 };
function input(over: Partial<PackInput> = {}): PackInput {
  return {
    clips: ClipsFileSchema.parse({
      farmSlug: "ondera-noor",
      clips: [clip(1), clip(2), clip(3), clip(8, false)],
    }),
    checks: ChecksFileSchema.parse({ checks: [] }),
    addonContent,
    recordings,
    audio: Object.fromEntries(recordings.recordings.map((r) => [r.file, META])),
    transcripts: new Map(),
    clipTranslations: translationsFor(),
    addonTranslations: addonTranslations(),
    consent: CONSENT_ALL,
    sha256,
    ...over,
  };
}

// Everything checked: English subtitles for clips 1 and 2 (clip 3 stays unchecked), the recipe and a product.
const CHECKED = ChecksFileSchema.parse({
  checks: [
    signed("clip-1/subtitles/en"),
    signed("clip-2/subtitles/en"),
    signed("clip-1/subtitles/de", { transcriptSha256: "a".repeat(64) }),
    signed("recipe"),
    signed("kit"),
    signed("beans"),
    signed("farm-card"),
  ],
});

const ids = (p: ReturnType<typeof planPack>) => p.clips.map((c) => c.id);

describe("production pack", () => {
  const plan = () => planPack(input({ checks: CHECKED }), "production");

  it("contains only clips with checked English text", () => {
    expect(ids(plan())).toEqual([1, 2]); // clip 3 is unchecked, clip 8 is held back
    expect(plan().excluded).toContainEqual({ what: "clip 3", why: "no checked English text" });
  });

  it("excludes the held-back clip", () => {
    expect(ids(plan())).not.toContain(8);
    expect(plan().excluded.some((e) => e.what === "clip 8")).toBe(true);
  });

  it("excludes every draft language: no de, nl, sv or wo text, and no draft flags", () => {
    const p = plan();
    for (const m of p.moments) {
      expect(Object.keys(m.subtitles)).toEqual(["en"]);
      expect(Object.keys(m.topic)).toEqual(["en"]);
      expect(m.draft).toBeUndefined();
    }
    expect(p.passages.every((x) => x.lang === "en")).toBe(true);
    expect(p.visitorLangs).toEqual(["en"]);
    expect(p.files.some((f) => /\.(de|nl|sv|wo)\.vtt$/.test(f.dest))).toBe(false);
  });

  it("excludes AI-dubbed audio: no clip.dubbed, no aiDubbed label, no Wolof file", () => {
    const p = plan();
    expect(p.clips.every((c) => c.dubbed === undefined)).toBe(true);
    expect(p.labels.aiDubbed).toEqual([]);
    expect(p.files.some((f) => f.dest.includes("_wo"))).toBe(false);
    expect(p.excluded.filter((e) => e.why.includes("demo-only")).length).toBe(2);
  });

  it("includes only checked add-ons without needs", () => {
    const p = plan();
    expect(p.addons.map((a) => a.id).sort()).toEqual(["farm-card", "kit", "recipe"]); // beans needs a price, fact-1 is unchecked
    expect(p.addons.every((a) => a.checked && !a.needs?.length)).toBe(true);
    expect(p.addons.every((a) => Object.keys(a.text).join() === "en")).toBe(true);
  });

  it("allows the disclosed stand-in voice, listed in labels.standInVoice, and no other stand-in", () => {
    const p = plan();
    expect(p.labels.standInVoice).toEqual([
      { person: "Preet", files: ["audio/clip01.m4a", "audio/clip02.m4a"] },
    ]);
    expect(p.labels.standIn).toEqual([]);
  });

  it("includes a draft language only once that language is checked against the same translation", () => {
    const t = translationsFor();
    const good = ChecksFileSchema.parse({
      checks: [
        signed("clip-1/subtitles/en"),
        signed("clip-1/subtitles/de", {
          transcriptSha256: (t["1"] as { sourceSha256: string }).sourceSha256,
        }),
      ],
    });
    const p = planPack(input({ checks: good }), "production");
    expect(p.moments[0]?.subtitles.de).toBe("de:Welcome to my farm. de:I'm Noor.");
    expect(p.moments[0]?.draft).toBeUndefined();
    // A check bound to some other text does not count.
    expect(
      planPack(input({ checks: CHECKED }), "production").moments[0]?.subtitles.de,
    ).toBeUndefined();
  });

  it("is empty today: nothing is checked yet", () => {
    const p = planPack(input(), "production");
    expect(p.clips).toEqual([]);
    expect(p.moments).toEqual([]);
    expect(p.labels.standInVoice).toEqual([]);
  });

  it("brings a clip in the moment its English check matches the transcript hash", () => {
    const transcript = {
      text: "Welcome to my farm. I am Noor.",
      sha256: "1".repeat(64),
      words: [
        { text: "Welcome", start: 0.1, end: 0.5 },
        { text: "to", start: 0.5, end: 0.6 },
        { text: "my", start: 0.6, end: 0.7 },
        { text: "farm.", start: 0.7, end: 1.1 },
        { text: "I", start: 1.3, end: 1.4 },
        { text: "am", start: 1.4, end: 1.6 },
        { text: "Noor.", start: 1.6, end: 2.0 },
      ],
    };
    const base = {
      transcripts: new Map([[1, transcript]]),
      clipTranslations: null,
      addonTranslations: null,
    };
    const stale = ChecksFileSchema.parse({
      checks: [signed("clip-1/subtitles/en", { transcriptSha256: "2".repeat(64) })],
    });
    const fresh = ChecksFileSchema.parse({
      checks: [signed("clip-1/subtitles/en", { transcriptSha256: "1".repeat(64) })],
    });
    expect(ids(planPack(input({ ...base, checks: stale }), "production"))).toEqual([]);
    const p = planPack(input({ ...base, checks: fresh }), "production");
    expect(ids(p)).toEqual([1]);
    expect(p.moments[0]?.timing).toBe("word-timestamps");
    expect(p.moments[0]?.subtitles.en).toBe("Welcome to my farm. I am Noor.");
  });

  it("validates as a production manifest once the builder adds the embedding facts", () => {
    const p = planPack(input({ checks: CHECKED }), "production");
    const manifest = {
      packId: "t",
      farmId: "7c9e6679-7425-40de-944b-e07fc1f90ae7",
      farmSlug: "ondera-noor",
      version: 1,
      mode: "production",
      createdAt: "2026-10-04T01:00:00Z",
      noorLang: "wo",
      visitorLangs: p.visitorLangs,
      clips: p.clips,
      moments: p.moments,
      addons: p.addons,
      model: {
        id: "multilingual-e5-small",
        dir: "model/multilingual-e5-small",
        source: "Xenova/multilingual-e5-small",
        revision: "761b726dd34fb83930e26aab4e9ac3899aa1fa78",
        queryPrefix: "query: ",
        dim: 384,
        quantization: "int8",
        vocab: "full",
        sizeBytes: 1,
      },
      embeddings: {
        file: "embeddings.f32",
        count: p.passages.length,
        dim: 384,
        dtype: "float32",
        passagePrefix: "passage: ",
        rows: p.passages.map((x) => ({ momentId: x.momentId, lang: x.lang })),
      },
      thresholds: { match: 0.85, margin: 0.05 },
      sizes: {},
      checksums: {},
      labels: p.labels,
    };
    expect(FarmPackManifestSchema.safeParse(manifest).success).toBe(true);
  });
});

describe("demo pack", () => {
  const plan = () => planPack(input({ checks: CHECKED }), "demo");

  it("includes unchecked clips, labeled as drafts, but still not the held-back clip", () => {
    expect(ids(plan())).toEqual([1, 2, 3]);
    const m3 = plan().moments.find((m) => m.clipId === 3);
    expect(m3?.draft).toMatchObject({ en: true, de: true, nl: true, sv: true });
    const m1 = plan().moments.find((m) => m.clipId === 1);
    expect(m1?.draft?.en).toBe(false); // checked
  });

  it("includes the draft translations and embeds a passage for each language", () => {
    const p = plan();
    expect(p.visitorLangs).toEqual(["en", "de", "nl", "sv"]);
    expect(p.passages.filter((x) => x.momentId === "c1-m1").map((x) => x.lang)).toEqual([
      "en",
      "de",
      "nl",
      "sv",
    ]);
    expect(p.files.map((f) => f.dest)).toContain("subtitles/clip01.de.vtt");
  });

  it("includes the AI-dubbed Wolof version, labeled, with its machine-translation subtitles", () => {
    const p = plan();
    const c1 = p.clips.find((c) => c.id === 1);
    expect(c1?.dubbed).toMatchObject({
      lang: "wo",
      audio: "audio/clip01_wo.m4a",
      label: "AI-dubbed (ElevenLabs)",
      subtitles: "subtitles/clip01.wo.vtt",
    });
    expect(p.labels.aiDubbed).toEqual([
      "audio/clip01_wo.m4a",
      "audio/clip02_wo.m4a",
      "audio/clip03_wo.m4a",
    ]);
    const vtt = p.files.find((f) => f.dest === "subtitles/clip01.wo.vtt");
    expect(JSON.stringify(vtt)).toContain("NOT a transcript of what the AI-dubbed audio says");
  });

  it("includes needy and unchecked add-ons, with needs kept so the player can label them", () => {
    const p = plan();
    expect(p.addons.map((a) => a.id)).toEqual(["fact-1", "recipe", "kit", "beans", "farm-card"]);
    expect(p.addons.find((a) => a.id === "fact-1")?.needs).toEqual(["source"]);
    expect(p.addons.find((a) => a.id === "beans")?.needs).toEqual(["price"]);
    expect(p.addons.find((a) => a.id === "recipe")?.text.de).toBe(
      "de:Spiced coffee\n1. de:Grind.\n2. de:Pour.",
    );
  });

  it("times the subtitles from the script and says so", () => {
    const p = plan();
    expect(p.moments.every((m) => m.timing === "estimated")).toBe(true);
    const vtt = p.files.find((f) => f.dest === "subtitles/clip01.en.vtt");
    expect(JSON.stringify(vtt)).toContain("timing estimated from the script");
  });

  it("includes the held-back clip only with --publish, and then it is a normal clip", () => {
    const p = planPack(input({ checks: CHECKED }), "demo", { publish: [8] });
    expect(ids(p)).toEqual([1, 2, 3, 8]);
    expect(p.clips.find((c) => c.id === 8)?.kind).toBe("answer");
  });
});

describe("both modes", () => {
  it("never include the held-back clip without --publish", () => {
    for (const mode of ["demo", "production"] as const)
      expect(ids(planPack(input({ checks: CHECKED }), mode))).not.toContain(8);
  });

  it("refuse a recording of Preet unless her publishing row is confirmed", () => {
    for (const mode of ["demo", "production"] as const) {
      expect(() =>
        planPack(input({ checks: CHECKED, consent: CONSENT_NO_PUBLISHING }), mode),
      ).toThrow(PackError);
      expect(() =>
        planPack(input({ checks: CHECKED, consent: CONSENT_NO_PUBLISHING }), mode),
      ).toThrow(/publishing/);
    }
  });

  it("refuse any pack with a recording when there is no consent row at all", () => {
    expect(() => planPack(input({ checks: CHECKED, consent: [] }), "demo")).toThrow(
      /no consent row/,
    );
  });

  it("need the dubbing row too before a dub goes into a demo pack", () => {
    const onlyPublishing = parseConsent(
      `| Person | What they consented to | Where | Date | Status |\n|---|---|---|---|---|\n| Preet Patel | Publishing: the demo app | x | x | confirmed |\n`,
    );
    expect(() => planPack(input({ checks: CHECKED, consent: onlyPublishing }), "demo")).toThrow(
      /dubbing/,
    );
    // ...but the production pack has no dub, so the publishing row alone is enough.
    expect(
      ids(planPack(input({ checks: CHECKED, consent: onlyPublishing }), "production")),
    ).toEqual([1, 2]);
  });

  it("stop on a stale translation (the English changed) and say how to rerun it", () => {
    const stale = translationsFor();
    (stale["1"] as { sourceSha256: string }).sourceSha256 = "something else";
    for (const mode of ["demo", "production"] as const) {
      expect(() => planPack(input({ checks: CHECKED, clipTranslations: stale }), mode)).toThrow(
        /stale.*--steps translate/,
      );
    }
    const changedEnglish = translationsFor();
    ((changedEnglish["2"] as { sentences: { en?: string }[] }).sentences[0] as { en?: string }).en =
      "We pick by machine.";
    expect(() =>
      planPack(input({ checks: CHECKED, clipTranslations: changedEnglish }), "demo"),
    ).toThrow(/stale/);
  });

  it("stop on a missing translation for a clip, but not when there is no translation file yet", () => {
    const missing = translationsFor();
    delete missing["3"];
    expect(() => planPack(input({ checks: CHECKED, clipTranslations: missing }), "demo")).toThrow(
      /missing or stale/,
    );
    const none = planPack(
      input({ checks: CHECKED, clipTranslations: null, addonTranslations: null }),
      "demo",
    );
    expect(none.visitorLangs).toEqual(["en"]);
  });

  it("stop on a stale add-on translation in demo mode", () => {
    const stale = addonTranslations();
    (stale.recipe as { sourceSha256: string }).sourceSha256 = "old";
    expect(() => planPack(input({ checks: CHECKED, addonTranslations: stale }), "demo")).toThrow(
      /add-on recipe/,
    );
  });

  it("stop when the audio step has not run for a recording", () => {
    expect(() => planPack(input({ checks: CHECKED, audio: {} }), "demo")).toThrow(/no audio facts/);
  });

  it("plan the same files and passages for the same input (deterministic)", () => {
    expect(planPack(input({ checks: CHECKED }), "demo")).toEqual(
      planPack(input({ checks: CHECKED }), "demo"),
    );
  });
});

describe("synthetic tones (the committed fixture)", () => {
  const tones = RecordingsFileSchema.parse({
    farmSlug: "fixture",
    recordings: [1, 2, 3].map((n) => ({
      clip: n,
      lang: "en",
      file: `en/clip0${n}.m4a`,
      person: "synthetic",
      kind: "synthetic-tone",
      label: "Synthetic test tone, not a voice",
    })),
  });
  const toneInput = () =>
    input({
      recordings: tones,
      consent: [],
      clipTranslations: null,
      addonTranslations: null,
      checks: CHECKED,
    });

  it("need no consent row, are labeled as a stand-in, and list no stand-in voice", () => {
    const p = planPack(toneInput(), "demo");
    expect(ids(p)).toEqual([1, 2, 3]);
    expect(p.labels.standIn).toEqual(["Synthetic test tone, not a voice"]);
    expect(p.labels.standInVoice).toEqual([]);
  });

  it("can never ship in production: the manifest schema refuses a stand-in", () => {
    const p = planPack(toneInput(), "production");
    expect(p.labels.standIn).toEqual(["Synthetic test tone, not a voice"]);
  });
});
