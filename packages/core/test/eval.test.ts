import { describe, expect, it } from "vitest";
import {
  breakdown,
  evaluate,
  histogram,
  leaveOneLanguageOut,
  momentOfClip,
  pickThreshold,
  type ScoredQuestion,
  sweep,
  thresholdGrid,
  wilson,
} from "../src/eval.ts";

const PUBLISHED = new Set(["c1-m1", "c2-m1", "c3-m1"]);
const q = (
  id: string,
  expected: string,
  results: [string, number][],
  extra: Partial<ScoredQuestion> = {},
): ScoredQuestion => ({
  id,
  lang: "en",
  variant: "plain",
  expected,
  safetyHit: false,
  results: results.map(([momentId, score]) => ({ momentId, score })),
  ...extra,
});

// Known answers. Answered: a (0.90 right), b (0.80 right), c (0.70 wrong clip on top).
// Never answered: d (0.85), e (0.60). Held back (clip08, not published): f (0.75).
const TABLE: ScoredQuestion[] = [
  q("a", "clip01", [
    ["c1-m1", 0.9],
    ["c2-m1", 0.3],
  ]),
  q("b", "clip02", [
    ["c2-m1", 0.8],
    ["c1-m1", 0.4],
  ]),
  q("c", "clip03", [
    ["c1-m1", 0.7],
    ["c3-m1", 0.65],
  ]),
  q("d", "none", [["c1-m1", 0.85]]),
  q("e", "none", [["c2-m1", 0.6]]),
  q("f", "clip08", [["c3-m1", 0.75]]),
  q("s", "safety", [], { safetyHit: true }),
];

describe("momentOfClip", () => {
  it("maps clip numbers to their moment", () => {
    expect(momentOfClip("clip03")).toBe("c3-m1");
    expect(momentOfClip("clip10")).toBe("c10-m1");
    expect(momentOfClip("none")).toBeNull();
    expect(momentOfClip("safety")).toBeNull();
  });
});

describe("evaluate", () => {
  it("counts questions and classes (safety excluded, held-back clip is never-answered)", () => {
    const m = evaluate(TABLE, 0.7, PUBLISHED);
    expect(m).toMatchObject({ questions: 6, answered: 3, neverAnswered: 3, safetyQuestions: 1 });
  });

  it("at 0.70: a, b confirm right; c confirms the wrong clip; d and f confirm on never-answered; e saved", () => {
    const m = evaluate(TABLE, 0.7, PUBLISHED);
    expect(m.correctConfirm).toBe(2);
    expect(m.wrongClipConfirm).toBe(1);
    expect(m.confirmOnNever).toBe(2);
    expect(m.savedOnNever).toBe(1);
    expect(m.falseConfirmRate).toBeCloseTo(3 / 6);
    expect(m.top1).toBe(2); // c's best moment is wrong
    expect(m.top1Rate).toBeCloseTo(2 / 3);
    expect(m.failSafeRate).toBeCloseTo(1 / 3);
    expect(m.coverage).toBeCloseTo(2 / 3);
  });

  it("confirms exactly at the threshold and saves just above it", () => {
    expect(evaluate(TABLE, 0.9, PUBLISHED).correctConfirm).toBe(1); // a: 0.9 >= 0.9
    expect(evaluate(TABLE, 0.9 + 1e-9, PUBLISHED).correctConfirm).toBe(0);
  });

  it("at a high threshold nothing confirms and everything is saved", () => {
    const m = evaluate(TABLE, 0.99, PUBLISHED);
    expect(m.falseConfirmRate).toBe(0);
    expect(m.missed).toBe(3);
    expect(m.failSafeRate).toBe(1);
    expect(m.coverage).toBe(0);
  });

  it("at 0 everything confirms, so every never-answered question is a false confirmation", () => {
    const m = evaluate(TABLE, 0, PUBLISHED);
    expect(m.confirmOnNever).toBe(3);
    expect(m.failSafeRate).toBe(0);
  });

  it("publishing the held-back clip turns its question into an answered one", () => {
    const all = new Set([...PUBLISHED, "c8-m1"]);
    const withEight = [
      ...TABLE.slice(0, 5),
      q("f", "clip08", [["c8-m1", 0.88]]),
      TABLE[6] as ScoredQuestion,
    ];
    expect(evaluate(withEight, 0.8, all).answered).toBe(4);
    expect(evaluate(withEight, 0.8, PUBLISHED).answered).toBe(3);
  });

  it("scores safety separately and counts a diverted ordinary question as a false positive", () => {
    const diverted = q("g", "clip01", [["c1-m1", 0.95]], { safetyHit: true });
    const m = evaluate(
      [...TABLE, diverted, q("s2", "safety", [], { safetyHit: false })],
      0.7,
      PUBLISHED,
    );
    expect(m.safetyQuestions).toBe(2);
    expect(m.safetyRecall).toBe(0.5);
    expect(m.safetyFalsePositives).toBe(1);
    expect(m.missed).toBe(1); // the diverted question is answered but never confirmed
  });

  it("handles an empty list", () => {
    const m = evaluate([], 0.8, PUBLISHED);
    expect(m.questions).toBe(0);
    expect(m.falseConfirmRate).toBe(0);
  });
});

