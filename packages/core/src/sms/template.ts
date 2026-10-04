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
  /** Parts left out so the text fits MAX_SEGMENTS, lowest priority first; empty when nothing was dropped. */
  dropped: string[];
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

/**
 * What matters most in Noor's monthly text, most important first. The questions guests asked and
 * the things they wished for are the point (they become her next product); counts of guests come
 * last. A part of the template is ranked by the most important placeholder it holds, and a part
 * with no placeholder is dropped first.
 */
export const MONTHLY_PRIORITY = [
  "asked",
  "askedCount",
  "wished",
  "loved",
  "orders",
  "items",
  "guests",
] as const;

/** Split a template into parts at sentence ends ("." "!" "?" then whitespace). Placeholders hold no spaces. */
export function templateParts(template: string): string[] {
  return template
    .trim()
    .split(/(?<=[.!?])\s+/)
    .filter((part) => part.length > 0);
}

const rankOf = (part: string, priority: readonly string[]): number => {
  const ranks = [...part.matchAll(PLACEHOLDER)].map((m) => priority.indexOf(m[1] ?? ""));
  const known = ranks.filter((r) => r >= 0);
  return known.length > 0 ? Math.min(...known) : priority.length + 1; // no placeholder: first to go
};

export function fillTemplate(
  template: string,
  counts: TemplateCounts,
  labels: TemplateLabels,
  options: { priority?: readonly string[] } = {},
): FilledTemplate {
  if (/[{}]/.test(template.replace(PLACEHOLDER, ""))) {
    throw new Error("Template has an unbalanced brace");
  }
  const priority = options.priority ?? MONTHLY_PRIORITY;

  // Fill every part first, so an unknown placeholder, a bad count or an unchecked label throws even
  // if that part would be dropped. One pass per part: a label holding "{guests}" is never expanded.
  const fill = (text: string) =>
    text.replace(PLACEHOLDER, (_match, name: string) => {
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
  const parts = templateParts(template).map((text) => ({
    rank: rankOf(text, priority),
    filled: fill(text),
  }));

  // Drop the lowest-priority part (latest first on a tie) until the rest fits; never the last one.
  const kept = parts.map((_, i) => i);
  const dropped: string[] = [];
  const join = () => kept.map((i) => parts[i]?.filled).join(" ");
  while (smsSize(join()).segments > MAX_SEGMENTS && kept.length > 1) {
    let worst = 0;
    for (const [k, i] of kept.entries()) {
      const a = parts[i]?.rank ?? 0;
      const b = parts[kept[worst] as number]?.rank ?? 0;
      if (a >= b) worst = k;
    }
    const [gone] = kept.splice(worst, 1);
    dropped.push(parts[gone as number]?.filled ?? "");
  }

  const body = join();
  const size = smsSize(body);
  if (size.segments > MAX_SEGMENTS) {
    throw new Error(
      `Body is ${size.segments} SMS segments (${size.encoding}); the limit is ${MAX_SEGMENTS}`,
    );
  }
  return { body, dropped, ...size, fitsOneSegment: size.segments <= 1 };
}
