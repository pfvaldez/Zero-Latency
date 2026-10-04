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

// ---- honest estimate ---------------------------------------------------------------------------
import { assignSlots, crossValidate, pool, shippedThreshold, splitSlots } from "../src/eval.ts";

// 4 languages x 6 slots, parallel: slot 0..1 answered (clip01, clip02), 2..3 never answered, 4 held back, 5 safety.
const SHAPE: [string, string][] = [
  ["clip01", "plain"],
  ["clip02", "plain"],
  ["none", "plain"],
  ["none", "typo"],
  ["clip01", "paraphrase"],
  ["safety", "plain"],
]; // fmt: skip
const LANGS = ["en", "de", "nl", "sv"];
function parallel(score: (lang: string, slot: number) => number): ScoredQuestion[] {
  return LANGS.flatMap((lang, li) =>
    SHAPE.map(([expected, variant], slot) => {
      const id = `q${String(li * 6 + slot + 1).padStart(3, "0")}`;
      const answer = expected === "clip01" ? "c1-m1" : expected === "clip02" ? "c2-m1" : "c3-m1";
      return q(id, expected, expected === "safety" ? [] : [[answer, score(lang, slot)]], {
        lang,
        variant,
        safetyHit: expected === "safety",
      }); // fmt: skip
    }),
  );
}

describe("assignSlots and splitSlots", () => {
  const qs = parallel(() => 0.9);
  it("gives the same slot to the same question in every language", () => {
    const slots = assignSlots(qs);
    expect(slots.slice(0, 6)).toEqual([0, 1, 2, 3, 4, 5]);
    expect(slots.slice(6, 12)).toEqual([0, 1, 2, 3, 4, 5]);
  });

  it("refuses questions that are not parallel across languages", () => {
    const broken = qs.map((x, i) => (i === 7 ? { ...x, expected: "none" } : x));
    expect(() => assignSlots(broken)).toThrow(/not parallel/);
    expect(() => assignSlots(qs.slice(0, 20))).toThrow(/not parallel/);
  });

  it("splits the slots into disjoint halves that cover everything", () => {
    const { a, b } = splitSlots(qs);
    expect([...a].filter((s) => b.has(s))).toEqual([]);
    expect([...a, ...b].sort()).toEqual([0, 1, 2, 3, 4, 5]);
  });

  it("is deterministic and keeps each stratum balanced (sizes differ by at most one)", () => {
    expect(splitSlots(qs)).toEqual(splitSlots(qs));
    const { a, b } = splitSlots(qs);
    // Strata by expected answer: clip01 {0, 4}, clip02 {1}, none {2, 3}, safety {5}.
    expect(Math.abs(a.size - b.size)).toBeLessThanOrEqual(1);
    for (const stratum of [
      [0, 4],
      [2, 3],
    ]) {
      expect(stratum.filter((s) => a.has(s)).length).toBe(1); // a stratum of two is split one and one
    }
  });

  it("puts every language in both halves, and a slot's twins always land together", () => {
    const { a } = splitSlots(qs);
    const slots = assignSlots(qs);
    for (const lang of LANGS) {
      const own = qs
        .map((x, i) => [x, slots[i] as number] as const)
        .filter(([x]) => x.lang === lang);
      expect(own.some(([, s]) => a.has(s))).toBe(true);
      expect(own.some(([, s]) => !a.has(s))).toBe(true);
    }
  });

  it("balances a real-sized table: 29 slots, strata alternating", () => {
    const shape29 = Array.from({ length: 29 }, (_, i): [string, string] => [
      i < 14 ? `clip0${(i % 7) + 1}` : i < 18 ? "clip08" : i < 25 ? "none" : "safety",
      ["plain", "paraphrase", "typo"][i % 3] as string,
    ]);
    const big = LANGS.flatMap((lang, li) =>
      shape29.map(([e, v], s) =>
        q(`q${String(li * 29 + s + 1).padStart(3, "0")}`, e, [["c1-m1", 0.8]], {
          lang,
          variant: v,
        }),
      ),
    );
    const { a, b } = splitSlots(big);
    expect(a.size + b.size).toBe(29);
    expect(Math.abs(a.size - b.size)).toBeLessThanOrEqual(1);
    // Each clip's two slots are split between the halves, and the 7 never-answered slots 4 and 3.
    const slotsOf = (e: string) =>
      big
        .filter((x) => x.lang === "en" && x.expected === e)
        .map((x) => assignSlots(big)[big.indexOf(x)] as number);
    for (const e of ["clip01", "clip02", "clip07"])
      expect(slotsOf(e).filter((s) => a.has(s)).length).toBe(1);
    expect(
      Math.abs(
        slotsOf("none").filter((s) => a.has(s)).length -
          slotsOf("none").filter((s) => b.has(s)).length,
      ),
    ).toBe(1);
  });
});

