// docs/EVAL.md: generated text from the evaluation results. Pure string building.

import type { Fold, Metrics, PooledMetrics, WolofEvidence } from "@asknoor/core";

const pct = (x: number, digits = 1) => `${(x * 100).toFixed(digits)}%`;
const ci = (c: { low: number; high: number }) => `${pct(c.low, 0)} to ${pct(c.high, 0)}`;

/** One model in the full-versus-trimmed comparison (written by `compare-models`, rendered here). */
export interface ModelRow {
  name: string;
  root: string;
  modelBytes: number;
  loadMs: number;
  queryMedianMs: number;
  queryP95Ms: number;
  /** Pooled held-out numbers for the shipped passage set. */
  heldOut: {
    top1: number;
    coverage: number;
    falseConfirm: number;
    failSafe: number;
    questions: number;
    answered: number;
  } | null;
  threshold: number;
  /** Mean cosine between this model's vectors and the full model's on the same texts. */
  meanCosineToFull: number;
  /** Held-out top-1 minus the full model's, in points. */
  top1VsFull: number;
  withinTolerance: boolean;
}

export interface ModelComparison {
  date: string;
  tolerancePoints: number;
  rows: ModelRow[];
  chosen: string | null;
  shipped: string | null;
  shippedReason: string;
}

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
  wolof: WolofEvidence | null;
  /** Full model against the trimmed-vocabulary variants; null until `compare-models` has run. */
  models?: ModelComparison | null;
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

function sensitivity(r: EvalResults): string {
  const shipped = r.study.find((x) => x.name.startsWith("after:"));
  const strict = r.study.find((x) => x.name.startsWith("after, without"));
  if (!shipped?.pooled || !strict?.pooled) return "";
  const a = shipped.pooled;
  const b = strict.pooled;
  return `Held-out coverage goes from ${pct(a.coverage)} to ${pct(b.coverage)}, so the gain does not come from near-copies; but false confirm goes from ${pct(a.falseConfirmRate)} to ${pct(b.falseConfirmRate)} and fail-safe from ${pct(a.failSafeRate)} to ${pct(b.failSafeRate)}, so removing them is not free either. With this few questions these differences are within the noise of the intervals.`;
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
      `- **Sensitivity:** the last row of the table drops the ${l.excludedAtCutoff} phrasings that overlap a question by ${l.strictCutoff} or more. ${sensitivity(r)}`,
      "- **What the audit cannot see:** it measures token overlap within one language, so a phrasing that is a paraphrase or a translation of a test question is not detected. Paraphrase leakage is not measured.",
      "- **Limits I cannot remove:** the team's assistant also wrote the test questions and has seen them in this project, and both come from the same model family, so the style of the phrasings and of the questions is correlated. That can make the gain look larger than real guests would give. They are unchecked machine text (a draft), shipped labeled; see `docs/RESPONSIBLE_AI.md`.",
      "",
    );
  }
  return out;
}

const chrfOf = (w: WolofEvidence, name: string) => w.flores?.directions[name];
const shorten = (text: string, max = 160) =>
  text.length > max ? `${text.slice(0, max)}… (${text.length} characters)` : text;

function wolofSection(w: WolofEvidence | null): string[] {
  const out: string[] = ["## Wolof evidence", ""];
  if (!w || (!w.flores && !w.fleurs && !w.roundtrip)) {
    out.push(
      "Not run yet. (`uv run --group translate python -m asknoor.evidence.run`; see `docs/PACK.md`.)",
      "",
    );
    return out;
  }
  out.push(
    "How good are the machine translation and speech recognition the Wolof drafts and the dub evaluation depend on? Local runs, never in the product; **NLLB and MMS are CC-BY-NC-4.0 (non-commercial)**. chrF is 0 to 100 (higher is better). Sample sizes are in every row.",
    "",
  );
  if (w.flores) {
    const f = w.flores;
    out.push(
      `### Machine translation: FLORES-200 ${f.split} (NLLB-200 distilled 600M)`,
      "",
      `${f.n} sentences${f.sampled ? ` sampled from ${f.sentences_in_split} (seed ${f.seed})` : " (the whole split)"}, the same sentences in every direction.`,
      "",
      "| Direction | chrF | Sentences |",
      "|---|---|---|",
    );
    for (const [name, d] of Object.entries(f.directions))
      out.push(`| ${name.replaceAll("_Latn", "")} | ${d.chrf} | ${d.n} |`);
    const wo = chrfOf(w, "eng_Latn to wol_Latn");
    const de = chrfOf(w, "eng_Latn to deu_Latn");
    if (wo && de) {
      out.push(
        "",
        `English to Wolof scores ${wo.chrf} and English to German ${de.chrf}: Wolof is **${(de.chrf - wo.chrf).toFixed(1)} chrF points ${de.chrf >= wo.chrf ? "lower" : "higher"}**.`,
      );
    }
    out.push("");
  }
  if (w.fleurs) {
    const f = w.fleurs;
    out.push(
      "### Speech recognition: MMS-1b-all with the Wolof adapter on FLEURS Wolof",
      "",
      `${f.n} utterances sampled from ${f.utterances_in_split} (seed ${f.seed}), ${f.reference_words} reference words, ${f.audio_seconds} s of audio. Same normalization on both sides (lowercase, no punctuation).`,
      "",
      "| Metric | Value |",
      "|---|---|",
      `| Word error rate | ${(f.wer * 100).toFixed(1)}% |`,
      `| Character error rate | ${(f.cer * 100).toFixed(1)}% |`,
      "",
      "Wolof spelling varies, so the word error rate likely overstates the real errors and the character error rate is probably the fairer number (this run did not measure that).",
      "",
    );
  }
  if (w.roundtrip) {
    const r = w.roundtrip;
    out.push(
      "### Round trip on the AI-dubbed Wolof clips",
      "",
      `MMS Wolof transcript, then NLLB Wolof to English, then chrF against Preet's English script. **n = ${r.n} clips**; pooled chrF **${r.pooled_chrf}**.`,
      "",
      "| Clip | chrF | Back to English (machine) |",
      "|---|---|---|",
    );
    for (const c of r.clips)
      out.push(`| ${c.clip} | ${c.chrf} | ${shorten(c.back_to_english.replaceAll("|", "/"))} |`);
    out.push("");
  }
  const back = chrfOf(w, "wol_Latn to eng_Latn");
  if (w.roundtrip && w.fleurs && back) {
    out.push(
      `**Where it breaks (an inference, not a measurement):** on clean FLORES text NLLB's Wolof to English scores ${back.chrf}, and on real FLEURS speech MMS makes ${(w.fleurs.cer * 100).toFixed(1)}% character errors; the dubs round-trip at ${w.roundtrip.pooled_chrf}, far below what either stage suggests (the numbers are different metrics on different material, so they are not directly comparable). That points at the dubbed audio (or MMS on synthetic speech) more than at the translation step, but a Wolof speaker listening to the clips is the only real test.`,
      "",
    );
  }
  out.push(
    `**Limits:** the round trip is ${w.roundtrip?.n ?? 0} clips, so it is an anecdote, not a benchmark; FLEURS is read speech by volunteers and the dubs are synthetic speech, so neither number transfers to a farm tour; a low chrF here means the machine drafts need a Wolof speaker, which is exactly how they are treated (drafts, demo only). The round trip compounds two errors (recognition and translation) and cannot say which one is at fault. These runs used a length-sorted batch order and an output-length cap that the committed translation drafts did not, so the two are slightly different generation settings.`,
    "",
  );
  return out;
}

