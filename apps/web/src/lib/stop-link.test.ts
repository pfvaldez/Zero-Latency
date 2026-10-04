import { describe, expect, it } from "vitest";
import { parseStopCode, stopPath } from "./stop-link.ts";

describe("parseStopCode", () => {
  it("reads a stop code, a full link, a relative link and a trailing slash", () => {
    expect(parseStopCode("NOOR-STOP-3")).toBe(3);
    expect(parseStopCode(" noor-stop-12 ")).toBe(12);
    expect(parseStopCode("https://asknoor.example/stop/7")).toBe(7);
    expect(parseStopCode("/stop/1")).toBe(1);
    expect(parseStopCode("/stop/2/")).toBe(2);
    expect(parseStopCode(stopPath(5))).toBe(5);
  });
  it("ignores anything else: other sites, other paths, text, empty and absurd numbers", () => {
    for (const bad of [
      "",
      "hello",
      "https://example.com/",
      "/shop/3",
      "/stop/",
      "/stop/abc",
      "NOOR-STOP-",
      "NOOR-STOP-1234",
      "/stop/3/extra",
      "NOOR-STOP-3; drop",
    ])
      expect(parseStopCode(bad), bad).toBeNull();
  });
});
