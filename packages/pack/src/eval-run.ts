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
  leaveOneLanguageOut,
  type Metrics,
  momentOfClip,
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
    });
    for (const [lang, text] of Object.entries(translations.get(clip.id) ?? {})) {
      passages.push({ momentId: clip.momentId, clip: clip.id, lang: lang as VisitorLang, text });
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
    rowFilter: (p: Passage) => boolean,
    moments: ReadonlySet<string>,
  ): ScoredQuestion[] =>
    questions.map((q, i) => {
      const best = new Map<string, number>();
      passages.forEach((p, j) => {
        if (!moments.has(p.momentId) || !rowFilter(p)) return;
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

  const all = () => true;
  const scoredA = score(all, publishedA);
  const scoredB = score(all, publishedB);
  const grid = thresholdGrid(0.6, 0.99, 0.0025);
  const rowsA = sweep(scoredA, grid, publishedA, MARGIN_PLACEHOLDER);
  const picked = pickThreshold(rowsA, MAX_FALSE_CONFIRM);
  const gridMax = grid.at(-1) as number;

  // The honest estimate: tune on one half of the question slots, report on the other, then swap.
  const cv = crossValidate(scoredA, grid, publishedA, MAX_FALSE_CONFIRM, MARGIN_PLACEHOLDER);
  const fullSetPick = picked?.threshold ?? null;
  const foldPicks = cv.folds.map((f) => f.threshold);
  // The threshold that ships is the strictest of the three picks (never looser than an honest estimate).
  const threshold = shippedThreshold(fullSetPick, foldPicks, gridMax);
  const primary = evaluate(scoredA, threshold, publishedA, MARGIN_PLACEHOLDER);
  const fullSet = picked
    ? evaluate(scoredA, picked.threshold, publishedA, MARGIN_PLACEHOLDER)
    : null;

  const passageLangs = [...new Set(passages.map((p) => p.lang))];
  const englishOnly =
    passageLangs.length > 1
      ? evaluate(
          score((p) => p.lang === "en", publishedA),
          threshold,
          publishedA,
          MARGIN_PLACEHOLDER,
        )
      : null;

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
    englishOnly,
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
        rule: "the strictest of the full-set pick and the two fold picks",
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