function modelsSection(m: ModelComparison | null): string[] {
  if (!m) return [];
  const out: string[] = ["## Model size: full against trimmed vocabulary", ""];
  out.push(
    `Status: run on ${m.date} (\`bun run --cwd packages/pack compare-models\`). The e5 model is 118 MB, of which about 96 MB is a 250,002-token embedding table, most of it for languages and words Ask Noor never sees. The trimmed variants keep the rows for tokens that occur in large public text in en, de, nl, sv and Wolof (Wikipedia, Tatoeba, FLEURS Wolof transcripts) and in our own content (never the test questions), plus every single character and every special token, and cut the rest. The kept rows are sliced from the shipped int8 table, so each is **byte-identical** to the full model's row; nothing is re-quantized. Acceptance rule, set before the run: pooled held-out top-1 within ${m.tolerancePoints} points of the full model, and a pack under 50 MB.`,
    "",
    "| Model | Model files | Held-out top-1 | vs full | Coverage | False confirm | Mean cosine to full | Load | One question, median / p95 | Within rule |",
    "|---|---|---|---|---|---|---|---|---|---|",
  );
  for (const x of m.rows) {
    const h = x.heldOut;
    out.push(
      `| ${x.name} | ${mb(x.modelBytes)} | ${h ? pct(h.top1) : "n/a"} | ${x.top1VsFull >= 0 ? "+" : ""}${x.top1VsFull} points | ${h ? pct(h.coverage) : "n/a"} | ${h ? pct(h.falseConfirm) : "n/a"} | ${x.meanCosineToFull} | ${x.loadMs} ms | ${x.queryMedianMs} / ${x.queryP95Ms} ms | ${x.withinTolerance ? "yes" : "**no**"} |`,
    );
  }
  out.push(
    "",
    `**Shipped: ${m.shipped ?? "none (the full model)"}.** ${m.shippedReason}. Every row gets the same shipped threshold (${[...new Set(m.rows.map((x) => x.threshold))].join(", ")}) when it is chosen again on that model's own scores, so the threshold does not change.`,
    "",
    "- **The two control rows are the reason the trimmed model is not re-quantized.** Re-quantizing from the fp32 weights (the obvious route) cost 5.4 points of held-out top-1 with or without trimming, so the loss came from the new quantization, not from the smaller vocabulary. With 56 answered held-out questions, that is 3 questions, which is within noise, but it fails the rule as written, so the shipped model slices the original int8 rows instead.",
    "- Held-out top-1 is the same for every sliced row; coverage differs by one or two questions (one question is 1.8 points), so do not read the order of the trimmed rows as a ranking.",
    "- A trimmed vocabulary is a risk for words not in the corpus. Words that were cut are split into the characters that remain, or become the unknown token. Content words are all kept (the segmentation of our own text is identical to the full tokenizer's for 99% of lines), but a guest's rare word may be tokenized differently from the full model; the matcher then sees a slightly different vector (mean cosine to full above), and the guest still confirms every match.",
    "- Timings are Node on the build machine, not a phone. The size of the file is what changes for the guest: a smaller one-time farm-pack download.",
    "",
  );
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
  lines.push(...wolofSection(r.wolof));
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
  lines.push(...modelsSection(r.models ?? null));
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
