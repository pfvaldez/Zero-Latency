import { describe, expect, it } from "vitest";
import { parseVtt } from "./vtt.ts";

describe("parseVtt", () => {
  it("reads cues with times and text, and skips the header and broken blocks", () => {
    const vtt =
      "WEBVTT\n\n1\n00:00:00.000 --> 00:00:02.500\nHello there.\n\nbroken block\n\n00:00:02.500 --> 00:01:05.250\nSecond line\nwraps.\n";
    expect(parseVtt(vtt)).toEqual([
      { startMs: 0, endMs: 2500, text: "Hello there." },
      { startMs: 2500, endMs: 65250, text: "Second line wraps." },
    ]);
  });
  it("returns nothing for empty input", () => {
    expect(parseVtt("")).toEqual([]);
  });
});
