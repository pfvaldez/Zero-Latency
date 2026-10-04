// Compares the full e5 model with trimmed-vocabulary variants the same honest way the shipped
// evaluation works: held-out halves of the question slots for the shipped passage set. The rule for
// shipping a smaller model: pooled held-out top-1 within TOP1_TOLERANCE of the full model.

import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { dot, loadEmbedder } from "./embed.ts";
import { buildPassages, runEval } from "./eval-run.ts";
import { contentDir, loadClips, loadQuestions } from "./load-content.ts";
import { DEFAULT_CACHE, REPO_ROOT, stageModel } from "./model.ts";
import type { ModelComparison, ModelRow } from "./report.ts";

export const TOP1_TOLERANCE = 0.02; // two points
export const PACK_BUDGET_BYTES = 50_000_000;

async function texts(farm: string): Promise<string[]> {
  const { passages } = await buildPassages(farm, await loadClips(farm));
  return [...passages.map((p) => p.text), ...(await loadQuestions(farm)).map((q) => q.question)];
}

export async function compareModels(
  farm: string,
  roots: { name: string; root: string }[],
  now = new Date(),
  ship?: { name: string; reason: string },
): Promise<ModelComparison> {
  const all = await texts(farm);
  const rows: ModelRow[] = [];
  let fullVectors: Float32Array[] | null = null;
  let fullTop1 = 0;
  for (const [i, { name, root }] of roots.entries()) {
    const modelRoot = i === 0 && root === "full" ? undefined : root;
    if (modelRoot === undefined)
      await stageModel(join(REPO_ROOT, ".cache", "stage"), DEFAULT_CACHE);
    const resolved = modelRoot ?? join(REPO_ROOT, ".cache", "stage", "model");
    const r = await runEval(farm, now, { write: false, modelRoot, modelLabel: name });
    const shipped = r.study.find((x) => x.name.startsWith("after:")) ?? r.study[1];
    const pooled = shipped?.pooled ?? null;
    const e = await loadEmbedder(resolved);
    const vectors = await e.embed(all, "passage: ");
    await e.dispose();
    if (i === 0) {
      fullVectors = vectors;
      fullTop1 = pooled?.top1Rate ?? 0;
    }
    const cos =
      vectors.reduce(
        (s, v, k) => s + dot(v, (fullVectors as Float32Array[])[k] as Float32Array),
        0,
      ) / vectors.length;
    rows.push({
      name,
      root: modelRoot ?? "full (pinned revision)",
      modelBytes: r.size.modelBytes,
      loadMs: r.timings.modelLoadMs,
      queryMedianMs: r.timings.queryMedianMs,
      queryP95Ms: r.timings.queryP95Ms,
      heldOut: pooled
        ? {
            top1: pooled.top1Rate,
            coverage: pooled.coverage,
            falseConfirm: pooled.falseConfirmRate,
            failSafe: pooled.failSafeRate,
            questions: pooled.questions,
            answered: pooled.answered,
          }
        : null,
      threshold: r.threshold,
      meanCosineToFull: Math.round(cos * 10_000) / 10_000,
      top1VsFull: pooled ? Math.round((pooled.top1Rate - fullTop1) * 1000) / 10 : 0,
      withinTolerance: pooled ? pooled.top1Rate >= fullTop1 - TOP1_TOLERANCE : false,
    });
  }
  const ok = rows
    .slice(1)
    .filter((x) => x.withinTolerance)
    .sort((a, b) => a.modelBytes - b.modelBytes);
  const chosen = ok[0]?.name ?? null;
  if (ship && !ok.some((x) => x.name === ship.name))
    throw new Error(`${ship.name} is not within tolerance, so it cannot ship`);
  return {
    date: now.toISOString().slice(0, 10),
    tolerancePoints: TOP1_TOLERANCE * 100,
    rows,
    chosen,
    shipped: ship?.name ?? chosen,
    shippedReason: ship?.reason ?? "the smallest model within tolerance",
  };
}

export async function writeComparison(farm: string, c: ModelComparison): Promise<void> {
  const dir = join(contentDir(farm), "eval");
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, "models.json"), `${JSON.stringify(c, null, 2)}\n`);
}
