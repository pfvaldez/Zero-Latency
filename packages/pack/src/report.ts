// docs/EVAL.md: generated text from the evaluation results. Pure string building.

import type { Fold, Metrics, PooledMetrics } from "@asknoor/core";

const pct = (x: number, digits = 1) => `${(x * 100).toFixed(digits)}%`;
const ci = (c: { low: number; high: number }) => `${pct(c.low, 0)} to ${pct(c.high, 0)}`;

export interface LangRow {
  name: string;
  m: Metrics;
}

export interface EvalResults {
  date: string;
  modelRepo: string;
  modelRevision: string;
  contentHash: string;
  questions: {
    total: number;
    safety: number;
    nonSafety: number;
    answered: number;
    neverAnswered: number;
    heldBackAsNone: number;
  };
  passageSource: string;
  passageLangs: string[];
  threshold: number;
  maxFalseConfirm: number;
  margin: number;
  primary: Metrics;
  fullSet: Metrics | null;
  fullSetPick: number | null;
  foldPicks: (number | null)[];
  honest: {
    slotsA: number;
    slotsB: number;
    folds: [Fold, Fold];
    pooled: PooledMetrics | null;
    pooledCi: {
      falseConfirm: { low: number; high: number };
      coverage: { low: number; high: number };
      top1: { low: number; high: number };
    } | null;
    byLang: { name: string; m: PooledMetrics }[];
  };
  primaryCi: {
    falseConfirm: { low: number; high: number };
    coverage: { low: number; high: number };
  };
  study: {
    name: string;
    fullSetPick: number | null;
    foldPicks: (number | null)[];
    pooled: PooledMetrics | null;
    pooledCi: {
      falseConfirm: { low: number; high: number };
      coverage: { low: number; high: number };
      top1: { low: number; high: number };
    } | null;
    atShipped: Metrics;
  }[];
  leakage: {
    passages: number;
    removedAsDuplicates: number;
    maxOverlap: number;
    worst: { text: string; lang: string; questionId: string } | null;
    bestOverlapBins: number[];
    strictCutoff: number;
    excludedAtCutoff: number;
  } | null;
  afterPublish: Metrics;
  byLang: LangRow[];
  byVariant: LangRow[];
  leaveOneOut: {
    lang: string;
    threshold: number | null;
    falseConfirmRate: number | null;
    coverage: number | null;
  }[];
  sweepSample: {
    threshold: number;
    falseConfirmRate: number;
    coverage: number;
    failSafeRate: number;
  }[];
  histogram: { lo: number; hi: number; bins: number; answered: number[]; never: number[] };
  timings: {
    modelLoadMs: number;
    passagesMs: number;
    queryMedianMs: number;
    queryP95Ms: number;
    queries: number;
  };
  size: {
    modelBytes: number;
    embeddingsBytes: number;
    audioBytes: number | null;
    totalBytes: number | null;
    budgetBytes: number;
  };
  unsafe: { safetyRecall: number; safetyFalsePositives: number; safetyQuestions: number };
}

const row = (name: string, m: Metrics) =>
  `| ${name} | ${m.questions} | ${pct(m.top1Rate)} | ${pct(m.coverage)} | ${pct(m.falseConfirmRate)} | ${pct(m.failSafeRate)} |`;

const mb = (b: number) => `${(b / 1e6).toFixed(1)} MB`;

const pooledRow = (name: string, m: PooledMetrics) =>
  `| ${name} | ${m.questions} | ${pct(m.top1Rate)} | ${pct(m.coverage)} | ${pct(m.falseConfirmRate)} | ${pct(m.failSafeRate)} |`;

