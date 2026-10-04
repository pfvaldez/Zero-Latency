import { defineProject } from "vitest/config";

// Validates the content files in content/<farm>/ against the schemas in packages/core.
export default defineProject({
  test: { name: "content", environment: "node", include: ["*.test.ts"] },
});
