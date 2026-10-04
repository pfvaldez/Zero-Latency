// Leakage audit for index-only passages: they are written without looking at the test questions,
// so none of them should repeat one. This measures how close they come (token overlap after
// normalization) and finds exact repeats, which are then removed rather than rewritten.

import { normalize } from "./text/normalize.ts";

export interface AuditPassage {
  clip: string;
  lang: string;
  text: string;
}
export interface AuditQuestion {
  id: string;
  lang: string;
  question: string;
}

export interface LeakageReport {
  passages: number;
  /** Passages whose normalized text equals a test question in the same language. */
  exact: { clip: string; lang: string; text: string; questionId: string }[];
  /** Highest token-overlap (Jaccard) between any passage and any question of the same language. */
  maxOverlap: number;
  worst: { clip: string; lang: string; text: string; questionId: string; overlap: number } | null;
  /** How many passages have their best overlap in [0, .2), [.2, .4), [.4, .6), [.6, .8), [.8, 1]. */
  bestOverlapBins: number[];
  /** For each passage, in the order given: its best overlap with a question of the same language. */
  best: number[];
}

const tokens = (text: string) =>
  normalize(text)
    .split(" ")
    .filter((t) => t.length > 0);
const jaccard = (a: ReadonlySet<string>, b: ReadonlySet<string>) => {
  let both = 0;
  for (const t of a) if (b.has(t)) both++;
  const union = a.size + b.size - both;
  return union === 0 ? 0 : both / union;
};

export function leakageAudit(
  passages: readonly AuditPassage[],
  questions: readonly AuditQuestion[],
): LeakageReport {
  const exact: LeakageReport["exact"] = [];
  const bins = [0, 0, 0, 0, 0];
  let maxOverlap = 0;
  let worst: LeakageReport["worst"] = null;
  const bestPer: number[] = [];
  for (const p of passages) {
    const mine = new Set(tokens(p.text));
    const norm = normalize(p.text);
    let best = 0;
    for (const q of questions) {
      if (q.lang !== p.lang) continue;
      if (normalize(q.question) === norm)
        exact.push({ clip: p.clip, lang: p.lang, text: p.text, questionId: q.id });
      const o = jaccard(mine, new Set(tokens(q.question)));
      if (o > best) best = o;
      if (o > maxOverlap) {
        maxOverlap = o;
        worst = { clip: p.clip, lang: p.lang, text: p.text, questionId: q.id, overlap: o };
      }
    }
    bestPer.push(best);
    const bin = Math.min(4, Math.floor(best * 5));
    bins[bin] = (bins[bin] ?? 0) + 1;
  }
  return {
    passages: passages.length,
    exact,
    maxOverlap,
    worst,
    bestOverlapBins: bins,
    best: bestPer,
  };
}
