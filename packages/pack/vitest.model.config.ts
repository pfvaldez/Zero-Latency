import { defineProject } from "vitest/config";

export default defineProject({
  test: {
    name: "pack-model",
    environment: "node",
    include: ["test/**/*.model.test.ts"],
    testTimeout: 120_000,
    hookTimeout: 120_000,
  },
});
