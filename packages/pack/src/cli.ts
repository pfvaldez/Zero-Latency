// Build-time commands for the farm pack. Run with Node 24 (type stripping) through the package
// scripts, for example `bun run --cwd packages/pack eval`. Never runs at guest runtime.

import { join } from "node:path";
import { PackError } from "@asknoor/core";
import { buildPack } from "./build.ts";
import { runEval } from "./eval-run.ts";
import { buildFixture } from "./fixture.ts";
import { ensureModelCache, REPO_ROOT, stageModel } from "./model.ts";

const [command, ...rest] = process.argv.slice(2);
const flag = (name: string) => {
  const i = rest.indexOf(name);
  return i === -1 ? undefined : rest[i + 1];
};

async function main(): Promise<number> {
  switch (command) {
    case "model": {
      const into = flag("--into");
      if (into) {
        const dir = await stageModel(join(REPO_ROOT, into));
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
      const built = await buildPack({ farm: flag("--farm") ?? "ondera-noor", mode, publish });
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
        "usage: cli.ts model [--into dir] | eval [--farm slug] | build [--mode demo|production] [--publish clip08]",
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
