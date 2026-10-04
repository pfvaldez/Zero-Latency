// Build-time commands for the farm pack. Run with Node 24 (type stripping) through the package
// scripts, for example `bun run --cwd packages/pack eval`. Never runs at guest runtime.

import { join } from "node:path";
import { runEval } from "./eval-run.ts";
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
    default:
      console.error("usage: cli.ts model [--into dir] | eval [--farm slug]");
      return 2;
  }
}

main().then(
  (code) => process.exit(code),
  (error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  },
);
