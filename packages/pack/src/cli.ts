// Build-time commands for the farm pack. Run with Node 24 (type stripping) through the package
// scripts, for example `bun run --cwd packages/pack eval`. Never runs at guest runtime.

import { join } from "node:path";
import { PackError } from "@asknoor/core";
import { buildPack } from "./build.ts";
import { compareModels, writeComparison } from "./compare-models.ts";
import { runEval } from "./eval-run.ts";
import { buildFixture, DEMO_FARM_CODE } from "./fixture.ts";
import { importIndexPassages } from "./index-passages.ts";
import {
  ensureModelCache,
  ensureTrimmedModel,
  REPO_ROOT,
  stageModel,
  stageTrimmedModel,
  writeTrimmedLock,
} from "./model.ts";
import { writeVocabSeed } from "./vocab-seed.ts";

const [command, ...rest] = process.argv.slice(2);
const flag = (name: string) => {
  const i = rest.indexOf(name);
  return i === -1 ? undefined : rest[i + 1];
};

async function main(): Promise<number> {
  switch (command) {
    case "model": {
      const into = flag("--into");
      if (rest.includes("--write-trimmed-lock")) {
        const lock = await writeTrimmedLock(flag("--from"));
        console.log(`wrote model-trimmed.lock.json (${lock.keepCount} rows kept)`);
      } else if (rest.includes("--trimmed") && !into) {
        console.log(`trimmed model downloaded and verified at ${await ensureTrimmedModel()}`);
      } else if (into) {
        const dir = rest.includes("--trimmed")
          ? await stageTrimmedModel(join(REPO_ROOT, into))
          : await stageModel(join(REPO_ROOT, into));
        console.log(`model staged at ${dir}`);
      } else {
        console.log(`model cached and verified at ${await ensureModelCache()}`);
      }
      return 0;
    }
    case "eval": {
      const r = await runEval(flag("--farm") ?? "ondera-noor");
      const p = r.primary;
      console.log(
        `threshold ${r.threshold} (limit ${r.maxFalseConfirm * 100}% met: ${r.primary.falseConfirmRate <= r.maxFalseConfirm}); ` +
          `false confirm ${(p.falseConfirmRate * 100).toFixed(1)}%, coverage ${(p.coverage * 100).toFixed(1)}%, ` +
          `top-1 ${(p.top1Rate * 100).toFixed(1)}%, fail-safe ${(p.failSafeRate * 100).toFixed(1)}%. Wrote docs/EVAL.md`,
      );
      return 0;
    }
    case "index-import": {
      const from = flag("--from");
      if (!from) throw new Error("usage: index-import --from <raw.json>");
      const { file, audit } = await importIndexPassages(flag("--farm") ?? "ondera-noor", from);
      const count = Object.values(file.clips).reduce(
        (n, c) => n + c.en.length + c.de.length + c.nl.length + c.sv.length,
        0,
      );
      console.log(
        `index passages: ${count} kept, ${file.removedAsDuplicates.length} removed as exact duplicates of a test question; max token overlap with any question ${audit.maxOverlap.toFixed(2)}`,
      );
      return 0;
    }
    case "vocab-seed": {
      const n = await writeVocabSeed(
        flag("--farm") ?? "ondera-noor",
        join(REPO_ROOT, ".cache", "data", "vocab", "seed_content.txt"),
      );
      console.log(`vocab seed: ${n} lines of our own content (no test questions)`);
      return 0;
    }
    case "compare-models": {
      // compare-models full s0.75=.cache/trim/s0.75 ... : the first is always the full model.
      const roots = [{ name: "full (118 MB int8)", root: "full" }];
      for (const arg of rest.filter((a) => a.includes("="))) {
        const [name, path] = arg.split("=");
        roots.push({ name: name as string, root: join(REPO_ROOT, path as string) });
      }
      const ship = flag("--ship");
      const result = await compareModels(
        flag("--farm") ?? "ondera-noor",
        roots,
        new Date(),
        ship ? { name: ship, reason: flag("--reason") ?? "" } : undefined,
      );
      await writeComparison(flag("--farm") ?? "ondera-noor", result);
      for (const r of result.rows) {
        console.log(
          `${r.name}: ${(r.modelBytes / 1e6).toFixed(1)} MB, held-out top-1 ${r.heldOut ? (r.heldOut.top1 * 100).toFixed(1) : "-"}% (${r.top1VsFull >= 0 ? "+" : ""}${r.top1VsFull} vs full), coverage ${r.heldOut ? (r.heldOut.coverage * 100).toFixed(1) : "-"}%, cosine to full ${r.meanCosineToFull}, threshold ${r.threshold}, within 2 points: ${r.withinTolerance}`,
        );
      }
      console.log(`chosen: ${result.chosen ?? "none within tolerance"}`);
      return 0;
    }
    case "fixture": {
      const built = await buildFixture();
      console.log(
        `fixture pack ${built.manifest.packId} v${built.manifest.version} at ${built.dir}: ${built.manifest.clips.length} clips, ${built.manifest.embeddings.count} embeddings`,
      );
      return 0;
    }
    case "build": {
      const mode = flag("--mode") === "production" ? "production" : "demo";
      const publish = (flag("--publish") ?? "")
        .split(",")
        .filter(Boolean)
        .map((c) => Number(c.replace(/^clip0*/, "")));
      const built = await buildPack({
        farm: flag("--farm") ?? "ondera-noor",
        mode,
        publish,
        model: flag("--model") === "trimmed" ? "trimmed" : "full",
        // Noor's farm code comes from the environment (never printed). Demo packs fall back to the documented prototype demo code.
        ...(process.env.ASKNOOR_FARM_CODE || mode === "demo"
          ? { farmCode: process.env.ASKNOOR_FARM_CODE ?? DEMO_FARM_CODE }
          : {}),
      });
      const m = built.manifest;
      console.log(
        `${m.mode} pack ${m.packId} v${m.version} (${built.changed ? "changed" : "unchanged"}) at ${built.dir}: ` +
          `${m.clips.length} clips, ${m.embeddings.count} embeddings, ${(Object.values(m.sizes).reduce((a, b) => a + b, 0) / 1e6).toFixed(1)} MB`,
      );
      if (m.clips.length === 0)
        console.log(
          "  WARNING: this pack has no clips (nothing is checked yet for production, or every clip was excluded)",
        );
      for (const e of built.plan.excluded) console.log(`  excluded ${e.what}: ${e.why}`);
      return 0;
    }
    default:
      console.error(
        "usage: cli.ts model [--into dir] | index-import --from raw.json | eval [--farm slug] | build [--mode demo|production] [--publish clip08] [--model trimmed]",
      );
      return 2;
  }
}

main().then(
  (code) => process.exit(code),
  (error) => {
    console.error(
      error instanceof PackError
        ? `pack build refused: ${error.message}`
        : error instanceof Error
          ? error.message
          : error,
    );
    process.exit(1);
  },
);
