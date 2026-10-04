import { describe, expect, it } from "vitest";
import { FarmPackManifestSchema, makeFarmCode, verifyFarmCode } from "../src/index.ts";

describe("farm code (prototype control)", () => {
  it("accepts the right code and rejects every wrong one", async () => {
    const fc = await makeFarmCode("4827", "ondera-noor");
    expect(await verifyFarmCode("4827", fc)).toBe(true);
    for (const wrong of ["4828", "0000", "482", "48270", "abcd", "", " 4827"])
      expect(await verifyFarmCode(wrong, fc), wrong).toBe(false);
  });

  it("stores a salted hash, never the code, and is the same for the same farm and code", async () => {
    const a = await makeFarmCode("4827", "ondera-noor");
    expect(JSON.stringify(a)).not.toContain("4827");
    expect(a).toEqual(await makeFarmCode("4827", "ondera-noor"));
    expect(a.hash).not.toBe((await makeFarmCode("4827", "other-farm")).hash);
    expect(a.salt).not.toBe((await makeFarmCode("4827", "other-farm")).salt);
    expect(a.prototype).toBe(true);
  });

  it("refuses to make a code that is not exactly 4 digits", async () => {
    for (const bad of ["123", "12345", "12a4", ""])
      await expect(makeFarmCode(bad, "x")).rejects.toThrow(/4 digits/);
  });

  it("is checked by the manifest schema, which refuses a code without the prototype label or a short hash", async () => {
    const fc = await makeFarmCode("4827", "x");
    const shape = FarmPackManifestSchema.shape.farmCode;
    expect(shape.safeParse(fc).success).toBe(true);
    expect(shape.safeParse({ ...fc, prototype: false }).success).toBe(false);
    expect(shape.safeParse({ ...fc, hash: "abc" }).success).toBe(false);
    expect(shape.safeParse({ ...fc, plain: "4827" }).success).toBe(false);
  });
});
