// Threshold logic (non-negotiable 3, GR-3): below the threshold the question is saved for Noor,
// never guessed. Otherwise the guest is asked to confirm the top moment; nothing plays until
// they tap Yes.
//
// Safety is decided BEFORE this is called (decideSafety), so this never returns `safety`.
// `thresholds.margin` is not used yet: the P1 "is it A or B?" step will use it.

import type { AskOutcome, MatchResult, Thresholds } from "../types.ts";

export function decide(results: readonly MatchResult[], thresholds: Thresholds): AskOutcome {
  let best: MatchResult | undefined;
  for (const result of results) {
    if (!Number.isFinite(result.score)) continue;
    // Strictly greater, so a tie keeps the first result in input order.
    if (best === undefined || result.score > best.score) best = result;
  }
  // Written as !(>=) so a NaN threshold saves instead of confirming everything.
  if (best === undefined || !(best.score >= thresholds.match)) {
    return { kind: "saved", reason: "below-threshold" };
  }
  return { kind: "confirm", momentId: best.momentId, score: best.score };
}
