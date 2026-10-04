import { defineConfig } from "vitest/config";

// One run for the whole repo. Coverage must run from here, without --project, or the
// include paths below match nothing.
export default defineConfig({
  test: {
    projects: ["apps/web", "packages/core", "packages/pack", "content"],
    coverage: {
      provider: "v8",
      include: ["packages/core/src/**/*.ts"],
      exclude: ["packages/core/src/**/*.test.ts"],
      thresholds: { "packages/core/src/**": { lines: 90 } },
    },
  },
});
