import { defineProject } from "vitest/config";

export default defineProject({
  test: {
    name: "core",
    environment: "node",
    // TRD section 5 puts core's tests in packages/core/test/; co-located tests in src/ work too.
    // Both locations must run, or a guardrail test placed where the TRD says would be skipped.
    include: ["src/**/*.test.ts", "test/**/*.test.ts"],
  },
});
