import type { MatchResult } from "@asknoor/core";

/** Dot product of two normalized vectors (cosine similarity). */
export function dot(a: Float32Array, b: Float32Array, bOffset = 0): number {
  let sum = 0;
  for (let i = 0; i < a.length; i++) sum += (a[i] ?? 0) * (b[bOffset + i] ?? 0);
  return sum;
}

/**
 * Scores a normalized query vector against the pack's embedding matrix (row i belongs to rows[i]'s
 * moment) and returns the best `k` moments, highest first. A moment's score is its best row, so
 * short index-only phrasings and the checked subtitle text compete on equal terms.
 */
export function topMoments(
  query: Float32Array,
  matrix: Float32Array,
  rows: readonly { momentId: string }[],
  dim: number,
  k = 3,
): MatchResult[] {
  const best = new Map<string, number>();
  for (const [i, row] of rows.entries()) {
    const score = dot(query, matrix, i * dim);
    if (score > (best.get(row.momentId) ?? Number.NEGATIVE_INFINITY)) best.set(row.momentId, score);
  }
  return [...best.entries()]
    .map(([momentId, score]) => ({ momentId, score }))
    .sort((a, b) => b.score - a.score)
    .slice(0, k);
}
