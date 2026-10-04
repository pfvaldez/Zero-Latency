import { defineConfig, devices } from "@playwright/test";

const baseURL = "http://localhost:4173"; // `bun run preview` pins this port with --strictPort

export default defineConfig({
  testDir: "./e2e",
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  use: { baseURL, trace: "on-first-retry" },
  // Chromium only: Playwright's service-worker and offline APIs are Chromium-only, and the
  // airplane-mode test (Slice 1) needs them.
  projects: [{ name: "mobile-chrome", use: { ...devices["Pixel 7"] } }],
  webServer: {
    // Always a fresh build: a leftover preview server would test an old bundle.
    command: "bun run build && bun run preview",
    url: baseURL,
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
