// Schemas for the content files in content/<farm>/ (clips, checks, add-ons, SMS templates,
// test questions) and the pure helpers that turn them into pack data. Pure: the files are read
// by the callers (the content test, the pack builder); nothing here touches the disk.
//
// Everything is draft unless checks.json says otherwise (non-negotiable 5). A missing value is
// declared in `needs` ("needs source", "needs price", "needs phone") so nothing is silently
// incomplete (non-negotiable 9).

import { z } from "zod";
import { type Addon, type AddonNeed, THEME_IDS, VISITOR_LANGS } from "./types.ts";

const isoTime = z.iso.datetime();
const slug = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
const note = z.string().min(1).optional();
const needs = <T extends AddonNeed>(...allowed: [T, ...T[]]) => z.array(z.enum(allowed)).optional();
const hasNeed = (item: { needs?: string[] }, need: string) => (item.needs ?? []).includes(need);

// ---- clips.json ------------------------------------------------------------------------------

const fourLangs = z.strictObject({
  en: z.string().min(1),
  de: z.string().min(1),
  nl: z.string().min(1),
  sv: z.string().min(1),
});

export const ClipSourceSchema = z
  .strictObject({
    id: z.number().int().min(1),
    kind: z.enum(["stop", "answer"]),
    stopCode: z.string().optional(),
    published: z.boolean(),
    momentId: z.string(),
    script: z.strictObject({ en: z.string().min(1) }), // the expected text, as written for Noor
    topic: fourLangs, // the confirm card: "Noor talks about {topic}"
    draft: z.strictObject({ de: z.literal(true), nl: z.literal(true), sv: z.literal(true) }),
  })
  .superRefine((clip, ctx) => {
    const issue = (message: string, path: string) =>
      ctx.addIssue({ code: "custom", message, path: [path] });
    if (clip.momentId !== `c${clip.id}-m1`) issue(`momentId must be c${clip.id}-m1`, "momentId");
    if (clip.kind === "stop" && clip.stopCode !== `NOOR-STOP-${clip.id}`) {
      issue(`a stop clip needs stopCode NOOR-STOP-${clip.id}`, "stopCode");
    }
    if (clip.kind === "answer" && clip.stopCode !== undefined)
      issue("an answer clip has no stop code", "stopCode");
    if (!clip.published && clip.kind !== "answer")
      issue("only an answer clip can be held back", "published");
  });

export const ClipsFileSchema = z
  .strictObject({ farmSlug: slug, note, clips: z.array(ClipSourceSchema).min(1) })
  .refine((f) => new Set(f.clips.map((c) => c.id)).size === f.clips.length, {
    error: "clip ids must be unique",
  });

// ---- recordings/recordings.json --------------------------------------------------------------

