import { describe, expect, it } from "vitest";
import { leakageAudit } from "../src/leakage.ts";

const Q = [
  { id: "q001", lang: "en", question: "How do you roast the coffee?" },
  { id: "q002", lang: "de", question: "Wie rösten Sie den Kaffee?" },
  { id: "q003", lang: "en", question: "Is there wifi on the farm?" },
];
const P = (text: string, lang = "en", clip = "3") => ({ clip, lang, text });

describe("leakageAudit", () => {
  it("finds an exact repeat even when case, punctuation or accents differ", () => {
    const r = leakageAudit(
      [P("how do YOU roast the coffee"), P("Wie rosten Sie den Kaffee", "de")],
      Q,
    );
    expect(r.exact.map((e) => e.questionId)).toEqual(["q001", "q002"]);
  });

  it("only compares within a language: the same words in another language are not a repeat", () => {
    const r = leakageAudit([P("How do you roast the coffee?", "de")], Q);
    expect(r.exact).toEqual([]);
    expect(r.maxOverlap).toBe(0);
  });

  it("measures token overlap (Jaccard) and reports the worst pair", () => {
    // tokens {how, do, you, roast, the, coffee, beans} vs {how, do, you, roast, the, coffee}: 6 / 7
    const r = leakageAudit([P("How do you roast the coffee beans?")], Q);
    expect(r.exact).toEqual([]);
    expect(r.maxOverlap).toBeCloseTo(6 / 7, 5);
    expect(r.worst).toMatchObject({
      questionId: "q001",
      text: "How do you roast the coffee beans?",
    });
  });

  it("returns the best overlap per passage, in order, and bins them in fifths", () => {
    const r = leakageAudit(
      [P("roasting over fire"), P("wifi farm"), P("How do you roast the coffee")],
      Q,
    );
    expect(r.best).toHaveLength(3);
    expect(r.best[0]).toBe(0);
    expect(r.best[1]).toBeCloseTo(2 / 6, 5); // {wifi, farm} vs {is, there, wifi, on, the, farm}: 2 / 6
    expect(r.best[2]).toBe(1);
    expect(r.bestOverlapBins.reduce((a, b) => a + b, 0)).toBe(3);
    expect(r.bestOverlapBins[4]).toBe(1); // overlap 1.0 lands in the last bin
  });

  it("handles no passages and no questions", () => {
    expect(leakageAudit([], Q)).toMatchObject({
      passages: 0,
      exact: [],
      maxOverlap: 0,
      worst: null,
      best: [],
    });
    expect(leakageAudit([P("anything")], []).maxOverlap).toBe(0);
  });
});
