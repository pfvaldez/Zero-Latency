import type { Clip } from "@asknoor/core";
import { describe, expect, it } from "vitest";
import { findStop, stopNumber } from "./stops.ts";

const clip = (id: number, code?: string, kind: Clip["kind"] = "stop"): Clip => ({
  id,
  kind,
  ...(code ? { stopCode: code } : {}),
  audio: "a.m4a",
  durationMs: 1,
  momentIds: [],
  subtitles: {},
});
const clips = [clip(1, "NOOR-STOP-1"), clip(2, "NOOR-STOP-2"), clip(9, undefined, "answer")];

describe("findStop", () => {
  it("finds a stop by number, by words around the number, and by scanned code", () => {
    expect(findStop(clips, "2")?.id).toBe(2);
    expect(findStop(clips, " stop 1 ")?.id).toBe(1);
    expect(findStop(clips, "noor-stop-2")?.id).toBe(2);
    expect(stopNumber(clips[0] as Clip)).toBe(1);
  });
  it("finds nothing for an unknown number, empty text or an answer clip", () => {
    expect(findStop(clips, "7")).toBeUndefined();
    expect(findStop(clips, "")).toBeUndefined();
    expect(findStop(clips, "9")).toBeUndefined();
    expect(findStop(clips, "abc")).toBeUndefined();
  });
});
