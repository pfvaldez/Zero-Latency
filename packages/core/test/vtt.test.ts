import { describe, expect, it } from "vitest";
import { cuesEstimated, cuesFromWords, splitSentences, timestamp, toWebVtt } from "../src/vtt.ts";

const SCRIPT =
  "Welcome to my farm. I'm Noor. Smell that? That's my favorite time of the day! It costs 3.5 dalasi.";

describe("splitSentences (same rule as pipeline split_sentences)", () => {
  it("splits after . ! ? and keeps decimals whole", () => {
    expect(splitSentences(SCRIPT)).toEqual([
      "Welcome to my farm.",
      "I'm Noor.",
      "Smell that?",
      "That's my favorite time of the day!",
      "It costs 3.5 dalasi.",
    ]);
  });
  it("handles empty text, no final punctuation, extra whitespace and newlines", () => {
    expect(splitSentences("")).toEqual([]);
    expect(splitSentences("  One sentence only  ")).toEqual(["One sentence only"]);
    expect(splitSentences("No end punctuation")).toEqual(["No end punctuation"]);
    expect(splitSentences("A.  B.\nC?")).toEqual(["A.", "B.", "C?"]);
  });
  it("keeps the clip 4 text as four sentences (a semicolon does not split)", () => {
    const clip4 =
      "I've been a member of the Ondera Coffee Cooperative for 11 years. Together we get better prices, and we teach each other. My daughter helps me on weekends; she's the one who set up this tour.";
    expect(splitSentences(clip4)).toHaveLength(3);
  });
});

describe("timestamp", () => {
  it("formats HH:MM:SS.mmm", () => {
    expect(timestamp(0)).toBe("00:00:00.000");
    expect(timestamp(1234)).toBe("00:00:01.234");
    expect(timestamp(61_005)).toBe("00:01:01.005");
    expect(timestamp(3_723_456)).toBe("01:02:03.456");
    expect(timestamp(-5)).toBe("00:00:00.000");
  });
});

describe("cuesFromWords", () => {
  const words = [
    { text: "Welcome", start: 0.12, end: 0.58 },
    { text: "home.", start: 0.6, end: 1.1 },
    { text: "Smell", start: 1.3, end: 1.6 },
    { text: "that?", start: 1.6, end: 2.0 },
  ];

  it("makes one cue per sentence from the first and last word times", () => {
    const cues = cuesFromWords(words, ["Welcome home.", "Smell that?"]);
    expect(cues).toEqual([
      { startMs: 120, endMs: 1100, text: "Welcome home." },
      { startMs: 1300, endMs: 2000, text: "Smell that?" },
    ]);
  });

  it("keeps cues in order and never overlapping, even if timestamps are sloppy", () => {
    const sloppy = [
      { text: "One.", start: 0.0, end: 1.0 },
      { text: "Two.", start: 0.5, end: 0.9 },
    ];
    const [a, b] = cuesFromWords(sloppy, ["One.", "Two."]);
    expect(b?.startMs).toBeGreaterThanOrEqual(a?.endMs ?? 0);
    expect(b?.endMs).toBeGreaterThan(b?.startMs ?? 0);
  });

  it("treats a trailing run of words without a final full stop as a last sentence", () => {
    const cues = cuesFromWords([{ text: "Hello", start: 0, end: 0.5 }], ["Hello"]);
    expect(cues).toHaveLength(1);
  });

  it("throws when the transcript and the text disagree on the number of sentences", () => {
    expect(() => cuesFromWords(words, ["Only one."])).toThrow(/2 sentences but the text has 1/);
  });
});

describe("cuesEstimated", () => {
  const sentences = ["Short one.", "A much longer second sentence goes here."];

  it("shares the spoken part in proportion to length and stays inside it", () => {
    const cues = cuesEstimated(sentences, 10_000, 300, 400);
    expect(cues[0]?.startMs).toBe(300);
    expect(cues.at(-1)?.endMs).toBe(9600);
    const [a, b] = cues;
    expect(a?.endMs).toBe(b?.startMs); // contiguous
    expect((a?.endMs ?? 0) - (a?.startMs ?? 0)).toBeLessThan((b?.endMs ?? 0) - (b?.startMs ?? 0));
  });

  it("is monotone with no empty cue, for many sentences", () => {
    const many = Array.from({ length: 12 }, (_, i) => `Sentence number ${i}.`);
    const cues = cuesEstimated(many, 6000, 100, 100);
    for (const [i, c] of cues.entries()) {
      expect(c.endMs).toBeGreaterThan(c.startMs);
      if (i > 0) expect(c.startMs).toBeGreaterThanOrEqual(cues[i - 1]?.endMs ?? 0);
    }
  });

  it("handles silence larger than the clip and no sentences", () => {
    expect(cuesEstimated(["Hi."], 1000, 5000, 5000)[0]?.startMs).toBe(1000);
    expect(cuesEstimated([], 1000)).toEqual([]);
  });
});

describe("toWebVtt", () => {
  const cues = [
    { startMs: 120, endMs: 1100, text: "Welcome home." },
    { startMs: 1300, endMs: 2000, text: "Fish & chips <b> --> done" },
  ];

  it("writes the header, numbered cues and timestamps", () => {
    const vtt = toWebVtt(cues);
    expect(vtt.startsWith("WEBVTT\n\n1\n00:00:00.120 --> 00:00:01.100\nWelcome home.\n")).toBe(
      true,
    );
    expect(vtt).toContain("2\n00:00:01.300 --> 00:00:02.000");
  });

  it("escapes ampersands, angle brackets and the cue arrow in cue text", () => {
    const vtt = toWebVtt(cues);
    expect(vtt).toContain("Fish &amp; chips &lt;b> --&gt; done");
    expect(vtt.split("-->").length).toBe(3); // only the two timing lines contain an arrow
  });

  it("adds a NOTE block for estimated timing", () => {
    const vtt = toWebVtt(cues, "timing estimated from the script\nnot from the recording");
    expect(vtt).toContain(
      "WEBVTT\n\nNOTE timing estimated from the script not from the recording\n\n1\n",
    );
  });

  it("writes only the header for no cues", () => {
    expect(toWebVtt([])).toBe("WEBVTT\n");
  });
});
