export const CORE_PACKAGE = "@asknoor/core";

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
export { FarmPackManifestSchema, manifestJsonSchema, OutboxItemSchema } from "./schemas.ts";
export { type SmsEncoding, type SmsSize, smsSize } from "./sms/gsm7.ts";
export {
  type CheckedLabel,
  type FilledTemplate,
  fillTemplate,
  MAX_SEGMENTS,
  type TemplateCounts,
  type TemplateLabels,
} from "./sms/template.ts";
export { normalize } from "./text/normalize.ts";
export { REDACTED_EMAIL, REDACTED_PHONE, redact } from "./text/redact.ts";
export { THEME_ORDER, THEMES, type Theme, themeOf } from "./themes/themes.ts";
export * from "./types.ts";
