import { describe, expect, it } from "vitest";
import { CORE_PACKAGE } from "./index.ts";

describe("core package (Phase 0 sample)", () => {
  it("exports its package name", () => {
    expect(CORE_PACKAGE).toBe("@asknoor/core");
  });
});