function honestSection(r: EvalResults): string[] {
  const h = r.honest;
  const out: string[] = ["## Honest estimate: tune on one half, report on the other", ""];
  out.push(
    `The ${r.questions.total} questions are ${h.slotsA + h.slotsB} slots, and slot i is the same question in all four languages (${r.questions.nonSafety / 4} ordinary slots, ${r.questions.safety / 4} safety slots). So the split is **by slot**: a German question and its English twin always land in the same half. Half A has ${h.slotsA} slots and half B ${h.slotsB}, balanced by expected answer. The threshold is chosen on one half only, then measured on the other; then the halves swap. Tuning never sees the half it is reported on (a test poisons the report half to prove it).`,
    "",
    "| Tuned on | Threshold chosen there | Measured on it (in sample) | Reported on | False confirm | Coverage | Top-1 | Fail-safe |",
    "|---|---|---|---|---|---|---|---|",
  );
  for (const f of h.folds) {
    out.push(
      `| half ${f.tuneOn} | ${f.threshold ?? "none works"} | ${f.inSample ? `${pct(f.inSample.falseConfirmRate)} false confirm` : "-"} | half ${f.reportOn} | ${f.heldOut ? pct(f.heldOut.falseConfirmRate) : "-"} | ${f.heldOut ? pct(f.heldOut.coverage) : "-"} | ${f.heldOut ? pct(f.heldOut.top1Rate) : "-"} | ${f.heldOut ? pct(f.heldOut.failSafeRate) : "-"} |`,
    );
  }
  if (h.pooled && h.pooledCi) {
    const p = h.pooled;
    out.push(
      "",
      `**Pooled held-out (every question reported once, with the threshold chosen without it): false confirm ${pct(p.falseConfirmRate)} (${p.wrongClipConfirm + p.confirmOnNever} of ${p.questions}, 95% interval ${ci(h.pooledCi.falseConfirm)}), coverage ${pct(p.coverage)} (${p.correctConfirm} of ${p.answered}, ${ci(h.pooledCi.coverage)}), top-1 ${pct(p.top1Rate)} (${ci(h.pooledCi.top1)}), fail-safe ${pct(p.failSafeRate)}.**`,
      "",
      "| Pooled held-out by language | Questions | Top-1 | Coverage | False confirm | Fail-safe |",
      "|---|---|---|---|---|---|",
    );
    for (const x of h.byLang) out.push(pooledRow(`language ${x.name}`, x.m));
  } else {
    out.push(
      "",
      "No threshold met the limit on one of the halves, so there is no pooled held-out number.",
    );
  }
  out.push("");
  return out;
}

function studySection(r: EvalResults): string[] {
  const out: string[] = ["## Which passages: before and after index-only phrasings", ""];
  out.push(
    "Each row is a different set of passages for the same moments, evaluated the same honest way: the threshold is chosen on one half of the question slots and the numbers below are **pooled held-out** (every question reported once, with a threshold chosen without it).",
    "",
    "| Passages | Held-out false confirm | Held-out coverage | Held-out top-1 | Fail-safe | At the shipped threshold (in sample): false confirm / coverage / top-1 |",
    "|---|---|---|---|---|---|",
  );
  for (const x of r.study) {
    const p = x.pooled;
    out.push(
      `| ${x.name} | ${p ? `${pct(p.falseConfirmRate)} (${ci(x.pooledCi?.falseConfirm ?? { low: 0, high: 0 })})` : "no threshold"} | ${p ? `${pct(p.coverage)} (${ci(x.pooledCi?.coverage ?? { low: 0, high: 0 })})` : "-"} | ${p ? pct(p.top1Rate) : "-"} | ${p ? pct(p.failSafeRate) : "-"} | ${pct(x.atShipped.falseConfirmRate)} / ${pct(x.atShipped.coverage)} / ${pct(x.atShipped.top1Rate)} |`,
    );
  }
  out.push("");
  if (r.leakage) {
    const l = r.leakage;
    out.push(
      "### Index-only phrasings: how they were made and how independent they are",
      "",
      `- ${l.passages} short question-style phrasings (3 per clip and language) were written by an isolated assistant that was given only the clip scripts and topics, and read no repository file. They are **never shown to a guest or to Noor**; they only add matrix rows for a moment, are marked \`indexOnly\` in the manifest, and the guest still confirms every match.`,
      `- Leakage audit against the ${r.questions.total} test questions (same language, token overlap after normalization): ${l.removedAsDuplicates} phrasings that repeated a question exactly were **removed** (not rewritten); the closest remaining phrasing overlaps a question by ${l.maxOverlap.toFixed(2)}${l.worst ? ` ("${l.worst.text}" and ${l.worst.questionId})` : ""}. Best overlap per phrasing in fifths from 0 to 1: ${l.bestOverlapBins.join(", ")}.`,
      `- **Sensitivity:** the last row of the table drops the ${l.excludedAtCutoff} phrasings that overlap a question by ${l.strictCutoff} or more. If the gain mostly survives, it does not come from near-copies.`,
      "- **Limits I cannot remove:** the team's assistant also wrote the test questions and has seen them in this project, and both come from the same model family, so the style of the phrasings and of the questions is correlated. That can make the gain look larger than real guests would give. They are unchecked machine text (a draft), shipped labeled; see `docs/RESPONSIBLE_AI.md`.",
      "",
    );
  }
  return out;
}

