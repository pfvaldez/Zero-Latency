import { describe, expect, it } from "vitest";
import {
  CORE_PACKAGE,
  decide,
  decideSafety,
  fillTemplate,
  normalize,
  t,
  themeOf,
} from "../src/index.ts";

// apps/web shows CORE_PACKAGE on its placeholder screen until Phase 4 replaces it.
describe("@asknoor/core entry point", () => {
  it("exports its package name", () => {
    expect(CORE_PACKAGE).toBe("@asknoor/core");
  });

  it("exports the guardrail functions", () => {
    for (const fn of [normalize, decideSafety, decide, themeOf, fillTemplate, t]) {
      expect(typeof fn).toBe("function");
    }
  });
});
