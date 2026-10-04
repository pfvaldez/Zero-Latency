import { defineProject, mergeConfig } from "vitest/config";
import viteConfig from "./vite.config.ts";

// `include` keeps Playwright's e2e/*.spec.ts files out of Vitest.
export default mergeConfig(
  viteConfig,
  defineProject({
    test: {
      name: "web",
      environment: "jsdom",
      include: ["src/**/*.test.{ts,tsx}"],
      setupFiles: ["./src/test/setup.ts"],
      // Vitest replaces every CSS file with an empty string unless told otherwise. Tests that read
      // theme.css as text (theme.test.ts, cyan-rule.test.ts) import it with ?raw, so let those through.
      css: { include: [/\.css\?raw$/] },
    },
  }),
);
