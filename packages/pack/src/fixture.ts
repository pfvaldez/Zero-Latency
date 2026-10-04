// The committed fixture pack: SYNTHETIC generated tones and made-up text, so CI and the guest
// app's offline end-to-end tests run without anyone's recording. A demo pack, labeled as a
// stand-in; the model folder is not committed (`bun run pack:model -- --into apps/web/public/packs/fixture`).

import { readFile } from "node:fs/promises";
import { join } from "node:path";
import {
  ChecksFileSchema,
  ClipsFileSchema,
  FactsFileSchema,
  FarmCardFileSchema,
  type PackInput,
  ProductsFileSchema,
  RecipeFileSchema,
  RecordingsFileSchema,
  splitSentences,
  type Translations,
} from "@asknoor/core";
import { type BuiltPack, buildPack, sha256 } from "./build.ts";
import { REPO_ROOT } from "./model.ts";

export const FIXTURE_SLUG = "fixture";
export const FIXTURE_FARM_ID = "00000000-0000-4000-8000-0000000000f1";
export const FIXTURE_DIR = join(REPO_ROOT, "apps", "web", "public", "packs", FIXTURE_SLUG);
const AUDIO = join(REPO_ROOT, "packages", "pack", "fixtures", "audio");
const FIXED_TIME = new Date("2026-10-04T00:00:00Z");
const LABEL = "Synthetic test tone, not a voice";

const SCRIPT = [
  "Welcome to the fixture farm. This is synthetic test audio, not a person.",
  "We pick the red coffee cherries by hand. This is synthetic test audio, not a person.",
  "We roast the coffee beans in a pan over the fire. This is synthetic test audio, not a person.",
];
const TOPICS = ["the welcome", "picking the coffee cherries", "roasting the coffee"];
const DRAFTS: Record<string, string[][]> = {
  // Hand-written drafts for the fixture only, marked draft like every translation.
  de: [
    ["Willkommen auf der Fixture-Farm.", "Das ist synthetisches Testaudio, keine Person."],
    [
      "Wir pflücken die roten Kaffeekirschen von Hand.",
      "Das ist synthetisches Testaudio, keine Person.",
    ],
    [
      "Wir rösten die Kaffeebohnen in einer Pfanne über dem Feuer.",
      "Das ist synthetisches Testaudio, keine Person.",
    ],
  ],
  nl: [
    ["Welkom op de fixture-boerderij.", "Dit is synthetische testaudio, geen persoon."],
    [
      "We plukken de rode koffiekersen met de hand.",
      "Dit is synthetische testaudio, geen persoon.",
    ],
    [
      "We roosteren de koffiebonen in een pan boven het vuur.",
      "Dit is synthetische testaudio, geen persoon.",
    ],
  ],
  sv: [
    ["Välkommen till fixture-gården.", "Det här är syntetiskt testljud, ingen person."],
    ["Vi plockar de röda kaffebären för hand.", "Det här är syntetiskt testljud, ingen person."],
    [
      "Vi rostar kaffebönorna i en panna över elden.",
      "Det här är syntetiskt testljud, ingen person.",
    ],
  ],
};

export async function fixtureInput(): Promise<PackInput> {
  const report = JSON.parse(await readFile(join(AUDIO, "audio-report.json"), "utf8")) as {
    clips: Record<string, { duration_ms: number; head_silence_s: number; tail_silence_s: number }>;
  };
  const audio = Object.fromEntries(
    Object.entries(report.clips).map(([file, r]) => [
      file,
      {
        durationMs: r.duration_ms,
        headSilenceMs: Math.round(r.head_silence_s * 1000),
        tailSilenceMs: Math.round(r.tail_silence_s * 1000),
      },
    ]),
  );
  const hash = (t: string) => sha256Hex(t);
  const clipTranslations: Translations = {};
  for (const [i, text] of SCRIPT.entries()) {
    const en = splitSentences(text);
    clipTranslations[String(i + 1)] = {
      sourceSha256: hash(en.join("\n")),
      sentences: en.map((s, j) => ({
        en: s,
        de: (DRAFTS.de?.[i] ?? [])[j],
        nl: (DRAFTS.nl?.[i] ?? [])[j],
        sv: (DRAFTS.sv?.[i] ?? [])[j],
      })),
    };
  }
  return {
    clips: ClipsFileSchema.parse({
      farmSlug: FIXTURE_SLUG,
      clips: [1, 2, 3].map((n) => ({
        id: n,
        kind: "stop",
        stopCode: `NOOR-STOP-${n}`,
        published: true,
        momentId: `c${n}-m1`,
        script: { en: SCRIPT[n - 1] },
        topic: { en: TOPICS[n - 1], de: TOPICS[n - 1], nl: TOPICS[n - 1], sv: TOPICS[n - 1] },
        draft: { de: true, nl: true, sv: true },
      })),
    }),
    checks: ChecksFileSchema.parse({ checks: [] }),
    addonContent: {
      facts: FactsFileSchema.parse({
        facts: [
          {
            id: "fact-1",
            afterClip: 2,
            text: { en: "Synthetic fixture fact: coffee cherries are red when ripe." },
            needs: ["source"],
          },
        ],
      }),
      recipe: RecipeFileSchema.parse({
        id: "recipe",
        title: { en: "Synthetic fixture recipe" },
        steps: [{ en: "Grind the beans." }, { en: "Add hot water." }],
        noorConfirmsBeforeGuestsSee: true,
      }),
      products: ProductsFileSchema.parse({
        products: [
          {
            id: "beans-250",
            name: { en: "Synthetic fixture beans, 250 g" },
            currency: "GMD",
            needs: ["price"],
          },
        ],
      }),
      farmCard: FarmCardFileSchema.parse({
        id: "farm-card",
        lines: [{ en: "Synthetic fixture farm card." }],
        needs: ["phone"],
      }),
    },
    recordings: RecordingsFileSchema.parse({
      farmSlug: FIXTURE_SLUG,
      recordings: [1, 2, 3].map((n) => ({
        clip: n,
        lang: "en",
        file: `en/clip0${n}.m4a`,
        person: "synthetic",
        kind: "synthetic-tone",
        label: LABEL,
      })),
    }),
    audio,
    transcripts: new Map(),
    clipTranslations,
    addonTranslations: null,
    consent: [],
    sha256: hash,
  };
}

const sha256Hex = (t: string) => sha256(new TextEncoder().encode(t));

/** The fixture uses the match threshold that was evaluated on the real content. */
async function realThreshold(): Promise<{ match: number; margin: number }> {
  const t = JSON.parse(
    await readFile(join(REPO_ROOT, "content", "ondera-noor", "eval", "threshold.json"), "utf8"),
  ) as { match: number; margin: number };
  return { match: t.match, margin: t.margin };
}

export async function buildFixture(): Promise<BuiltPack> {
  return buildPack({
    farm: FIXTURE_SLUG,
    mode: "demo",
    input: await fixtureInput(),
    outDir: FIXTURE_DIR,
    audioDir: AUDIO,
    now: FIXED_TIME,
    farmId: FIXTURE_FARM_ID,
    includeModel: false,
    thresholds: await realThreshold(),
  });
}
