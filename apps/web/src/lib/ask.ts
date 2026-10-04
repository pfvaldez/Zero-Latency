// The ask flow, in the order the non-negotiables require (GR-4, GR-3):
//   1. decideSafety first. A safety question never reaches the matcher and is never stored.
//   2. the matcher.
//   3. decide() with the pack's own threshold: confirm, or save for Noor.
// Nothing plays until the guest confirms.

import {
  type AskOutcome,
  decide,
  decideSafety,
  type FarmPackManifest,
  type MatchResult,
  type OutboxItem,
  redact,
  themeOf,
  type VisitorLang,
} from "@asknoor/core";
import type { Matcher, Outbox } from "@/services/types.ts";

export interface AskResult {
  outcome: AskOutcome;
  /** The best matches, for the demo-mode score line only. Empty for a safety question. */
  top: MatchResult[];
}

export async function ask(
  text: string,
  matcher: Matcher,
  manifest: FarmPackManifest,
): Promise<AskResult> {
  if (decideSafety(text)) return { outcome: { kind: "safety" }, top: [] };
  const top = await matcher.match(text, 3);
  return { outcome: decide(top, manifest.thresholds), top };
}

/** Saves a question for Noor. Emails and phone numbers are redacted first; no name or contact is ever asked for. */
export async function saveQuestion(
  outbox: Outbox,
  manifest: FarmPackManifest,
  lang: VisitorLang,
  text: string,
): Promise<OutboxItem> {
  const clean = redact(text);
  const item: OutboxItem = {
    type: "question",
    id: crypto.randomUUID(),
    farmId: manifest.farmId,
    lang,
    text: clean,
    deviceTheme: themeOf(clean),
    createdAt: new Date().toISOString(),
  };
  await outbox.add(item);
  return item;
}