describe("sweep and pickThreshold", () => {
  const grid = thresholdGrid(0.5, 1.0, 0.05);

  it("builds an inclusive grid without float drift", () => {
    expect(grid[0]).toBe(0.5);
    expect(grid.at(-1)).toBe(1);
    expect(grid).toHaveLength(11);
    expect(thresholdGrid(0.6, 0.99, 0.0025)).toHaveLength(157);
  });

  it("false confirmations never rise as the threshold rises", () => {
    const rows = sweep(TABLE, grid, PUBLISHED);
    for (let i = 1; i < rows.length; i++) {
      expect(rows[i]?.falseConfirmRate).toBeLessThanOrEqual(rows[i - 1]?.falseConfirmRate ?? 1);
    }
  });

  it("picks the lowest threshold at or under the limit", () => {
    const rows = sweep(TABLE, grid, PUBLISHED);
    // False confirmations: wrong c at 0.70, d at 0.85, f at 0.75: all gone above 0.85.
    expect(pickThreshold(rows, 0)?.threshold).toBeCloseTo(0.9);
    expect(pickThreshold(rows, 1 / 6 + 1e-9)?.threshold).toBeCloseTo(0.8); // one false confirm left (d)
    expect(pickThreshold(rows, 1)?.threshold).toBe(0.5); // anything goes: the lowest threshold
  });

  it("returns null when no threshold meets the limit", () => {
    const always = [q("x", "none", [["c1-m1", 1.5]])];
    expect(pickThreshold(sweep(always, [0.5, 1.0], PUBLISHED), 0)).toBeNull();
  });

  it("moving the threshold up trades coverage for false confirmations", () => {
    const low = evaluate(TABLE, 0.5, PUBLISHED);
    const high = evaluate(TABLE, 0.85, PUBLISHED);
    expect(high.falseConfirmRate).toBeLessThan(low.falseConfirmRate);
    expect(high.coverage).toBeLessThanOrEqual(low.coverage);
  });
});

describe("wilson", () => {
  it("is a proper interval around the proportion", () => {
    const { low, high } = wilson(5, 100);
    expect(low).toBeLessThan(0.05);
    expect(high).toBeGreaterThan(0.05);
    expect(low).toBeCloseTo(0.0215, 3);
    expect(high).toBeCloseTo(0.1118, 3);
  });
  it("handles 0 and all, and n = 0", () => {
    expect(wilson(0, 10).low).toBe(0);
    expect(wilson(10, 10).high).toBe(1);
    expect(wilson(0, 0)).toEqual({ low: 0, high: 0 });
  });
});

describe("leaveOneLanguageOut", () => {
  it("chooses on the other languages and measures on the one left out", () => {
    const de = TABLE.map((t) => ({ ...t, id: `de-${t.id}`, lang: "de" }));
    const rows = leaveOneLanguageOut([...TABLE, ...de], thresholdGrid(0.5, 1, 0.05), PUBLISHED, 0);
    expect(rows.map((r) => r.lang).sort()).toEqual(["de", "en"]);
    for (const r of rows) {
      expect(r.threshold).toBeCloseTo(0.9);
      expect(r.heldOut?.questions).toBe(6);
    }
  });
  it("reports null when no threshold works on the rest", () => {
    const bad = [
      q("x", "none", [["c1-m1", 2]], { lang: "en" }),
      q("y", "none", [["c1-m1", 2]], { lang: "de" }),
    ];
    expect(leaveOneLanguageOut(bad, [0.5], PUBLISHED, 0)[0]).toMatchObject({
      threshold: null,
      heldOut: null,
    });
  });
});

describe("histogram and breakdown", () => {
  it("bins values and clamps the edges", () => {
    expect(histogram([0.1, 0.5, 0.9, 1.5, -1], 0, 1, 4)).toEqual([2, 0, 1, 2]);
  });
  it("splits metrics by a key", () => {
    const mixed = [
      ...TABLE.slice(0, 2),
      q("z", "clip01", [["c1-m1", 0.2]], { lang: "de", variant: "typo" }),
    ];
    const byLang = breakdown(mixed, (x) => x.lang, 0.5, PUBLISHED);
    expect(Object.keys(byLang).sort()).toEqual(["de", "en"]);
    expect(byLang.en?.correctConfirm).toBe(2);
    expect(byLang.de?.missed).toBe(1);
    expect(Object.keys(breakdown(mixed, (x) => x.variant, 0.5, PUBLISHED)).sort()).toEqual([
      "plain",
      "typo",
    ]);
  });
});
