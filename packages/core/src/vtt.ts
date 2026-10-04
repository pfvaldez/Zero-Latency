// WebVTT subtitles for pack clips. Pure string work.
//
// Sentences are split the same way as pipeline/asknoor/translate.py (split_sentences), so cue i of
// every language lines up with English sentence i. Timing comes from word timestamps when a
// transcript exists, and is otherwise ESTIMATED from the script (proportional to length inside
// the spoken part of the clip) and labeled as such.

export interface Cue {
  startMs: number;
  endMs: number;
  text: string;
}

export interface TimedWord {
  text: string;
  start: number; // seconds
  end: number;
}

/** Split after . ! or ? followed by whitespace; "3.5" stays whole. Matches split_sentences. */
export function splitSentences(text: string): string[] {
  return text
    .trim()
    .split(/(?<=[.!?])\s+/)
    .filter((s) => s.length > 0);
}

/**
 * One cue per sentence from a transcript's word timestamps. A sentence ends at a word whose text
 * ends in . ! or ?. `sentences` are the sentences of the same text; the cue count must match.
 */
export function cuesFromWords(words: readonly TimedWord[], sentences: readonly string[]): Cue[] {
  const groups: TimedWord[][] = [];
  let current: TimedWord[] = [];
  for (const w of words) {
    current.push(w);
    if (/[.!?]$/.test(w.text)) {
      groups.push(current);
      current = [];
    }
  }
  if (current.length > 0) groups.push(current);
  if (groups.length !== sentences.length) {
    throw new Error(
      `the transcript has ${groups.length} sentences but the text has ${sentences.length}`,
    );
  }
  let previousEnd = 0;
  return groups.map((g, i) => {
    const first = g[0] as TimedWord;
    const last = g[g.length - 1] as TimedWord;
    const startMs = Math.max(previousEnd, Math.round(first.start * 1000));
    const endMs = Math.max(startMs + 1, Math.round(last.end * 1000));
    previousEnd = endMs;
    return { startMs, endMs, text: sentences[i] as string };
  });
}

/**
 * Estimated cues: the sentences share the spoken part of the clip (after the leading silence and
 * before the trailing silence) in proportion to their length.
 */
export function cuesEstimated(
  sentences: readonly string[],
  durationMs: number,
  headSilenceMs = 0,
  tailSilenceMs = 0,
): Cue[] {
  const from = Math.max(0, Math.min(headSilenceMs, durationMs));
  const to = Math.max(from, durationMs - Math.max(0, tailSilenceMs));
  const total = sentences.reduce((n, s) => n + s.length, 0) || 1;
  let at = from;
  return sentences.map((text, i) => {
    const end =
      i === sentences.length - 1 ? to : Math.round(at + ((to - from) * text.length) / total);
    const cue = { startMs: Math.round(at), endMs: Math.max(Math.round(at) + 1, end), text };
    at = cue.endMs;
    return cue;
  });
}

const pad = (n: number, width = 2) => String(n).padStart(width, "0");
export function timestamp(ms: number): string {
  const total = Math.max(0, Math.round(ms));
  return `${pad(Math.floor(total / 3_600_000))}:${pad(Math.floor((total % 3_600_000) / 60_000))}:${pad(Math.floor((total % 60_000) / 1000))}.${pad(total % 1000, 3)}`;
}

const escapeText = (t: string) =>
  t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/-->/g, "--&gt;");

/** A WebVTT file. `note` becomes a NOTE block (for example "timing estimated from the script"). */
export function toWebVtt(cues: readonly Cue[], note?: string): string {
  const lines = ["WEBVTT", ""];
  if (note) lines.push(`NOTE ${note.replace(/\n+/g, " ")}`, "");
  cues.forEach((c, i) => {
    lines.push(
      String(i + 1),
      `${timestamp(c.startMs)} --> ${timestamp(c.endMs)}`,
      escapeText(c.text),
      "",
    );
  });
  return lines.join("\n");
}
