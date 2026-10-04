// Zod schemas for the two contracts that cross a boundary: the farm-pack manifest (pipeline to
// guest app) and the outbox item (guest app to ingest). Each schema is pinned to the hand-written
// type in types.ts with `satisfies`, so a drift fails `tsc -b`.
//
// Strict objects everywhere: an unknown field is rejected, so no personal field can ride along in
// an outbox item (non-negotiable 7).

import { z } from "zod";
import {
  type Addon,
  type AddonNeed,
  type Clip,
  type FarmPackManifest,
  type Moment,
  NOOR_LANGS,
  type OutboxItem,
  THEME_IDS,
  VISITOR_LANGS,
} from "./types.ts";

const visitorLang = z.enum(VISITOR_LANGS);
const themeId = z.enum(THEME_IDS);
const localizedText = z.partialRecord(visitorLang, z.string());
const isoTime = z.iso.datetime();
const currency = z.string().regex(/^[A-Z]{3}$/, "ISO 4217 code, for example GMD");
const nonNegInt = z.number().int().nonnegative();
const unitInterval = z.number().min(0).max(1);

const farmId = z.uuid(); // Supabase farms.id
// Lowercase words joined by single hyphens. Used in paths and pack folder names, so no dots,
// slashes or spaces can get in.
const farmSlug = z
  .string()
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "lowercase letters, digits and hyphens");

const MAX_TEXT = 1000; // a guest question or feedback line; keeps a stray paste out of the outbox

// ---- Outbox ----------------------------------------------------------------------------------

const questionItem = z.strictObject({
  type: z.literal("question"),
  id: z.uuid(),
  farmId,
  lang: visitorLang,
  text: z.string().min(1).max(MAX_TEXT),
  deviceTheme: themeId,
  createdAt: isoTime,
});

const feedbackItem = z.strictObject({
  type: z.literal("feedback"),
  id: z.uuid(),
  farmId,
  lang: visitorLang,
  loved: z.string().max(MAX_TEXT).optional(),
  change: z.string().max(MAX_TEXT).optional(),
  lovedTheme: themeId.optional(),
  changeTheme: themeId.optional(),
  createdAt: isoTime,
});

const orderItem = z.strictObject({
  type: z.literal("order"),
  id: z.uuid(),
  farmId,
  items: z
    .array(
      z.strictObject({
        productId: z.string().min(1),
        qty: z.number().int().positive(),
      }),
    )
    .min(1),
  total: z.number().nonnegative(),
  currency,
  // Sales count only when Noor confirms payment (non-negotiable 6).
  confirmedByNoor: z.literal(true),
  createdAt: isoTime,
});

export const OutboxItemSchema = z.discriminatedUnion("type", [
  questionItem,
  feedbackItem,
  orderItem,
]) satisfies z.ZodType<OutboxItem>;

// ---- Farm pack manifest ----------------------------------------------------------------------

const momentSchema = z
  .strictObject({
    id: z.string().min(1),
    clipId: nonNegInt,
    startMs: nonNegInt,
    endMs: nonNegInt,
    subtitles: localizedText,
    topic: localizedText,
    draft: z.partialRecord(visitorLang, z.boolean()).optional(),
    timing: z.enum(["estimated", "word-timestamps"]),
  })
  .refine((m) => m.endMs > m.startMs, {
    error: "endMs must be after startMs",
    path: ["endMs"],
  }) satisfies z.ZodType<Moment>;

const clipSchema = z.strictObject({
  id: nonNegInt,
  kind: z.enum(["stop", "answer"]),
  stopCode: z.string().min(1).optional(),
  audio: z.string().min(1),
  durationMs: nonNegInt,
  momentIds: z.array(z.string().min(1)),
  subtitles: z.partialRecord(visitorLang, z.string().min(1)),
  dubbed: z
    .strictObject({
      lang: z.literal("wo"),
      audio: z.string().min(1),
      durationMs: nonNegInt,
      subtitles: z.string().min(1).optional(),
      label: z.literal("AI-dubbed (ElevenLabs)"),
    })
    .optional(),
}) satisfies z.ZodType<Clip>;

const addonNeed = z.enum(["source", "price", "phone"]);
const addonBase = {
  id: z.string().min(1),
  text: localizedText,
  checked: z.boolean(),
  needs: z.array(addonNeed).optional(),
};

// A missing value must be declared in `needs`, and a declared need must really be missing:
// nothing is silently incomplete, and nothing claims a gap it does not have.
const declares = (a: { needs?: string[] }, need: AddonNeed) => (a.needs ?? []).includes(need);

const addonSchema = z.discriminatedUnion("kind", [
  z
    .strictObject({ ...addonBase, kind: z.literal("fact"), source: z.string().min(1).optional() })
    .refine((a) => (a.source !== undefined) !== declares(a, "source"), {
      error: "a fact needs a source, or must list needs: [source]",
    }),
  z.strictObject({ ...addonBase, kind: z.literal("recipe") }),
  z
    .strictObject({
      ...addonBase,
      kind: z.literal("product"),
      price: z.number().nonnegative().optional(),
      currency,
    })
    .refine((a) => (a.price !== undefined) !== declares(a, "price"), {
      error: "a product needs a price, or must list needs: [price]",
    }),
  z
    .strictObject({
      ...addonBase,
      kind: z.literal("farm-card"),
      phone: z.string().min(1).optional(),
    })
    .refine((a) => (a.phone !== undefined) !== declares(a, "phone"), {
      error: "the farm card needs a phone number, or must list needs: [phone]",
    }),
]) satisfies z.ZodType<Addon>;

