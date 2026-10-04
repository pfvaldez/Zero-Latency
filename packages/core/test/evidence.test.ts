import { describe, expect, it } from "vitest";
import { WolofEvidenceSchema } from "../src/evidence.ts";

const dir = (chrf: number) => ({
  chrf,
  n: 1012,
  signature: "nrefs:1|case:mixed|eff:yes|nc:6|nw:0|space:no|version:2.6.0",
  seconds: 600,
});
const flores = {
  split: "devtest",
  sentences_in_split: 1012,
  n: 1012,
  seed: 4,
  sampled: false,
  directions: { "eng_Latn to wol_Latn": dir(25.1), "eng_Latn to deu_Latn": dir(58.3) },
};
const fleurs = {
  split: "wo_sn test",
  utterances_in_split: 371,
  seed: 4,
  audio_seconds: 1200,
  decode_seconds: 1100,
  examples: [{ id: 1, reference: "ba ngi fi", hypothesis: "ba ngi" }],
  wer: 0.55,
  cer: 0.2,
  n: 100,
  reference_words: 1800,
};
const roundtrip = {
  n: 1,
  pooled_chrf: 30.2,
  signature: "nrefs:1|case:mixed|eff:yes|nc:6|nw:0|space:no|version:2.6.0",
  clips: [
    {
      clip: 1,
      wolof_transcript: "benn",
      back_to_english: "one",
      script: "One two.",
      chrf: 30.2,
      seconds_of_audio: 10.1,
    },
  ],
};
const ok = (v: unknown) => WolofEvidenceSchema.safeParse(v).success;

describe("WolofEvidenceSchema", () => {
  it("accepts each part on its own and all three together", () => {
    expect(ok({ versions: {} })).toBe(true);
    expect(ok({ flores, versions: {} })).toBe(true);
    expect(ok({ fleurs, versions: {} })).toBe(true);
    expect(ok({ roundtrip, versions: {} })).toBe(true);
    expect(ok({ flores, fleurs, roundtrip, versions: { torch: "2.14.1" } })).toBe(true);
  });

  it("requires the versions block and rejects unknown top-level parts", () => {
    expect(ok({ flores })).toBe(false);
    expect(ok({ versions: {}, extra: 1 })).toBe(false);
  });

  it("keeps chrF within 0 to 100 and sample sizes positive, so a result always says how many", () => {
    expect(ok({ flores: { ...flores, directions: { x: dir(101) } }, versions: {} })).toBe(false);
    expect(ok({ flores: { ...flores, directions: { x: dir(-1) } }, versions: {} })).toBe(false);
    expect(ok({ flores: { ...flores, n: 0 }, versions: {} })).toBe(false);
    expect(ok({ fleurs: { ...fleurs, n: 0 }, versions: {} })).toBe(false);
    const { n: _n, ...noN } = fleurs;
    expect(ok({ fleurs: noN, versions: {} })).toBe(false);
  });

  it("lets word error rate exceed 1 (a bad recognizer can insert more words than there are) but not go negative", () => {
    expect(ok({ fleurs: { ...fleurs, wer: 1.4 }, versions: {} })).toBe(true);
    expect(ok({ fleurs: { ...fleurs, wer: -0.1 }, versions: {} })).toBe(false);
  });

  it("rejects extra fields inside a part and a round-trip clip without a script", () => {
    expect(ok({ flores: { ...flores, extra: 1 }, versions: {} })).toBe(false);
    expect(
      ok({
        roundtrip: { ...roundtrip, clips: [{ ...roundtrip.clips[0], script: "" }] },
        versions: {},
      }),
    ).toBe(false);
  });
});
