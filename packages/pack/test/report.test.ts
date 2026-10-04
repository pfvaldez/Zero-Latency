import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { REPO_ROOT } from "../src/model.ts";
import { type EvalResults, renderEval } from "../src/report.ts";

const results = async () =>
  JSON.parse(
    await readFile(join(REPO_ROOT, "content", "ondera-noor", "eval", "results.json"), "utf8"),
  ) as EvalResults;

describe("docs/EVAL.md (rendered from the committed results)", () => {
  it("shows the honest held-out estimate and keeps the full-set numbers labeled in sample", async () => {
    const md = renderEval(await results());
    expect(md).toContain("## Honest estimate: tune on one half, report on the other");
    expect(md).toContain("**by slot**");
    expect(md).toContain("Pooled held-out");
    expect(md).toContain("Tuned on the full set (in sample, kept for comparison)");
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
