import { describe, expect, it } from "vitest";
import { decide } from "../src/guardrails/decide.ts";
import type { MatchResult } from "../src/types.ts";

const T = { match: 0.8, margin: 0.05 };
const SAVED = { kind: "saved", reason: "below-threshold" } as const;

describe("decide", () => {
  it("confirms exactly at the threshold", () => {
    expect(decide([{ momentId: "c1-m1", score: 0.8 }], T)).toEqual({
      kind: "confirm",
      momentId: "c1-m1",
      score: 0.8,
    });
  });

  it("confirms just above the threshold", () => {
    expect(decide([{ momentId: "c1-m1", score: 0.8001 }], T).kind).toBe("confirm");
  });

  it("saves just below the threshold", () => {
    expect(decide([{ momentId: "c1-m1", score: 0.7999 }], T)).toEqual(SAVED);
  });

  it("saves when there are no results", () => {
    expect(decide([], T)).toEqual(SAVED);
  });

  it("picks the best result even when the input is unsorted", () => {
    const results: MatchResult[] = [
      { momentId: "a", score: 0.5 },
      { momentId: "b", score: 0.91 },
      { momentId: "c", score: 0.85 },
    ];
    expect(decide(results, T)).toEqual({ kind: "confirm", momentId: "b", score: 0.91 });
  });

  it("keeps the first result on a tie", () => {
    const results: MatchResult[] = [
      { momentId: "first", score: 0.9 },
      { momentId: "second", score: 0.9 },
    ];
    expect(decide(results, T)).toMatchObject({ momentId: "first" });
  });

  it("saves on NaN and ignores non-finite scores", () => {
    expect(decide([{ momentId: "a", score: Number.NaN }], T)).toEqual(SAVED);
    expect(decide([{ momentId: "a", score: Number.POSITIVE_INFINITY }], T)).toEqual(SAVED);
    const mixed: MatchResult[] = [
      { momentId: "bad", score: Number.NaN },
      { momentId: "good", score: 0.81 },
    ];
    expect(decide(mixed, T)).toMatchObject({ kind: "confirm", momentId: "good" });
  });

  it("handles thresholds of 0 and 1", () => {
    expect(decide([{ momentId: "a", score: 0 }], { match: 0, margin: 0 }).kind).toBe("confirm");
    expect(decide([{ momentId: "a", score: 1 }], { match: 1, margin: 0 }).kind).toBe("confirm");
    expect(decide([{ momentId: "a", score: 0.9999 }], { match: 1, margin: 0 }).kind).toBe("saved");
  });

  it("saves when the threshold is NaN instead of confirming everything", () => {
    expect(decide([{ momentId: "a", score: 0.1 }], { match: Number.NaN, margin: 0 })).toEqual(
      SAVED,
    );
  });

  it("is pure: no mutation, same input gives the same output", () => {
    const results: MatchResult[] = [
      { momentId: "a", score: 0.7 },
      { momentId: "b", score: 0.9 },
    ];
    const copy = structuredClone(results);
    const first = decide(results, T);
    expect(decide(results, T)).toEqual(first);
    expect(results).toEqual(copy);
  });

  it("never returns the safety outcome", () => {
    const scores = [Number.NaN, -1, 0, 0.5, 0.8, 1, 2];
    for (const score of scores) {
      expect(decide([{ momentId: "a", score }], T).kind).not.toBe("safety");
    }
  });

  it("carries the moment id and score through unchanged", () => {
    expect(decide([{ momentId: "c3-m1", score: 0.8734 }], T)).toEqual({
      kind: "confirm",
      momentId: "c3-m1",
      score: 0.8734,
    });
  });
});
