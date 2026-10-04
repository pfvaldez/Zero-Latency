export const CORE_PACKAGE = "@asknoor/core";

export { CONFIRMED, type ConsentRow, parseConsent, requireConfirmed } from "./consent.ts";
export {
  type AddonContent,
  CheckEntrySchema,
  type ChecksFile,
  ChecksFileSchema,
  ClipSourceSchema,
  type ClipsFile,
  ClipsFileSchema,
  FactsFileSchema,
  FarmCardFileSchema,
  type IndexPassagesFile,
  IndexPassagesFileSchema,
  MONTHLY_PLACEHOLDERS,
  ORDER_LINE_PLACEHOLDERS,
  ProductsFileSchema,
  parseTestQuestions,
  RecipeFileSchema,
  type RecordingsFile,
  RecordingsFileSchema,
  SmsTemplatesFileSchema,
  TEST_QUESTION_COLUMNS,
  type TestQuestionRow,
  TestQuestionRowSchema,
  toAddons,
} from "./content.ts";
export {
  assignSlots,
  breakdown,
  type CrossValidation,
  crossValidate,
  evaluate,
  type Fold,
  type Halves,
  histogram,
  type LeaveOneOut,
  leaveOneLanguageOut,
  type Metrics,
  momentOfClip,
  type PooledMetrics,
  pickThreshold,
  pool,
  type ScoredQuestion,
  shippedThreshold,
  splitSlots,
  sweep,
  thresholdGrid,
  wilson,
} from "./eval.ts";
export { type WolofEvidence, WolofEvidenceSchema } from "./evidence.ts";
export { decide } from "./guardrails/decide.ts";
export { decideSafety, SAFETY_LEXICON } from "./guardrails/safety.ts";
export {
  I18N_STATUS,
  STRINGS,
  type StringKey,
  type StringParams,
  type Strings,
  t,
} from "./i18n/index.ts";
export {
  type AuditPassage,
  type AuditQuestion,
  type LeakageReport,
  leakageAudit,
} from "./leakage.ts";
export {
  type AudioMeta,
  addonSentences,
  PackError,
  type PackInput,
  type PackMode,
  type PackPlan,
  type PlannedFile,
  planPack,
  type TranslationItem,
  type Translations,
} from "./pack.ts";
export { FarmPackManifestSchema, manifestJsonSchema, OutboxItemSchema } from "./schemas.ts";
export { type SmsEncoding, type SmsSize, smsSize } from "./sms/gsm7.ts";
export {
  type CheckedLabel,
  type FilledTemplate,
  fillTemplate,
  MAX_SEGMENTS,
  MONTHLY_PRIORITY,
  type TemplateCounts,
  type TemplateLabels,
  templateParts,
} from "./sms/template.ts";
export { normalize } from "./text/normalize.ts";
export { REDACTED_EMAIL, REDACTED_PHONE, redact } from "./text/redact.ts";
export { THEME_ORDER, THEMES, type Theme, themeOf } from "./themes/themes.ts";
export * from "./types.ts";
export {
  type Cue,
  cuesEstimated,
  cuesFromWords,
  splitSentences,
  type TimedWord,
  timestamp,
  toWebVtt,
} from "./vtt.ts";
