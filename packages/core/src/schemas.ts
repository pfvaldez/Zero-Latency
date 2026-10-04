// Zod schemas for the two contracts that cross a boundary: the farm-pack manifest (pipeline to
// guest app) and the outbox item (guest app to ingest). Each schema is pinned to the hand-written
// type in types.ts with `satisfies`, so a drift fails `tsc -b`.
//
// Strict objects everywhere: an unknown field is rejected, so no personal field can ride along in
// an outbox item (non-negotiable 7).

import { z } from "zod";
import {
  type Addon,
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

const MAX_TEXT = 1000; // a guest question or feedback line; keeps a stray paste out of the outbox

// ---- Outbox ----------------------------------------------------------------------------------

const questionItem = z.strictObject({
  type: z.literal("question"),
  id: z.uuid(),
  farmId: z.string().min(1),
  lang: visitorLang,
  text: z.string().min(1).max(MAX_TEXT),
  deviceTheme: themeId,
  createdAt: isoTime,
});

const feedbackItem = z.strictObject({
  type: z.literal("feedback"),
  id: z.uuid(),
  farmId: z.string().min(1),
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
  farmId: z.string().min(1),
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
}) satisfies z.ZodType<Clip>;

const addonBase = { id: z.string().min(1), text: localizedText, checked: z.boolean() };
const addonSchema = z.discriminatedUnion("kind", [
  z.strictObject({ ...addonBase, kind: z.literal("fact"), source: z.string().min(1) }),
  z.strictObject({ ...addonBase, kind: z.literal("recipe") }),
  z.strictObject({
    ...addonBase,
    kind: z.literal("product"),
    price: z.number().nonnegative(),
    currency,
  }),
  z.strictObject({ ...addonBase, kind: z.literal("farm-card") }),
]) satisfies z.ZodType<Addon>;

export const FarmPackManifestSchema = z
  .strictObject({
    packId: z.string().min(1),
    farmId: z.string().min(1),
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
    }),
    thresholds: z.strictObject({ match: unitInterval, margin: unitInterval }),
    sizes: z.record(z.string(), nonNegInt),
    checksums: z.record(z.string(), z.string().min(1)),
    labels: z.strictObject({
      standIn: z.array(z.string()),
      syntheticVoice: z.array(z.string()),
    }),
  })
  // Checked content only (non-negotiable 5) and honest labels (non-negotiable 9, L-011): a
  // production pack carries no draft text, no unchecked add-on and no stand-in. The pack builder
  // excludes these; this refusal is the second line of defence on the device and in CI.
  .superRefine((pack, ctx) => {
    if (pack.mode !== "production") return;
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
