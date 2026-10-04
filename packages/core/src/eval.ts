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

// ---- honest estimate: split by question slot, tune on one half, report on the other --------------
//
// The test questions are parallel across languages: slot i of every language is the same question
// (same expected answer, same variant). Splitting by row would put a German question in the tuning
// half and its English twin in the report half. So the unit of the split is the slot.

/** Slot of each question: its position within its own language, in id order. Throws if the
 *  languages are not parallel (same expected answer and variant at every slot). */
export function assignSlots(questions: readonly ScoredQuestion[]): number[] {
  const byLang = new Map<string, ScoredQuestion[]>();
  for (const q of questions) byLang.set(q.lang, [...(byLang.get(q.lang) ?? []), q]);
  const blocks = [...byLang.values()].map((qs) => [...qs].sort((a, b) => a.id.localeCompare(b.id)));
  const shape = (qs: readonly ScoredQuestion[]) =>
    qs.map((q) => `${q.expected}|${q.variant}`).join(",");
  const first = blocks[0] ?? [];
  if (blocks.some((b) => shape(b) !== shape(first)))
    throw new Error("the questions are not parallel across languages");
  const slot = new Map<string, number>();
  for (const block of blocks) for (const [i, q] of block.entries()) slot.set(q.id, i);
  return questions.map((q) => slot.get(q.id) as number);
}

export interface Halves {
  a: ReadonlySet<number>;
  b: ReadonlySet<number>;
}

/**
 * Deterministic split of the slots into halves A and B. Stratified by expected answer (each clip,
 * the never-answered questions, the safety questions), and inside each stratum every slot goes to
 * the half that has fewer of that stratum so far (then fewer overall, then A). So each stratum
 * differs by at most one slot between the halves and the whole split stays balanced.
 */
export function splitSlots(questions: readonly ScoredQuestion[]): Halves {
  const slots = assignSlots(questions);
  const stratum = new Map<number, string>();
  for (const [i, q] of questions.entries()) stratum.set(slots[i] as number, q.expected);
  const groups = new Map<string, number[]>();
  for (const slot of [...stratum.keys()].sort((x, y) => x - y)) {
    const key = stratum.get(slot) as string;
    groups.set(key, [...(groups.get(key) ?? []), slot]);
  }
  const a = new Set<number>();
  const b = new Set<number>();
  for (const key of [...groups.keys()].sort()) {
    let inA = 0;
    let inB = 0;
    for (const slot of groups.get(key) as number[]) {
      const toA = inA !== inB ? inA < inB : a.size <= b.size;
      if (toA) {
        a.add(slot);
        inA++;
      } else {
        b.add(slot);
        inB++;
      }
    }
  }
  return { a, b };
}

export type PooledMetrics = Omit<Metrics, "threshold">;

/** Sum the counts of several held-out reports and recompute every rate from the sums. */
export function pool(list: readonly Metrics[]): PooledMetrics {
  const sum = (f: (m: Metrics) => number) => list.reduce((n, m) => n + f(m), 0);
  const p = {
    questions: sum((m) => m.questions),
    answered: sum((m) => m.answered),
    neverAnswered: sum((m) => m.neverAnswered),
    top1: sum((m) => m.top1),
    correctConfirm: sum((m) => m.correctConfirm),
    wrongClipConfirm: sum((m) => m.wrongClipConfirm),
    confirmOnNever: sum((m) => m.confirmOnNever),
    missed: sum((m) => m.missed),
    savedOnNever: sum((m) => m.savedOnNever),
    safetyQuestions: sum((m) => m.safetyQuestions),
    safetyFalsePositives: sum((m) => m.safetyFalsePositives),
  }; // fmt: skip
  const safetyHits = list.reduce((n, m) => n + Math.round(m.safetyRecall * m.safetyQuestions), 0);
  return {
    ...p,
    falseConfirmRate: ratio(p.wrongClipConfirm + p.confirmOnNever, p.questions),
    top1Rate: ratio(p.top1, p.answered),
    coverage: ratio(p.correctConfirm, p.answered),
    failSafeRate: ratio(p.savedOnNever, p.neverAnswered),
    safetyRecall: ratio(safetyHits, p.safetyQuestions),
  };
}

export interface Fold {
  tuneOn: "A" | "B";
  reportOn: "A" | "B";
  /** The threshold chosen on the tuning half alone; null if none meets the limit there. */
  threshold: number | null;
  /** The same threshold measured on the tuning half (in sample). */
  inSample: Metrics | null;
  /** The honest number: that threshold measured on the other half. */
  heldOut: Metrics | null;
}

export interface CrossValidation {
  slotsA: number;
  slotsB: number;
  folds: [Fold, Fold];
  /** Both held-out reports pooled (each fold's own threshold, counts summed). */
  pooled: PooledMetrics | null;
  /** Pooled held-out numbers per language. */
  byLang: Record<string, PooledMetrics>;
}

/**
 * Choose the threshold on one half and report on the other, then swap. Tuning never sees the
 * report half: each fold's threshold is a function of its tuning questions only.
 */
export function crossValidate(
  questions: readonly ScoredQuestion[],
  grid: readonly number[],
  published: ReadonlySet<string>,
  maxFalseConfirm = 0.05,
  margin = 0,
): CrossValidation {
  const halves = splitSlots(questions);
  const slots = assignSlots(questions);
  const inHalf = (set: ReadonlySet<number>) =>
    questions.filter((_, i) => set.has(slots[i] as number));
  const fold = (tuneOn: "A" | "B"): Fold => {
    const tune = inHalf(tuneOn === "A" ? halves.a : halves.b);
    const report = inHalf(tuneOn === "A" ? halves.b : halves.a);
    const picked = pickThreshold(sweep(tune, grid, published, margin), maxFalseConfirm);
    if (picked === null)
      return {
        tuneOn,
        reportOn: tuneOn === "A" ? "B" : "A",
        threshold: null,
        inSample: null,
        heldOut: null,
      };
    return {
      tuneOn,
      reportOn: tuneOn === "A" ? "B" : "A",
      threshold: picked.threshold,
      inSample: picked,
      heldOut: evaluate(report, picked.threshold, published, margin),
    };
  };
  const folds: [Fold, Fold] = [fold("A"), fold("B")];
  const held = folds.map((f) => f.heldOut).filter((m): m is Metrics => m !== null);
  const byLang: Record<string, PooledMetrics> = {};
  for (const lang of [...new Set(questions.map((q) => q.lang))]) {
    const parts: Metrics[] = [];
    for (const f of folds) {
      if (f.threshold === null) continue;
      const set = f.reportOn === "A" ? halves.a : halves.b;
      const own = questions.filter((q, i) => q.lang === lang && set.has(slots[i] as number));
      parts.push(evaluate(own, f.threshold, published, margin));
    }
    byLang[lang] = pool(parts);
  }
  return {
    slotsA: halves.a.size,
    slotsB: halves.b.size,
    folds,
    pooled: held.length === folds.length ? pool(held) : null,
    byLang,
  };
}

/**
 * The threshold that ships: the strictest of the full-set pick and both fold picks, so it is never
 * looser than any honest estimate. If any pick is missing, fall back to the top of the grid.
 */
export function shippedThreshold(
  fullSetPick: number | null,
  foldPicks: readonly (number | null)[],
  gridMax: number,
): number {
  const picks = [fullSetPick, ...foldPicks];
  if (picks.some((p) => p === null)) return gridMax;
  return Math.max(...(picks as number[]));
}
