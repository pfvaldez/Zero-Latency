// Noor's monthly text (non-negotiables 2, 6, 7). The body is a checked template filled with
// counts and checked theme labels, nothing else: no generated text, no personal data.
//
// Whether the template itself is checked (the "held" state) is decided by monthly-summary
// (Phase 5), which only calls this for a checked template.

import { type SmsEncoding, smsSize } from "./gsm7.ts";

export interface TemplateCounts {
  guests: number;
  orders: number;
  items: number;
  askedCount: number;
}

/** A theme label from a `sms_templates` row. Only checked labels may reach Noor. */
export interface CheckedLabel {
  text: string;
  checked: boolean;
}

export interface TemplateLabels {
  loved: CheckedLabel;
  asked: CheckedLabel;
  wished: CheckedLabel;
}

export interface FilledTemplate {
  body: string;
  encoding: SmsEncoding;
  length: number;
  segments: number;
  /** False when the body is over 160 GSM-7 characters (70 in UCS-2). Flagged, not blocked. */
  fitsOneSegment: boolean;
}

/** TRD section 7: "target one SMS segment, never more than two". */
export const MAX_SEGMENTS = 2;

const COUNT_KEYS = ["guests", "orders", "items", "askedCount"] as const;
const LABEL_KEYS = ["loved", "asked", "wished"] as const;
type CountKey = (typeof COUNT_KEYS)[number];
type LabelKey = (typeof LABEL_KEYS)[number];

const PLACEHOLDER = /\{([^{}]*)\}/g;

const isCountKey = (name: string): name is CountKey =>
  (COUNT_KEYS as readonly string[]).includes(name);
const isLabelKey = (name: string): name is LabelKey =>
  (LABEL_KEYS as readonly string[]).includes(name);

export function fillTemplate(
  template: string,
  counts: TemplateCounts,
  labels: TemplateLabels,
): FilledTemplate {
  if (/[{}]/.test(template.replace(PLACEHOLDER, ""))) {
    throw new Error("Template has an unbalanced brace");
  }

  // One pass over the template, so a label that contains "{guests}" is never expanded again.
  const body = template.replace(PLACEHOLDER, (_match, name: string) => {
    if (isCountKey(name)) {
      const value = counts[name];
      if (!Number.isSafeInteger(value) || value < 0) {
        throw new Error(`Count {${name}} must be a non-negative integer, got ${value}`);
      }
      return String(value);
    }
    if (isLabelKey(name)) {
      const label = labels[name];
      if (!label?.checked) throw new Error(`Label {${name}} is missing or not checked`);
      return label.text;
    }
    throw new Error(`Unknown placeholder {${name}}`);
  });

  const size = smsSize(body);
  if (size.segments > MAX_SEGMENTS) {
    throw new Error(
      `Body is ${size.segments} SMS segments (${size.encoding}); the limit is ${MAX_SEGMENTS}`,
    );
  }
  return { body, ...size, fitsOneSegment: size.segments <= 1 };
}
