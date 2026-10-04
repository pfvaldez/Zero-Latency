import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { REPO_ROOT } from "../src/model.ts";
import { type EvalResults, renderEval } from "../src/report.ts";

const results = async () =>
  JSON.parse(
    await readFile(join(REPO_ROOT, "content", "ondera-noor", "eval", "results.json"), "utf8"),
  ) as EvalResults;

describe("the Wolof evidence section", () => {
  const evidence = {
    flores: {
      split: "devtest" as const,
      sentences_in_split: 1012,
      n: 1012,
      seed: 4,
      sampled: false,
      directions: {
        "eng_Latn to wol_Latn": { chrf: 20, n: 1012, signature: "sig", seconds: 1 },
        "eng_Latn to deu_Latn": { chrf: 55.5, n: 1012, signature: "sig", seconds: 1 },
      },
    },
    fleurs: {
      split: "wo_sn test",
      utterances_in_split: 371,
      seed: 4,
      audio_seconds: 1000,
      decode_seconds: 900,
      examples: [],
      wer: 0.5,
      cer: 0.2,
      n: 100,
      reference_words: 1800,
    },
    roundtrip: {
      n: 2,
      pooled_chrf: 31.5,
      signature: "sig",
      clips: [
        {
          clip: 1,
          wolof_transcript: "a",
          back_to_english: "one | two",
          script: "s",
          chrf: 30,
          seconds_of_audio: 10,
        },
        {
          clip: 2,
          wolof_transcript: "b",
          back_to_english: "three",
          script: "s",
          chrf: 33,
          seconds_of_audio: 9,
        },
      ],
    },
    versions: {},
  };

  it("says it was not run when there is no evidence file", async () => {
    const md = renderEval({ ...(await results()), wolof: null });
    expect(md).toContain("## Wolof evidence");
    expect(md).toContain("Not run yet");
  });

  it("reports every number with its sample size and computes the gap between Wolof and German", async () => {
    const md = renderEval({ ...(await results()), wolof: evidence });
    expect(md).toContain("| eng to wol | 20 | 1012 |");
    expect(md).toContain("**35.5 chrF points lower**");
    expect(md).toContain("100 utterances sampled from 371 (seed 4), 1800 reference words");
    expect(md).toContain("Word error rate | 50.0%");
    expect(md).toContain("**n = 2 clips**; pooled chrF **31.5**");
    expect(md).toContain("one / two"); // a pipe in machine text cannot break the table
  });

  it("truncates a runaway back-translation instead of putting 700 characters in a table cell", async () => {
    const long = {
      ...evidence,
      roundtrip: {
        ...evidence.roundtrip,
        clips: [
          {
            ...(evidence.roundtrip.clips[0] as (typeof evidence.roundtrip.clips)[number]),
            back_to_english: "we go to hell ".repeat(60),
          },
        ],
      },
    };
    const md = renderEval({ ...(await results()), wolof: long });
    expect(md).toContain("… (840 characters)");
  });

  it("labels the where-it-breaks reading as an inference", async () => {
    const md = renderEval({
      ...(await results()),
      wolof: {
        ...evidence,
        flores: {
          ...evidence.flores,
          directions: {
            ...evidence.flores.directions,
            "wol_Latn to eng_Latn": { chrf: 38, n: 1012, signature: "sig", seconds: 1 },
          },
        },
      },
    });
    expect(md).toContain("**Where it breaks (an inference, not a measurement):**");
  });

  it("states the limits and the non-commercial licenses of the models", async () => {
    const md = renderEval({ ...(await results()), wolof: evidence });
    expect(md).toContain("CC-BY-NC-4.0 (non-commercial)");
    expect(md).toContain("the round trip is 8 clips, so it is an anecdote, not a benchmark");
  });
});

describe("docs/EVAL.md (rendered from the committed results)", () => {
  it("shows the honest held-out estimate and keeps the full-set numbers labeled in sample", async () => {
    const md = renderEval(await results());
    expect(md).toContain("## Honest estimate: tune on one half, report on the other");
    expect(md).toContain("**by slot**");
    expect(md).toContain("Pooled held-out");
    expect(md).toContain("Tuned on the full set (in sample, kept for comparison)");
  });

  it("compares the passage sets before and after index-only phrasings, and says how independent they are", async () => {
    const r = await results();
    const md = renderEval(r);
    expect(md).toContain("## Which passages: before and after index-only phrasings");
    expect(md).toContain("Leakage audit against the");
    expect(md).toContain("**Limits I cannot remove:**");
    expect(r.study.map((x) => x.name)).toEqual(
      expect.arrayContaining([expect.stringContaining("before"), expect.stringContaining("after")]),
    );
    expect(r.study.length).toBe(5);
    expect(r.leakage?.removedAsDuplicates).toBeGreaterThanOrEqual(0);
  });

  it("states the rule for the shipped threshold and says the threshold file matches", async () => {
    const r = await results();
    const md = renderEval(r);
    expect(md).toContain("the strictest of three picks");
    const t = JSON.parse(
      await readFile(join(REPO_ROOT, "content", "ondera-noor", "eval", "threshold.json"), "utf8"),
    );
    expect(t.match).toBe(r.threshold);
    expect(t.match).toBe(Math.max(r.fullSetPick ?? 0, ...r.foldPicks.map((x) => x ?? 0)));
  });

  it("matches the committed docs/EVAL.md exactly (regenerate with `bun run eval`)", async () => {
    const committed = await readFile(join(REPO_ROOT, "docs", "EVAL.md"), "utf8");
    expect(`${renderEval(await results())}\n`).toBe(committed);
  });
});
