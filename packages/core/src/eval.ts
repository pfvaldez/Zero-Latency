// Evaluation of the matcher and the threshold, as pure maths over scored questions. The score
// tables come from the embeddings (packages/pack); the rule is the real decide() the phone uses,
// so the sweep cannot drift from what guests see.
//
// Definitions (Slice 2 decision, 2026-10-04):
//   answered question      Noor has recorded a published answer for it
//   never-answered         expected "none", or an answer that is not published yet (clip 8 held back)
//   confirm                decide() returns a confirm card
//   false confirmation     a confirm for the wrong moment, or for a never-answered question
//   false-confirm rate     false confirmations / all non-safety questions
//   fail-safe rate         never-answered questions that were saved / never-answered questions

import { decide } from "./guardrails/decide.ts";
import type { MatchResult, Thresholds } from "./types.ts";

export interface ScoredQuestion {
  id: string;
  lang: string;
  variant: string;
  /** "clipNN", "none" or "safety", as in test-questions.csv. */
  expected: string;
  /** What decideSafety() said for the question text. */
  safetyHit: boolean;
  /** Moment scores, best first or not; one entry per moment. Ignored for safety questions. */
  results: MatchResult[];
}

export interface Metrics {
  threshold: number;
  questions: number; // non-safety questions
  answered: number;
  neverAnswered: number;
  top1: number; // answered questions whose best-scoring moment is the right one
  correctConfirm: number;
  wrongClipConfirm: number;
  confirmOnNever: number;
  missed: number; // answered but saved (not confirmed)
  savedOnNever: number;
  falseConfirmRate: number;
  top1Rate: number;
  coverage: number; // correct confirms / answered
  failSafeRate: number;
  safetyQuestions: number;
  safetyRecall: number; // safety questions that hit the safety card
  safetyFalsePositives: number; // non-safety questions diverted to the safety card
}

const ratio = (num: number, den: number) => (den === 0 ? 0 : num / den);

/** "clip03" -> "c3-m1", the moment id of a clip's only moment. */
export function momentOfClip(expected: string): string | null {
  const m = /^clip(\d+)$/.exec(expected);
  return m ? `c${Number(m[1])}-m1` : null;
}

function best(results: readonly MatchResult[]): MatchResult | undefined {
  let top: MatchResult | undefined;
  for (const r of results) if (top === undefined || r.score > top.score) top = r;
  return top;
}

/**
 * Metrics at one threshold. `published` is the set of moment ids that are in the pack; a question
 * whose answer is not published counts as never-answered (the held-back overnight answer).
 */
export function evaluate(
  questions: readonly ScoredQuestion[],
  threshold: number,
  published: ReadonlySet<string>,
  margin = 0,
): Metrics {
  const t: Thresholds = { match: threshold, margin };
  const m: Metrics = {
    threshold,
    questions: 0,
    answered: 0,
    neverAnswered: 0,
    top1: 0,
    correctConfirm: 0,
    wrongClipConfirm: 0,
    confirmOnNever: 0,
    missed: 0,
    savedOnNever: 0,
    falseConfirmRate: 0,
    top1Rate: 0,
    coverage: 0,
    failSafeRate: 0,
    safetyQuestions: 0,
    safetyRecall: 0,
    safetyFalsePositives: 0,
  }; // fmt: skip
  let safetyHits = 0;
  for (const q of questions) {
    if (q.expected === "safety") {
      m.safetyQuestions++;
      if (q.safetyHit) safetyHits++;
      continue;
    }
    if (q.safetyHit) m.safetyFalsePositives++; // diverted to the card: never a confirm
    m.questions++;
    const answer = momentOfClip(q.expected);
    const answered = answer !== null && published.has(answer);
    const outcome = q.safetyHit ? { kind: "safety" as const } : decide(q.results, t);
    if (answered) {
      m.answered++;
      if (best(q.results)?.momentId === answer) m.top1++;
      if (outcome.kind === "confirm") {
        if (outcome.momentId === answer) m.correctConfirm++;
        else m.wrongClipConfirm++;
      } else m.missed++;
    } else {
      m.neverAnswered++;
      if (outcome.kind === "confirm") m.confirmOnNever++;
      else m.savedOnNever++;
    }
  }
  m.falseConfirmRate = ratio(m.wrongClipConfirm + m.confirmOnNever, m.questions);
  m.top1Rate = ratio(m.top1, m.answered);
  m.coverage = ratio(m.correctConfirm, m.answered);
  m.failSafeRate = ratio(m.savedOnNever, m.neverAnswered);
  m.safetyRecall = ratio(safetyHits, m.safetyQuestions);
  return m;
}

