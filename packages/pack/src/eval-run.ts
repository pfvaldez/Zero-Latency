// Runs the evaluation: embeds the pack passages and the test questions with the pinned model
// (loaded from the same staged files a pack ships), sweeps the threshold with the real decide(),
// and writes docs/EVAL.md, results.json and threshold.json.

import { createHash } from "node:crypto";
import { mkdir, readdir, readFile, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";
import {
  breakdown,
  crossValidate,
  decideSafety,
  evaluate,
  histogram,
  IndexPassagesFileSchema,
  leakageAudit,
  leaveOneLanguageOut,
  type Metrics,
  momentOfClip,
  type PooledMetrics,
  pickThreshold,
  type ScoredQuestion,
  shippedThreshold,
  sweep,
  thresholdGrid,
  VISITOR_LANGS,
  type VisitorLang,
  wilson,
} from "@asknoor/core";
import { dot, loadEmbedder } from "./embed.ts";
import {
  type Clips,
  contentDir,
  loadClips,
  loadQuestions,
  loadTranscripts,
} from "./load-content.ts";
import { DEFAULT_CACHE, REPO_ROOT, readLock, stageModel } from "./model.ts";
import { type EvalResults, renderEval } from "./report.ts";

export const MAX_FALSE_CONFIRM = 0.05;
export const MARGIN_PLACEHOLDER = 0.05; // recorded, not used in P0
const P0_BUDGET_BYTES = 150_000_000;

export interface Passage {
  momentId: string;
  clip: number;
  lang: VisitorLang;
  text: string;
  /** "subtitle": text a guest can read. "index": a question-style phrasing, never shown. */
  kind: "subtitle" | "index";
}

interface TranslationsFile {
  clips?: Record<string, { sentences: Partial<Record<VisitorLang, string>>[] }>;
}

/** Draft translations of the clip text, joined per language; empty until the NLLB step has run. */
async function loadTranslations(
  farm: string,
): Promise<Map<number, Partial<Record<VisitorLang, string>>>> {
  const out = new Map<number, Partial<Record<VisitorLang, string>>>();
  try {
    const file = JSON.parse(
      await readFile(join(contentDir(farm), "translations", "clips.json"), "utf8"),
    ) as TranslationsFile;
    for (const [n, entry] of Object.entries(file.clips ?? {})) {
      const joined: Partial<Record<VisitorLang, string>> = {};
      for (const lang of VISITOR_LANGS) {
        if (lang === "en") continue;
        const parts = entry.sentences.map((s) => s[lang]).filter((x): x is string => !!x);
        if (parts.length === entry.sentences.length && parts.length > 0)
          joined[lang] = parts.join(" ");
      }
      out.set(Number(n), joined);
    }
  } catch {
    // no translations yet
  }
  return out;
}

export async function buildPassages(
  farm: string,
  clips: Clips,
): Promise<{ passages: Passage[]; source: string }> {
  const transcripts = await loadTranscripts(farm);
  const translations = await loadTranslations(farm);
  const passages: Passage[] = [];
  for (const clip of clips.clips) {
    const t = transcripts.get(clip.id);
    passages.push({
      momentId: clip.momentId,
      clip: clip.id,
      lang: "en",
      text: t?.text ?? clip.script.en,
      kind: "subtitle",
    });
    for (const [lang, text] of Object.entries(translations.get(clip.id) ?? {})) {
      passages.push({
        momentId: clip.momentId,
        clip: clip.id,
        lang: lang as VisitorLang,
        text,
        kind: "subtitle",
      });
    }
  }
  // Index-only phrasings (never shown): extra rows per moment, when the file exists.
  const idx = await readIndexFile(farm);
  if (idx) {
    for (const clip of clips.clips) {
      const byLang = idx.clips[String(clip.id)];
      if (!byLang) continue;
      for (const lang of ["en", "de", "nl", "sv"] as const) {
        for (const text of byLang[lang]) {
          passages.push({ momentId: clip.momentId, clip: clip.id, lang, text, kind: "index" });
        }
      }
    }
  }
  const fromTranscript = transcripts.size;
  const source =
    fromTranscript === 0
      ? "the English script of each clip (no transcript yet), plus draft translations where they exist"
      : `the English transcript for ${fromTranscript} clip(s), the script for the rest, plus draft translations where they exist`;
  return { passages, source };
}

const median = (xs: number[]) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)] ?? 0;
const p95 = (xs: number[]) =>
  [...xs].sort((a, b) => a - b)[Math.min(xs.length - 1, Math.floor(xs.length * 0.95))] ?? 0;

async function dirBytes(dir: string): Promise<number | null> {
  try {
    let total = 0;
    for (const f of await readdir(dir)) total += (await stat(join(dir, f))).size;
    return total;
  } catch {
    return null;
  }
}

