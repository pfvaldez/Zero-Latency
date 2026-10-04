import { describe, expect, it } from "vitest";
import { dot, topMoments } from "./score.ts";

const v = (...n: number[]) => new Float32Array(n);

describe("topMoments", () => {
  const matrix = new Float32Array([1, 0, 0, 1, 0.6, 0.8]);
  const rows = [{ momentId: "a" }, { momentId: "b" }, { momentId: "a" }];

  it("computes the dot product", () => {
    expect(dot(v(1, 0), matrix, 2)).toBe(0);
    expect(dot(v(0.6, 0.8), matrix, 4)).toBeCloseTo(1);
  });

  it("scores a moment by its best row, highest first, and honours k", () => {
    const top = topMoments(v(0.6, 0.8), matrix, rows, 2, 3);
    expect(top.map((t) => t.momentId)).toEqual(["a", "b"]);
    expect(top[0]?.score).toBeCloseTo(1); // row 3 of "a" beats row 1 of "a" (0.6)
    expect(topMoments(v(0.6, 0.8), matrix, rows, 2, 1)).toHaveLength(1);
  });

  it("returns nothing for an empty matrix", () => {
    expect(topMoments(v(1, 0), new Float32Array(0), [], 2)).toEqual([]);
  });
});