describe("pool", () => {
  it("sums counts and recomputes the rates", () => {
    const x = evaluate(TABLE, 0.7, PUBLISHED);
    const y = evaluate(TABLE, 0.9, PUBLISHED);
    const p = pool([x, y]);
    expect(p.questions).toBe(x.questions + y.questions);
    expect(p.correctConfirm).toBe(x.correctConfirm + y.correctConfirm);
    expect(p.falseConfirmRate).toBeCloseTo(
      (x.wrongClipConfirm + x.confirmOnNever + y.wrongClipConfirm + y.confirmOnNever) / p.questions,
    );
    expect(pool([]).falseConfirmRate).toBe(0);
  });
});

describe("crossValidate", () => {
  const grid = thresholdGrid(0.5, 1.0, 0.01);
  // Scores that make a single global threshold overfit: in slot 0 and 1 (answered) the score depends
  // on the half, so a threshold tuned on one half is wrong for the other.
  const qs = parallel((_lang, slot) =>
    slot === 2 ? 0.86 : slot === 3 ? 0.7 : slot === 0 ? 0.88 : slot === 1 ? 0.8 : 0.9,
  );

  it("tunes on one half and reports on the other, in both directions", () => {
    const cv = crossValidate(qs, grid, PUBLISHED, 0.05);
    expect(cv.folds.map((f) => [f.tuneOn, f.reportOn])).toEqual([
      ["A", "B"],
      ["B", "A"],
    ]);
    expect(cv.slotsA + cv.slotsB).toBe(6);
    for (const f of cv.folds) {
      expect(f.threshold).not.toBeNull();
      expect(f.inSample?.threshold).toBe(f.threshold);
      expect(f.heldOut?.threshold).toBe(f.threshold);
    }
  });

  it("never lets tuning see the report half: poisoning the report half changes nothing about the threshold", () => {
    const halves = splitSlots(qs);
    const slots = assignSlots(qs);
    const clean = crossValidate(qs, grid, PUBLISHED, 0.05);
    // Make every question in half B score 1.0 on a wrong moment: a leak would raise fold A's threshold.
    const poisoned = qs.map((x, i) =>
      halves.b.has(slots[i] as number) && x.expected !== "safety"
        ? { ...x, results: [{ momentId: "c3-m1", score: 1 }] }
        : x,
    );
    const dirty = crossValidate(poisoned, grid, PUBLISHED, 0.05);
    expect(dirty.folds[0].threshold).toBe(clean.folds[0].threshold); // fold A tuned on half A only
    expect(dirty.folds[1].threshold).not.toBe(clean.folds[1].threshold); // fold B tuned on the poisoned half
  });

  it("is worse on the held-out half than in sample when the threshold overfits", () => {
    const cv = crossValidate(qs, grid, PUBLISHED, 0.05);
    const pooled = cv.pooled;
    expect(pooled).not.toBeNull();
    for (const f of cv.folds) expect(f.inSample?.falseConfirmRate).toBeLessThanOrEqual(0.05);
    expect(pooled?.questions).toBe(20); // 4 languages x 5 ordinary slots, each reported once
  });

  it("reports every language and pools each question exactly once", () => {
    const cv = crossValidate(qs, grid, PUBLISHED, 0.05);
    expect(Object.keys(cv.byLang).sort()).toEqual([...LANGS].sort());
    expect(Object.values(cv.byLang).reduce((n, m) => n + m.questions, 0)).toBe(
      cv.pooled?.questions,
    );
  });

  it("returns nulls when a half has no threshold that meets the limit", () => {
    const impossible = parallel(() => 2); // every score is above the grid: nothing can be saved
    const cv = crossValidate(impossible, grid, PUBLISHED, 0);
    expect(cv.folds.every((f) => f.threshold === null)).toBe(true);
    expect(cv.pooled).toBeNull();
  });
});

describe("shippedThreshold: the strictest of the three picks", () => {
  it("takes the maximum", () => {
    expect(shippedThreshold(0.85, [0.83, 0.87], 0.99)).toBe(0.87);
    expect(shippedThreshold(0.9, [0.83, 0.87], 0.99)).toBe(0.9);
  });
  it("falls back to the top of the grid when any pick is missing", () => {
    expect(shippedThreshold(0.85, [null, 0.87], 0.99)).toBe(0.99);
    expect(shippedThreshold(null, [0.8, 0.8], 0.99)).toBe(0.99);
  });
});