// Provenance and labels for every recording. Audio files themselves are not committed.
const recordingBase = {
  clip: z.number().int().min(1),
  file: z.string().regex(/^(en|wo)\/clip\d{2}(_wo)?\.(m4a|flac)$/),
  person: z.string().min(1),
};
export const RecordingsFileSchema = z.strictObject({
  note,
  farmSlug: slug,
  recordings: z.array(
    z.discriminatedUnion("kind", [
      // Preet's English recording, shown to guests as Noor's labeled stand-in voice.
      z.strictObject({
        ...recordingBase,
        lang: z.literal("en"),
        kind: z.literal("stand-in-voice"),
        label: z.string().regex(/^Stand-in for Noor's voice/),
      }),
      // Generated test tones for the committed fixture pack: not a voice, no consent needed, and
      // labeled so the pack is a demo pack (labels.standIn).
      z.strictObject({
        ...recordingBase,
        lang: z.literal("en"),
        kind: z.literal("synthetic-tone"),
        label: z.string().regex(/^Synthetic/),
      }),
      // AI-dubbed Wolof: draft until a Wolof speaker checks it, demo only, and only with a
      // confirmed row for the person in docs/CONSENT.md (the pipeline enforces that).
      z
        .strictObject({
          ...recordingBase,
          lang: z.literal("wo"),
          kind: z.literal("ai-dubbed"),
          label: z.literal("AI-dubbed (ElevenLabs)"),
          status: z.literal("draft"),
          demoOnly: z.literal(true),
          consentPerson: z.string().min(1),
        })
        .refine((r) => r.consentPerson === r.person, {
          error: "consentPerson must be the person whose voice was dubbed",
          path: ["consentPerson"],
        }),
    ]),
  ),
});

// ---- checks.json -----------------------------------------------------------------------------

// Who checked what, when. Anything without an entry is a draft.
export const CheckEntrySchema = z
  .strictObject({
    id: z.string().regex(/^[a-z0-9][a-z0-9-]*(?:\/[a-z0-9][a-z0-9-]*)*$/), // clip-3/subtitles/en
    checked: z.boolean(),
    by: z.string().min(1).optional(),
    at: isoTime.optional(),
    // The transcript the checker approved; re-transcribing changes it and withdraws the check.
    transcriptSha256: z
      .string()
      .regex(/^[0-9a-f]{64}$/)
      .optional(),
  })
  .refine((c) => !c.checked || (c.by !== undefined && c.at !== undefined), {
    error: "a checked entry needs by and at",
  });

export const ChecksFileSchema = z
  .strictObject({ note, checks: z.array(CheckEntrySchema) })
  .refine((f) => new Set(f.checks.map((c) => c.id)).size === f.checks.length, {
    error: "check ids must be unique",
  });

// ---- add-ons: facts, recipe, products, farm card ---------------------------------------------

const en = z.strictObject({ en: z.string().min(1) });

export const FactsFileSchema = z.strictObject({
  note,
  facts: z.array(
    z
      .strictObject({
        id: z.string().min(1),
        afterClip: z.number().int().min(1),
        text: en,
        source: z.string().min(1).optional(),
        needs: needs("source"),
      })
      .refine((f) => (f.source !== undefined) !== hasNeed(f, "source"), {
        error: "a fact needs a source, or must list needs: [source]",
      }),
  ),
});

export const RecipeFileSchema = z.strictObject({
  note,
  id: z.literal("recipe"),
  title: en,
  steps: z.array(en).min(1),
  inspiredBy: z.string().min(1).optional(),
  noorConfirmsBeforeGuestsSee: z.literal(true),
});

export const ProductsFileSchema = z.strictObject({
  note,
  products: z.array(
    z
      .strictObject({
        id: z.string().min(1),
        name: en,
        price: z.number().nonnegative().optional(),
        currency: z.string().regex(/^[A-Z]{3}$/),
        needs: needs("price"),
      })
      .refine((p) => (p.price !== undefined) !== hasNeed(p, "price"), {
        error: "a product needs a price, or must list needs: [price]",
      }),
  ),
});

export const FarmCardFileSchema = z
  .strictObject({
    note,
    id: z.literal("farm-card"),
    lines: z.array(en).min(1),
    phone: z.string().min(1).optional(),
    needs: needs("phone"),
  })
  .refine((c) => (c.phone !== undefined) !== hasNeed(c, "phone"), {
    error: "the farm card needs a phone number, or must list needs: [phone]",
  });

export type ChecksFile = z.infer<typeof ChecksFileSchema>;
export type ClipsFile = z.infer<typeof ClipsFileSchema>;
export type RecordingsFile = z.infer<typeof RecordingsFileSchema>;
export interface AddonContent {
  facts: z.infer<typeof FactsFileSchema>;
  recipe: z.infer<typeof RecipeFileSchema>;
  products: z.infer<typeof ProductsFileSchema>;
  farmCard: z.infer<typeof FarmCardFileSchema>;
}

/**
 * The content files as manifest add-ons. `checked` comes only from checks.json (an entry with the
 * add-on's id and checked: true); the content files themselves never claim to be checked.
 */
export function toAddons(content: AddonContent, checks: ChecksFile): Addon[] {
  const checked = (id: string) => checks.checks.some((c) => c.id === id && c.checked);
  const withNeeds = <T extends { needs?: AddonNeed[] }>(item: T) =>
    item.needs?.length ? { needs: item.needs } : {};
  return [
    ...content.facts.facts.map(
      (f): Addon => ({
        id: f.id,
        kind: "fact",
        text: { en: f.text.en },
        checked: checked(f.id),
        ...(f.source !== undefined ? { source: f.source } : {}),
        ...withNeeds(f),
      }),
    ),
    {
      id: content.recipe.id,
      kind: "recipe",
      text: {
        en: [
          content.recipe.title.en,
          ...content.recipe.steps.map((s, i) => `${i + 1}. ${s.en}`),
        ].join("\n"),
      },
      checked: checked(content.recipe.id),
    },
    ...content.products.products.map(
      (p): Addon => ({
        id: p.id,
        kind: "product",
        text: { en: p.name.en },
        checked: checked(p.id),
        currency: p.currency,
        ...(p.price !== undefined ? { price: p.price } : {}),
        ...withNeeds(p),
      }),
    ),
    {
      id: content.farmCard.id,
      kind: "farm-card",
      text: { en: content.farmCard.lines.map((l) => l.en).join("\n") },
      checked: checked(content.farmCard.id),
      ...(content.farmCard.phone !== undefined ? { phone: content.farmCard.phone } : {}),
      ...withNeeds(content.farmCard),
    },
  ];
}

// ---- sms-templates.json ----------------------------------------------------------------------

// Placeholders each template may use. The monthly set is exactly what fillTemplate knows.
export const MONTHLY_PLACEHOLDERS = [
  "guests",
  "orders",
  "items",
  "loved",
  "asked",
  "askedCount",
  "wished",
];
export const ORDER_LINE_PLACEHOLDERS = ["items", "total", "currency"];

const placeholdersOf = (text: string) => [...text.matchAll(/\{([^{}]*)\}/g)].map((m) => m[1] ?? "");
const usesOnly = (allowed: string[]) => (text: string) =>
  placeholdersOf(text).every((p) => allowed.includes(p)) &&
  !/[{}]/.test(text.replace(/\{[^{}]*\}/g, ""));

// Noor's language is Wolof. We write no Wolof ourselves: it stays null ("needs-nllb-draft") until
// the NLLB step drafts it, and it is a draft until a Wolof speaker checks it (checks.json).
const woText = z
  .strictObject({
    text: z.string().min(1).nullable(),
    status: z.enum(["needs-nllb-draft", "draft"]),
  })
  .refine((w) => (w.text === null) === (w.status === "needs-nllb-draft"), {
    error: "wo text is null exactly when its status is needs-nllb-draft",
  });

const templatePair = (allowed: string[]) =>
  z.strictObject({
    en: z
      .string()
      .min(1)
      .refine(usesOnly(allowed), { error: `only these placeholders: ${allowed.join(", ")}` }),
    wo: woText,
  });

export const SmsTemplatesFileSchema = z.strictObject({
  note,
  monthly: templatePair(MONTHLY_PLACEHOLDERS),
  orderLine: templatePair(ORDER_LINE_PLACEHOLDERS),
  themeLabels: z.strictObject(
    Object.fromEntries(
      THEME_IDS.map((id) => [id, z.strictObject({ en: z.string().min(1), wo: woText })]),
    ) as Record<
      (typeof THEME_IDS)[number],
      z.ZodObject<{ en: z.ZodString; wo: typeof woText }, z.core.$strict>
    >,
  ),
});

// ---- eval/test-questions.csv -----------------------------------------------------------------

export const TEST_QUESTION_COLUMNS = [
  "id",
  "lang",
  "question",
  "expected",
  "variant",
  "synthetic",
] as const;

export const TestQuestionRowSchema = z.strictObject({
  id: z.string().regex(/^q\d{3}$/),
  lang: z.enum(VISITOR_LANGS),
  question: z.string().min(1),
  // clipNN: that clip answers it. none: Noor never answers it. safety: must show the safety card.
  expected: z.string().regex(/^(clip0[1-9]|clip[1-9]\d|none|safety)$/),
  variant: z.enum(["plain", "paraphrase", "typo"]),
  synthetic: z.literal("true"), // every test question is labeled synthetic
});
export type TestQuestionRow = z.infer<typeof TestQuestionRowSchema>;

/** RFC 4180 fields: commas and doubled quotes inside quotes, CRLF or LF, blank lines skipped. */
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      field = "";
      if (row.some((f) => f !== "")) rows.push(row);
      row = [];
    } else field += c;
  }
  if (quoted) throw new Error("test questions: an opening quote is never closed");
  row.push(field);
  if (row.some((f) => f !== "")) rows.push(row);
  return rows;
}

/** Parse and validate the test-question CSV. Throws with the line of the first bad row. */
export function parseTestQuestions(csv: string): TestQuestionRow[] {
  const [header, ...body] = parseCsv(csv);
  if (!header || header.join(",") !== TEST_QUESTION_COLUMNS.join(",")) {
    throw new Error(`test questions: the header must be ${TEST_QUESTION_COLUMNS.join(",")}`);
  }
  return body.map((fields, i) => {
    if (fields.length !== header.length) {
      throw new Error(
        `test questions: row ${i + 2} has ${fields.length} fields, expected ${header.length}`,
      );
    }
    const parsed = TestQuestionRowSchema.safeParse(
      Object.fromEntries(header.map((h, j) => [h, fields[j]])),
    );
    if (!parsed.success)
      throw new Error(`test questions: row ${i + 2}: ${parsed.error.issues[0]?.message}`);
    return parsed.data;
  });
}