/** The index-passages file, or null if it does not exist. Any other problem (bad JSON, bad shape) throws. */
async function readIndexFile(farm: string) {
  try {
    const raw = JSON.parse(await readFile(join(contentDir(farm), "index-passages.json"), "utf8"));
    return IndexPassagesFileSchema.parse(raw);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
}

async function removedCount(farm: string): Promise<number> {
  return (await readIndexFile(farm))?.removedAsDuplicates.length ?? 0;
}

export async function runEval(
  farm: string,
  now = new Date(),
  opts: { write?: boolean } = {},
): Promise<EvalResults> {
  const clips = await loadClips(farm);
  const questions = await loadQuestions(farm);
  const lock = await readLock();
  const { passages, source } = await buildPassages(farm, clips);

  const stage = join(REPO_ROOT, ".cache", "stage");
  const t0 = performance.now();
  await stageModel(stage, DEFAULT_CACHE);
  const embedder = await loadEmbedder(join(stage, "model"));
  const modelLoadMs = Math.round(performance.now() - t0);

  const t1 = performance.now();
  const passageVecs = await embedder.embed(
    passages.map((p) => p.text),
    "passage: ",
  );
  const passagesMs = Math.round(performance.now() - t1);

  const queryVecs: Float32Array[] = [];
  const perQuery: number[] = [];
  for (const q of questions) {
    const s = performance.now();
    const [v] = await embedder.embed([q.question], "query: ");
    perQuery.push(performance.now() - s);
    queryVecs.push(v as Float32Array);
  }
  await embedder.dispose();

  const allMoments = clips.clips.map((c) => c.momentId);
  const publishedA = new Set(clips.clips.filter((c) => c.published).map((c) => c.momentId));
  const publishedB = new Set(allMoments);

  const score = (
    rowFilter: (p: Passage, j: number) => boolean,
    moments: ReadonlySet<string>,
  ): ScoredQuestion[] =>
    questions.map((q, i) => {
      const best = new Map<string, number>();
      passages.forEach((p, j) => {
        if (!moments.has(p.momentId) || !rowFilter(p, j)) return;
        const s = dot(queryVecs[i] as Float32Array, passageVecs[j] as Float32Array);
        if (s > (best.get(p.momentId) ?? Number.NEGATIVE_INFINITY)) best.set(p.momentId, s);
      });
      return {
        id: q.id,
        lang: q.lang,
        variant: q.variant,
        expected: q.expected,
        safetyHit: decideSafety(q.question),
        results: [...best].map(([momentId, s]) => ({ momentId, score: s })),
      };
    });

  const grid = thresholdGrid(0.6, 0.99, 0.0025);
  const gridMax = grid.at(-1) as number;
  const hasIndex = passages.some((p) => p.kind === "index");

  // How close each index phrasing comes to a test question (it was written without seeing them).
  const indexPositions = passages
    .map((p, j) => (p.kind === "index" ? j : -1))
    .filter((j) => j >= 0);
  const audit = hasIndex
    ? leakageAudit(
        indexPositions.map((j) => ({
          clip: String(passages[j]?.clip),
          lang: passages[j]?.lang as string,
          text: passages[j]?.text as string,
        })),
        questions.map((q) => ({ id: q.id, lang: q.lang, question: q.question })),
      )
    : null;
  const STRICT_CUTOFF = 0.6;
  const tooClose = new Set(indexPositions.filter((_, k) => (audit?.best[k] ?? 0) >= STRICT_CUTOFF));

  // The passage sets to compare. "after" is what ships when index phrasings exist.
  const configs: { name: string; filter: (p: Passage, j: number) => boolean }[] = [
    {
      name: "subtitle text, English only",
      filter: (p) => p.kind === "subtitle" && p.lang === "en",
    },
    {
      name: hasIndex
        ? "before: subtitle text in all languages"
        : "subtitle text in all languages (shipped)",
      filter: (p) => p.kind === "subtitle",
    },
    ...(hasIndex
      ? [
          { name: "after: plus index-only passages (demo pack, shipped)", filter: () => true },
          {
            name: "production pack once English is checked: English subtitle text plus index-only",
            filter: (p: Passage) => p.kind === "index" || p.lang === "en",
          },
          {
            name: `after, without index phrasings that overlap a test question by ${STRICT_CUTOFF} or more`,
            filter: (p: Passage, j: number) => !(p.kind === "index" && tooClose.has(j)),
          },
        ]
      : []),
  ];
  const study = configs.map((cfg) => {
    const scored = score(cfg.filter, publishedA);
    const picked = pickThreshold(
      sweep(scored, grid, publishedA, MARGIN_PLACEHOLDER),
      MAX_FALSE_CONFIRM,
    );
    const cv = crossValidate(scored, grid, publishedA, MAX_FALSE_CONFIRM, MARGIN_PLACEHOLDER);
    return { cfg, scored, fullSetPick: picked?.threshold ?? null, cv };
  });
  const shippedIdx = hasIndex ? 2 : 1; // the pack that ships
  const prodIdx = hasIndex ? 3 : -1; // the production pack today
  const primaryStudy = study[shippedIdx] as (typeof study)[number];
  const scoredA = primaryStudy.scored;
  const scoredB = score(
    configs[shippedIdx]?.filter as (p: Passage, j: number) => boolean,
    publishedB,
  );
  const rowsA = sweep(scoredA, grid, publishedA, MARGIN_PLACEHOLDER);
  const picked = pickThreshold(rowsA, MAX_FALSE_CONFIRM);

  // The honest estimate for the shipped pack: tune on one half of the question slots, report on the other.
  const cv = primaryStudy.cv;
  const fullSetPick = primaryStudy.fullSetPick;
  const foldPicks = cv.folds.map((f) => f.threshold);
  // The threshold that ships is the strictest of every pick for the demo pack and the production pack,
  // so it is never looser than any honest estimate of either.
  const prod = prodIdx >= 0 ? (study[prodIdx] as (typeof study)[number]) : null;
  const threshold = shippedThreshold(
    fullSetPick,
    [...foldPicks, ...(prod ? [prod.fullSetPick, ...prod.cv.folds.map((f) => f.threshold)] : [])],
    gridMax,
  );
  const primary = evaluate(scoredA, threshold, publishedA, MARGIN_PLACEHOLDER);
  const fullSet = picked
    ? evaluate(scoredA, picked.threshold, publishedA, MARGIN_PLACEHOLDER)
    : null;

  const studyRows = study.map((row) => ({
    name: row.cfg.name,
    fullSetPick: row.fullSetPick,
    foldPicks: row.cv.folds.map((f) => f.threshold),
    pooled: row.cv.pooled as PooledMetrics | null,
    pooledCi: row.cv.pooled
      ? {
          falseConfirm: wilson(
            row.cv.pooled.wrongClipConfirm + row.cv.pooled.confirmOnNever,
            row.cv.pooled.questions,
          ),
          coverage: wilson(row.cv.pooled.correctConfirm, row.cv.pooled.answered),
          top1: wilson(row.cv.pooled.top1, row.cv.pooled.answered),
        }
      : null,
    atShipped: evaluate(row.scored, threshold, publishedA, MARGIN_PLACEHOLDER),
  }));
  const passageLangs = [...new Set(passages.map((p) => p.lang))];

  const metricsOf = (m: Record<string, Metrics>) =>
    Object.entries(m).map(([name, v]) => ({ name, m: v }));
  const loo = leaveOneLanguageOut(
    scoredA,
    grid,
    publishedA,
    MAX_FALSE_CONFIRM,
    MARGIN_PLACEHOLDER,
  ).map((r) => ({
    lang: r.lang,
    threshold: r.threshold,
    falseConfirmRate: r.heldOut?.falseConfirmRate ?? null,
    coverage: r.heldOut?.coverage ?? null,
  }));

  const topAnswered: number[] = [];
  const topNever: number[] = [];
  for (const q of scoredA) {
    if (q.expected === "safety") continue;
    const top = Math.max(...q.results.map((r) => r.score), 0);
    const answer = momentOfClip(q.expected);
    (answer !== null && publishedA.has(answer) ? topAnswered : topNever).push(top);
  }
  const lo = 0.6;
  const hi = 1.0;
  const bins = 8;

  const embeddingsBytes = passages.length * 384 * 4;
  const modelBytes = lock.files.reduce((s, f) => s + f.size, 0);
  const audioBytes = await dirBytes(join(REPO_ROOT, "pipeline", "build", farm, "audio", "en"));

  const sweepSample = rowsA
    .filter((_, i) => i % 8 === 0)
    .map((r) => ({
      threshold: r.threshold,
      falseConfirmRate: r.falseConfirmRate,
      coverage: r.coverage,
      failSafeRate: r.failSafeRate,
    }));

  const hash = createHash("sha256");
  for (const f of ["clips.json", "eval/test-questions.csv"])
    hash.update(await readFile(join(contentDir(farm), f)));
  hash.update(lock.revision);
  hash.update(JSON.stringify(passages.map((p) => [p.momentId, p.lang, p.text])));

  const nonSafety = questions.filter((q) => q.expected !== "safety").length;
  const answered = primary.answered;
  const results: EvalResults = {
    date: now.toISOString().slice(0, 10),
    modelRepo: lock.repo,
    modelRevision: lock.revision,
    contentHash: hash.digest("hex").slice(0, 16),
    questions: {
      total: questions.length,
      safety: questions.length - nonSafety,
      nonSafety,
      answered,
      neverAnswered: primary.neverAnswered,
      heldBackAsNone: questions.filter((q) => q.expected === "clip08").length,
    },
    passageSource: source,
    passageLangs,
    threshold,
    maxFalseConfirm: MAX_FALSE_CONFIRM,
    margin: MARGIN_PLACEHOLDER,
    primary,
    fullSet,
    fullSetPick,
    foldPicks,
    honest: {
      slotsA: cv.slotsA,
      slotsB: cv.slotsB,
      folds: cv.folds,
      pooled: cv.pooled,
      pooledCi: cv.pooled
        ? {
            falseConfirm: wilson(
              cv.pooled.wrongClipConfirm + cv.pooled.confirmOnNever,
              cv.pooled.questions,
            ),
            coverage: wilson(cv.pooled.correctConfirm, cv.pooled.answered),
            top1: wilson(cv.pooled.top1, cv.pooled.answered),
          }
        : null,
      byLang: Object.entries(cv.byLang).map(([name, m]) => ({ name, m })),
    },
    primaryCi: {
      falseConfirm: wilson(primary.wrongClipConfirm + primary.confirmOnNever, primary.questions),
      coverage: wilson(primary.correctConfirm, primary.answered),
    },
    study: studyRows,
    leakage: audit
      ? {
          passages: audit.passages,
          removedAsDuplicates: await removedCount(farm),
          maxOverlap: audit.maxOverlap,
          worst: audit.worst
            ? { text: audit.worst.text, lang: audit.worst.lang, questionId: audit.worst.questionId }
            : null,
          bestOverlapBins: audit.bestOverlapBins,
          strictCutoff: STRICT_CUTOFF,
          excludedAtCutoff: tooClose.size,
        }
      : null,
    afterPublish: evaluate(scoredB, threshold, publishedB, MARGIN_PLACEHOLDER),
    byLang: metricsOf(breakdown(scoredA, (q) => q.lang, threshold, publishedA, MARGIN_PLACEHOLDER)),
    byVariant: metricsOf(
      breakdown(scoredA, (q) => q.variant, threshold, publishedA, MARGIN_PLACEHOLDER),
    ),
    leaveOneOut: loo,
    sweepSample,
    histogram: {
      lo,
      hi,
      bins,
      answered: histogram(topAnswered, lo, hi, bins),
      never: histogram(topNever, lo, hi, bins),
    },
    timings: {
      modelLoadMs,
      passagesMs,
      queryMedianMs: Math.round(median(perQuery) * 10) / 10,
      queryP95Ms: Math.round(p95(perQuery) * 10) / 10,
      queries: perQuery.length,
    },
    size: {
      modelBytes,
      embeddingsBytes,
      audioBytes,
      totalBytes: audioBytes === null ? null : modelBytes + embeddingsBytes + audioBytes,
      budgetBytes: P0_BUDGET_BYTES,
    },
    unsafe: {
      safetyRecall: primary.safetyRecall,
      safetyFalsePositives: primary.safetyFalsePositives,
      safetyQuestions: primary.safetyQuestions,
    },
  };

  if (opts.write === false) return results;
  const evalDir = join(contentDir(farm), "eval");
  await mkdir(evalDir, { recursive: true });
  await writeFile(join(evalDir, "results.json"), `${JSON.stringify(results, null, 2)}\n`);
  await writeFile(
    join(evalDir, "threshold.json"),
    `${JSON.stringify(
      {
        match: threshold,
        margin: MARGIN_PLACEHOLDER,
        rule: "the strictest of the full-set pick and both fold picks, for the demo pack and the production pack",
        allPicks: studyRows.map((x) => ({
          passages: x.name,
          fullSetPick: x.fullSetPick,
          foldPicks: x.foldPicks,
        })),
        fullSetPick,
        foldPicks,
        heldOut: cv.pooled
          ? {
              falseConfirmRate: cv.pooled.falseConfirmRate,
              coverage: cv.pooled.coverage,
              top1: cv.pooled.top1Rate,
            }
          : null,
        limitMet: primary.falseConfirmRate <= MAX_FALSE_CONFIRM,
        maxFalseConfirm: MAX_FALSE_CONFIRM,
        falseConfirmRate: primary.falseConfirmRate,
        coverage: primary.coverage,
        questions: primary.questions,
        inSample: true, // match is measured on the questions it was partly chosen on; heldOut is the honest estimate
        modelRepo: lock.repo,
        modelRevision: lock.revision,
        passageSource: source,
        evaluatedOn: results.date,
        note: "margin is a recorded placeholder; the A-or-B step is P1. The threshold is chosen and measured on the same synthetic questions (see docs/EVAL.md).",
      },
      null,
      2,
    )}\n`,
  );
  await writeFile(join(REPO_ROOT, "docs", "EVAL.md"), `${renderEval(results)}\n`);
  return results;
}
