import { defineProject } from "vitest/config";

// Fast tests only (no model, no network). Model tests are *.model.test.ts, run by
// `bun run test:model` after `bun run pack:model` (and by the CI `model` job).
export default defineProject({
  test: {
    name: "pack",
    environment: "node",
    include: ["test/**/*.test.ts"],
    exclude: ["test/**/*.model.test.ts"],
  },
});