export function renderEval(r: EvalResults): string {
  const p = r.primary;
  const lines: string[] = [];
  lines.push("# Evaluation: matching, threshold, size and timings", "");
  lines.push(
    "Generated by `bun run eval` (packages/pack). Do not edit by hand. Run it again after any change to the content, the model or the questions.",
    "",
  );
  lines.push("## What was measured", "");
  lines.push(
    `- Model: \`${r.modelRepo}\` at revision \`${r.modelRevision}\` (int8 ONNX), loaded from local files only, the same files the pack ships. Passages use \`passage: \`, questions \`query: \`, mean pooling, normalized vectors, dot product.`,
    `- Passages: ${r.passageSource}. Languages embedded: ${r.passageLangs.join(", ")}.`,
    `- Questions: ${r.questions.total} synthetic questions written by the team (not by guests), in en, de, nl and sv: ${r.questions.nonSafety} ordinary (${r.questions.answered} Noor answers, ${r.questions.neverAnswered} she does not; ${r.questions.heldBackAsNone} of those are the held-back overnight clip) and ${r.questions.safety} safety questions.`,
    "- Every question goes through `decideSafety()` first, then the top moments by score, then the real `decide()`.",
    "- **False confirmation** = a confirm card for the wrong clip, or for a question Noor never answers. **False-confirm rate** = false confirmations / all ordinary questions. **Fail-safe rate** = never-answered questions that were saved / never-answered questions. **Coverage** = answered questions that got the right confirm card. **Top-1** = the best-scoring moment is the right one, before any threshold.",
    `- Content hash: \`${r.contentHash}\`. Run on ${r.date}.`,
    "",
  );
  lines.push(...honestSection(r));
  lines.push("## Chosen threshold", "");
  lines.push(
    `**match = ${r.threshold}**, the strictest of the picks: for the shipped pack the full-set pick (${r.fullSetPick ?? "none"}) and the two fold picks (${r.foldPicks.map((x) => x ?? "none").join(" and ")}), and the same three for the production pack (see the table of passage sets below). It is never looser than any honest estimate, which fits "below the threshold, save for Noor". Written to \`content/ondera-noor/eval/threshold.json\` and into every pack manifest. \`margin\` = ${r.margin} is recorded but not used in P0 (the "is it A or B?" step is P1).`,
    "",
    r.fullSet
      ? `**Tuned on the full set (in sample, kept for comparison):** at ${r.fullSetPick} the same questions give false confirm ${pct(r.fullSet.falseConfirmRate)}, coverage ${pct(r.fullSet.coverage)}, top-1 ${pct(r.fullSet.top1Rate)}. These are optimistic: the threshold was chosen on these questions. The held-out numbers above are the honest estimate.`
      : "No threshold met the limit on the full set.",
    "",
    "The table below is the shipped threshold measured on all ordinary questions (still in sample, because the full-set pick is one of the three).",
    "",
    "| At the chosen threshold | Value | 95% interval |",
    "|---|---|---|",
    `| False-confirm rate | ${pct(p.falseConfirmRate)} (${p.wrongClipConfirm + p.confirmOnNever} of ${p.questions}) | ${ci(r.primaryCi.falseConfirm)} |`,
    `|   wrong clip confirmed | ${p.wrongClipConfirm} | |`,
    `|   confirmed a question Noor never answers | ${p.confirmOnNever} | |`,
    `| Coverage (right confirm card) | ${pct(p.coverage)} (${p.correctConfirm} of ${p.answered}) | ${ci(r.primaryCi.coverage)} |`,
    `| Top-1 accuracy | ${pct(p.top1Rate)} (${p.top1} of ${p.answered}) | |`,
    `| Fail-safe rate | ${pct(p.failSafeRate)} (${p.savedOnNever} of ${p.neverAnswered}) | |`,
    `| Answered but saved (missed) | ${p.missed} | |`,
    `| Safety questions that hit the safety card | ${pct(r.unsafe.safetyRecall, 0)} (of ${r.unsafe.safetyQuestions}) | |`,
    `| Ordinary questions wrongly sent to the safety card | ${r.unsafe.safetyFalsePositives} | |`,
    "",
  );
  lines.push("## Per language and per variant (at the chosen threshold)", "");
  lines.push(
    "| Group | Questions | Top-1 | Coverage | False confirm | Fail-safe |",
    "|---|---|---|---|---|---|",
  );
  for (const x of r.byLang) lines.push(row(`language ${x.name}`, x.m));
  for (const x of r.byVariant) lines.push(row(`variant ${x.name}`, x.m));
  lines.push("");
  lines.push(...studySection(r));
  lines.push("## The overnight loop (clip 8 held back, then published)", "");
  lines.push(
    "Same threshold, same questions. Before the answer is published the overnight questions have no answer and should be saved for Noor; after the next pack includes it they should match.",
    "",
    "| Pack | Answered | Coverage | False confirm | Fail-safe |",
    "|---|---|---|---|---|",
    `| Clip 8 held back | ${p.answered} | ${pct(p.coverage)} | ${pct(p.falseConfirmRate)} | ${pct(p.failSafeRate)} |`,
    `| Clip 8 published | ${r.afterPublish.answered} | ${pct(r.afterPublish.coverage)} | ${pct(r.afterPublish.falseConfirmRate)} | ${pct(r.afterPublish.failSafeRate)} |`,
    "",
  );
  lines.push("## How stable is the threshold?", "");
  lines.push(
    "The threshold was chosen on the same questions it is measured on (in sample), so the numbers above are optimistic. To see how much, each language is left out in turn: the threshold is chosen on the other three languages and measured on the one left out.",
    "",
    "| Left out | Threshold chosen on the others | False confirm on the left-out language | Coverage |",
    "|---|---|---|---|",
  );
  for (const x of r.leaveOneOut) {
    lines.push(
      `| ${x.lang} | ${x.threshold ?? "none works"} | ${x.falseConfirmRate === null ? "-" : pct(x.falseConfirmRate)} | ${x.coverage === null ? "-" : pct(x.coverage)} |`,
    );
  }
  lines.push(
    "",
    "### Sweep (a sample of thresholds)",
    "",
    "| Threshold | False confirm | Coverage | Fail-safe |",
    "|---|---|---|---|",
  );
  for (const s of r.sweepSample)
    lines.push(
      `| ${s.threshold} | ${pct(s.falseConfirmRate)} | ${pct(s.coverage)} | ${pct(s.failSafeRate)} |`,
    );
  lines.push(
    "",
    "### Top score distribution",
    "",
    `Best moment score per question, in ${r.histogram.bins} bins from ${r.histogram.lo} to ${r.histogram.hi}.`,
    "",
    "| Bin start | Answered | Never answered |",
    "|---|---|---|",
  );
  const w = (r.histogram.hi - r.histogram.lo) / r.histogram.bins;
  for (const [i, a] of r.histogram.answered.entries()) {
    lines.push(`| ${(r.histogram.lo + i * w).toFixed(2)} | ${a} | ${r.histogram.never[i]} |`);
  }
  lines.push("");
  lines.push("## Size and timings", "");
  lines.push(
    "| Item | Value |",
    "|---|---|",
    `| Model files (int8 ONNX, tokenizer, config) | ${mb(r.size.modelBytes)} |`,
    `| Embedding matrix | ${mb(r.size.embeddingsBytes)} |`,
    `| Prepared audio (local, if built) | ${r.size.audioBytes === null ? "not built here" : mb(r.size.audioBytes)} |`,
    `| Estimated pack | ${r.size.totalBytes === null ? `model + embeddings = ${mb(r.size.modelBytes + r.size.embeddingsBytes)} plus audio` : mb(r.size.totalBytes)} against the ${mb(r.size.budgetBytes)} P0 budget |`,
    `| Model load (Node, build machine) | ${r.timings.modelLoadMs} ms |`,
    `| Embedding the passages | ${r.timings.passagesMs} ms |`,
    `| One question, median / p95 (${r.timings.queries} questions) | ${r.timings.queryMedianMs} ms / ${r.timings.queryP95Ms} ms |`,
    "",
    "**These timings are Node on the build machine, not a mid-range Android phone.** The phone numbers (model first load, question to outcome) come from the offline end-to-end run with the real worker.",
    "",
  );
  lines.push("## Honest limits", "");
  lines.push(
    "- The questions are synthetic and were written by the team who also chose the clips; real guests will phrase things differently and make other mistakes. German, Dutch and Swedish questions were not checked by native speakers.",
    `- The shipped threshold (${r.threshold}) is the strictest of three picks, one of which was chosen on all the questions, so the table at the chosen threshold is still in sample. The pooled held-out figure is the honest estimate, but it is **not a measurement of ${r.threshold} itself**: each fold used its own threshold. With ${r.questions.nonSafety} ordinary questions, a 5% limit is about ${Math.round(r.questions.nonSafety * 0.05)} questions, so the intervals are wide and one fold alone can be far from the pooled number.`,
    "- Passages are the English script until Preet's transcript is checked; the subtitle text, and so the match text, will then change slightly. Run `bun run eval` again.",
    `- **Embeddings differ a little between CPUs and runtimes.** The pack's passage vectors are made here with ONNX Runtime on Node; the phone embeds each question with ONNX Runtime Web. It is the same int8 model file, but the int8 kernels round differently: in CI the same passages on Linux x64 were at cosine 0.995 or better against the same passages on macOS arm64 (one passage at 0.9948). That can move a question's score by a few thousandths, which is the size of one threshold step. The threshold has not been checked against vectors made on a phone; do that with the offline end-to-end run before relying on ${r.threshold} to the last decimal.`,
    "- Every guest confirms a match, so a false confirmation shows a wrong card the guest can reject; it never plays unconfirmed.",
    "",
  );
  return lines.join("\n");
}