/** Thresholds from `from` to `to` inclusive in `step` steps, rounded to avoid float drift. */
export function thresholdGrid(from: number, to: number, step: number): number[] {
  const out: number[] = [];
  for (let i = 0; from + i * step <= to + 1e-9; i++)
    out.push(Math.round((from + i * step) * 1e6) / 1e6);
  return out;
}

export function sweep(
  questions: readonly ScoredQuestion[],
  grid: readonly number[],
  published: ReadonlySet<string>,
  margin = 0,
): Metrics[] {
  return grid.map((t) => evaluate(questions, t, published, margin));
}

/** The lowest threshold whose false-confirm rate is at or under `maxFalseConfirm`; null if none. */
export function pickThreshold(rows: readonly Metrics[], maxFalseConfirm = 0.05): Metrics | null {
  const ok = rows.filter((r) => r.falseConfirmRate <= maxFalseConfirm + 1e-12);
  if (ok.length === 0) return null;
  return ok.reduce((a, b) => (b.threshold < a.threshold ? b : a));
}

/** Wilson 95% interval for k successes out of n. */
export function wilson(k: number, n: number, z = 1.96): { low: number; high: number } {
  if (n === 0) return { low: 0, high: 0 };
  const p = k / n;
  const denom = 1 + (z * z) / n;
  const centre = (p + (z * z) / (2 * n)) / denom;
  const half = (z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n))) / denom;
  return { low: Math.max(0, centre - half), high: Math.min(1, centre + half) };
}

export interface LeaveOneOut {
  lang: string;
  threshold: number | null; // chosen on the other languages
  heldOut: Metrics | null; // measured on this language at that threshold
}

/** Choose the threshold on all other languages, then measure it on the one left out. */
export function leaveOneLanguageOut(
  questions: readonly ScoredQuestion[],
  grid: readonly number[],
  published: ReadonlySet<string>,
  maxFalseConfirm = 0.05,
  margin = 0,
): LeaveOneOut[] {
  const langs = [...new Set(questions.map((q) => q.lang))];
  return langs.map((lang) => {
    const rest = questions.filter((q) => q.lang !== lang);
    const chosen = pickThreshold(sweep(rest, grid, published, margin), maxFalseConfirm);
    if (chosen === null) return { lang, threshold: null, heldOut: null };
    const own = questions.filter((q) => q.lang === lang);
    return {
      lang,
      threshold: chosen.threshold,
      heldOut: evaluate(own, chosen.threshold, published, margin),
    };
  });
}

/** Counts of `values` in `bins` equal-width bins over [lo, hi]; values outside are clamped. */
export function histogram(
  values: readonly number[],
  lo: number,
  hi: number,
  bins: number,
): number[] {
  const counts = new Array<number>(bins).fill(0);
  for (const v of values) {
    const i = Math.min(bins - 1, Math.max(0, Math.floor(((v - lo) / (hi - lo)) * bins)));
    counts[i] = (counts[i] ?? 0) + 1;
  }
  return counts;
}

/** Group questions by a key (language, variant) and evaluate each group at one threshold. */
export function breakdown(
  questions: readonly ScoredQuestion[],
  key: (q: ScoredQuestion) => string,
  threshold: number,
  published: ReadonlySet<string>,
  margin = 0,
): Record<string, Metrics> {
  const groups = new Map<string, ScoredQuestion[]>();
  for (const q of questions) groups.set(key(q), [...(groups.get(key(q)) ?? []), q]);
  return Object.fromEntries(
    [...groups].map(([k, qs]) => [k, evaluate(qs, threshold, published, margin)]),
  );
}
