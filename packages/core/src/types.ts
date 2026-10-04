// Shared contracts (TRD 6.1). Types and constant lists only: the Zod schemas live in schemas.ts
// and are pinned to these types with `satisfies`, so a drift fails `tsc -b`.

import type { FarmCode } from "./farm-code.ts";

export const VISITOR_LANGS = ["en", "de", "nl", "sv"] as const;
export type VisitorLang = (typeof VISITOR_LANGS)[number];

export const NOOR_LANGS = ["wo", "gu"] as const;
export type NoorLang = (typeof NOOR_LANGS)[number];

// Taxonomy order matters: themeOf() breaks ties in this order, and `other` stays last.
export const THEME_IDS = [
  "stay",
  "food",
  "buy",
  "price",
  "path",
  "kids",
  "roast",
  "picking",
  "story",
  "view",
  "welcome",
  "taste",
  "length",
  "wifi",
  "transport",
  "other",
] as const;
export type ThemeId = (typeof THEME_IDS)[number];

export type LocalizedText = Partial<Record<VisitorLang, string>>;

export interface Moment {
  id: string; // "c3-m1"
  clipId: number;
  startMs: number;
  endMs: number;
  subtitles: LocalizedText; // production packs contain checked text only
  topic: LocalizedText; // short label for the confirm card
  draft?: Partial<Record<VisitorLang, boolean>>; // demo packs only
  // How the subtitle cues were timed: from the transcript's word timestamps, or estimated from
  // the script (labeled in the player).
  timing: "estimated" | "word-timestamps";
}

export interface Clip {
  id: number;
  kind: "stop" | "answer";
  stopCode?: string;
  audio: string;
  durationMs: number;
  momentIds: string[];
  // WebVTT file per language (paths inside the pack).
  subtitles: Partial<Record<VisitorLang, string>>;
  // AI-dubbed Wolof version of this clip. Demo packs only; labeled; draft until a Wolof speaker
  // checks it. Its subtitles are a machine translation of the English, not a transcript of the dub.
  dubbed?: {
    lang: "wo";
    audio: string;
    durationMs: number;
    subtitles?: string;
    // Present with `subtitles`: they are NLLB's machine translation of the English text, not a
    // transcript of what the AI-dubbed audio says. The player must say so.
    subtitlesDraft?: true;
    label: "AI-dubbed (ElevenLabs)";
  };
}

// TRD 6.1 references Addon without defining it. Shape follows the content files in
// content/<farm>/ (facts, recipe, products, farm card): narrator add-ons, never Noor's voice.
// `needs` lists what is still missing (a fact's source, a product's price, the farm card's phone
// number). Such an add-on is shown labeled in demo mode and blocked from a production pack.
export type AddonNeed = "source" | "price" | "phone";

interface AddonBase {
  id: string;
  text: LocalizedText;
  checked: boolean; // only checked add-ons may ship in a production pack
  needs?: AddonNeed[];
}
export type Addon =
  | (AddonBase & { kind: "fact"; source?: string })
  | (AddonBase & { kind: "recipe" })
  | (AddonBase & { kind: "product"; price?: number; currency: string })
  | (AddonBase & { kind: "farm-card"; phone?: string });

export interface Thresholds {
  match: number;
  margin: number;
}

/**
 * Noor's texts in Wolof, as machine drafts (NLLB) next to their English source. DEMO packs only: a
 * production pack never carries it until a Wolof speaker has checked the texts. The guest app shows
 * them labeled "Draft, not yet checked by a Wolof speaker".
 */
export interface NoorText {
  lang: "wo";
  status: "draft";
  monthly: { en: string; wo: string };
  orderLine: { en: string; wo: string };
  themeLabels: Record<ThemeId, { en: string; wo: string }>;
}

export interface FarmPackManifest {
  packId: string;
  farmId: string; // Supabase farms.id (a UUID); what outbox items and ingest carry
  farmSlug: string; // "ondera-noor": for paths and pack folders, never an identifier
  version: number;
  mode: "production" | "demo";
  createdAt: string;
  noorLang: NoorLang;
  visitorLangs: VisitorLang[];
  clips: Clip[];
  moments: Moment[];
  addons: Addon[];
  model: {
    id: "multilingual-e5-small";
    dir: string;
    source: string; // Hugging Face repo, for example Xenova/multilingual-e5-small
    revision: string; // the exact commit the files came from (40 hex)
    queryPrefix: "query: ";
    dim: 384;
    quantization: "int8";
    vocab: "full" | "trimmed";
    /** Present exactly when vocab is "trimmed": the kept rows, the hash of the kept-id list, the recipe. */
    trim?: { keptRows: number; keepIdsSha256: string; recipe: string };
    sizeBytes: number;
  };
  embeddings: {
    file: string;
    count: number;
    dim: 384;
    dtype: "float32";
    passagePrefix: "passage: ";
    // Row i of the matrix is the passage of this moment in this language.
    // `indexOnly` rows come from short question-style phrasings that are never shown to anyone:
    // they only help find the moment, and the guest still confirms every match.
    rows: { momentId: string; lang: VisitorLang; indexOnly?: true }[];
  };
  thresholds: Thresholds; // calibrated by pipeline/eval
  /** Prototype control: Noor's farm code as a salted hash. Absent: the shop cannot confirm an order. */
  farmCode?: FarmCode;
  /** Demo packs only: Noor's order line and monthly text in Wolof (drafts) and their theme labels. */
  noorText?: NoorText;
  sizes: Record<string, number>;
  checksums: Record<string, string>;
  labels: {
    // Other stand-ins (placeholder content, stand-in software): demo packs only.
    standIn: string[];
    // A disclosed stand-in voice: the player shows "Voice: {person}, standing in for Noor"
    // (i18n key labels.standInVoice) in every guest language. May ship in production.
    standInVoice: { person: string; files: string[] }[];
    // AI voice files made from checked text (narrator audio), labeled "AI narrator voice".
    syntheticVoice: string[];
    // AI-dubbed audio (a person's voice dubbed into another language): demo packs only.
    aiDubbed: string[];
  };
}

export interface MatchResult {
  momentId: string;
  score: number;
}

export type AskOutcome =
  | { kind: "safety" }
  | { kind: "confirm"; momentId: string; score: number }
  | { kind: "saved"; reason: "below-threshold" | "ambiguous" | "guest-said-no" };

export type OutboxItem =
  | {
      type: "question";
      id: string;
      farmId: string;
      lang: VisitorLang;
      text: string;
      deviceTheme: ThemeId;
      createdAt: string;
    }
  | {
      type: "feedback";
      id: string;
      farmId: string;
      lang: VisitorLang;
      loved?: string;
      change?: string;
      lovedTheme?: ThemeId;
      changeTheme?: ThemeId;
      createdAt: string;
    }
  | {
      type: "order";
      id: string;
      farmId: string;
      items: { productId: string; qty: number }[];
      total: number;
      currency: string;
      confirmedByNoor: true;
      createdAt: string;
    };
