// Shared contracts (TRD 6.1). Types and constant lists only: the Zod schemas live in schemas.ts
// and are pinned to these types with `satisfies`, so a drift fails `tsc -b`.

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
}

export interface Clip {
  id: number;
  kind: "stop" | "answer";
  stopCode?: string;
  audio: string;
  durationMs: number;
  momentIds: string[];
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
    dim: 384;
    quantization: "int8";
    vocab: "full" | "trimmed";
    sizeBytes: number;
  };
  embeddings: { file: string; count: number; dim: 384; dtype: "float32" };
  thresholds: Thresholds; // calibrated by pipeline/eval
  sizes: Record<string, number>;
  checksums: Record<string, string>;
  labels: { standIn: string[]; syntheticVoice: string[] };
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
