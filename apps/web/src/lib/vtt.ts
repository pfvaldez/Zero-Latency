import type { Cue } from "@asknoor/core";

const TIME = /(?:(\d+):)?(\d{2}):(\d{2})\.(\d{3})/;

const ms = (t: string): number => {
  const m = TIME.exec(t.trim());
  if (!m) return Number.NaN;
  return (Number(m[1] ?? 0) * 3600 + Number(m[2]) * 60 + Number(m[3])) * 1000 + Number(m[4]);
};

/** Reads the WebVTT files the pack builder writes (one cue per sentence). Malformed cues are skipped. */
export function parseVtt(text: string): Cue[] {
  const cues: Cue[] = [];
  for (const block of text.replace(/\r/g, "").split(/\n\n+/)) {
    const lines = block.split("\n").filter((l) => l.length > 0);
    const at = lines.findIndex((l) => l.includes("-->"));
    if (at < 0) continue;
    const [from, to] = (lines[at] ?? "").split("-->");
    const startMs = ms(from ?? "");
    const endMs = ms(to ?? "");
    const body = lines
      .slice(at + 1)
      .join(" ")
      .trim();
    if (Number.isFinite(startMs) && Number.isFinite(endMs) && body)
      cues.push({ startMs, endMs, text: body });
  }
  return cues;
}
