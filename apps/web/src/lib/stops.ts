import type { Clip } from "@asknoor/core";

/** The stop number of a clip: the trailing digits of its stop code, for example NOOR-STOP-3 gives 3. */
export function stopNumber(clip: Clip): number | null {
  const m = /(\d+)\s*$/.exec(clip.stopCode ?? "");
  return m ? Number(m[1]) : null;
}

export const stopsOf = (clips: readonly Clip[]): Clip[] => clips.filter((c) => c.kind === "stop");

/** Finds a stop from what the guest typed ("3", "stop 3", or a scanned code like NOOR-STOP-3). */
export function findStop(clips: readonly Clip[], entry: string): Clip | undefined {
  const text = entry.trim();
  if (!text) return undefined;
  const stops = stopsOf(clips);
  const byCode = stops.find((c) => c.stopCode?.toLowerCase() === text.toLowerCase());
  if (byCode) return byCode;
  const digits = /^\D*(\d+)\D*$/.exec(text);
  if (!digits) return undefined;
  return stops.find((c) => stopNumber(c) === Number(digits[1]));
}