export const FarmPackManifestSchema = z
  .strictObject({
    packId: z.string().min(1),
    farmId,
    farmSlug,
    version: nonNegInt,
    mode: z.enum(["production", "demo"]),
    createdAt: isoTime,
    noorLang: z.enum(NOOR_LANGS),
    visitorLangs: z.array(visitorLang).min(1),
    clips: z.array(clipSchema),
    moments: z.array(momentSchema),
    addons: z.array(addonSchema),
    model: z.strictObject({
      id: z.literal("multilingual-e5-small"),
      dir: z.string().min(1),
      source: z.string().min(1),
      revision: z.string().regex(/^[0-9a-f]{40}$/),
      queryPrefix: z.literal("query: "),
      dim: z.literal(384),
      quantization: z.literal("int8"),
      vocab: z.enum(["full", "trimmed"]),
      sizeBytes: z.number().int().positive(),
    }),
    embeddings: z.strictObject({
      file: z.string().min(1),
      count: nonNegInt,
      dim: z.literal(384),
      dtype: z.literal("float32"),
      passagePrefix: z.literal("passage: "),
      rows: z.array(z.strictObject({ momentId: z.string().min(1), lang: visitorLang })),
    }),
    thresholds: z.strictObject({ match: unitInterval, margin: unitInterval }),
    sizes: z.record(z.string(), nonNegInt),
    checksums: z.record(z.string(), z.string().min(1)),
    labels: z.strictObject({
      standIn: z.array(z.string()),
      standInVoice: z.array(
        z.strictObject({ person: z.string().min(1), files: z.array(z.string().min(1)).min(1) }),
      ),
      syntheticVoice: z.array(z.string()),
      aiDubbed: z.array(z.string()),
    }),
  })
  // Checked content only (non-negotiable 5) and honest labels (non-negotiable 9, L-011): a
  // production pack carries no draft text, no unchecked add-on, no stand-in and no AI-dubbed audio.
  // A disclosed stand-in voice (labels.standInVoice) is allowed: the player shows its label. The pack builder
  // excludes these; this refusal is the second line of defence on the device and in CI.
  .superRefine((pack, ctx) => {
    // The embedding matrix has one row per (moment, language) passage, and every row must name a
    // moment in the pack and a language the pack declares.
    if (pack.embeddings.count !== pack.embeddings.rows.length) {
      ctx.addIssue({
        code: "custom",
        message: "embeddings.count must equal embeddings.rows.length",
        path: ["embeddings", "count"],
      });
    }
    const momentIds = new Set(pack.moments.map((m) => m.id));
    pack.embeddings.rows.forEach((row, i) => {
      if (!momentIds.has(row.momentId) || !pack.visitorLangs.includes(row.lang)) {
        ctx.addIssue({
          code: "custom",
          message: `embedding row ${i} names an unknown moment or language`,
          path: ["embeddings", "rows", i],
        });
      }
    });
    if (pack.mode !== "production") return;
    pack.clips.forEach((clip, i) => {
      if (clip.dubbed) {
        ctx.addIssue({
          code: "custom",
          message: `clip ${clip.id} has AI-dubbed audio, which is demo-only`,
          path: ["clips", i, "dubbed"],
        });
      }
    });
    pack.moments.forEach((moment, i) => {
      if (Object.values(moment.draft ?? {}).some(Boolean)) {
        ctx.addIssue({
          code: "custom",
          message: `moment ${moment.id} has draft text in a production pack`,
          path: ["moments", i, "draft"],
        });
      }
    });
    pack.addons.forEach((addon, i) => {
      if (!addon.checked) {
        ctx.addIssue({
          code: "custom",
          message: `add-on ${addon.id} is unchecked in a production pack`,
          path: ["addons", i, "checked"],
        });
      }
    });
    pack.addons.forEach((addon, i) => {
      if (addon.needs && addon.needs.length > 0) {
        ctx.addIssue({
          code: "custom",
          message: `add-on ${addon.id} still needs ${addon.needs.join(", ")} in a production pack`,
          path: ["addons", i, "needs"],
        });
      }
    });
    if (pack.labels.aiDubbed.length > 0) {
      ctx.addIssue({
        code: "custom",
        message: "AI-dubbed audio is demo-only: a production pack must not include it",
        path: ["labels", "aiDubbed"],
      });
    }
    if (pack.labels.standIn.length > 0) {
      ctx.addIssue({
        code: "custom",
        message: "a production pack must have no stand-ins",
        path: ["labels", "standIn"],
      });
    }
  }) satisfies z.ZodType<FarmPackManifest>;

/**
 * JSON Schema (draft 2020-12) of the manifest, for the Python pipeline to validate its output.
 * Refinements (the production rules above, endMs > startMs) are not representable; the pipeline's
 * own pack tests cover them.
 */
export function manifestJsonSchema(): Record<string, unknown> {
  return z.toJSONSchema(FarmPackManifestSchema, { target: "draft-2020-12", io: "output" });
}
