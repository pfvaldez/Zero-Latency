import { tmpdir } from "node:os";
import { join } from "node:path";
import { defineConfig, devices } from "@playwright/test";
import { writeQrVideo } from "./e2e/support/qr-video.ts";

// The fake camera shows the QR code of stop 3 (see e2e/stops.spec.ts).
const FAKE_CAMERA = join(tmpdir(), "asknoor-qr-stop-3.y4m");
writeQrVideo(FAKE_CAMERA, "NOOR-STOP-3");

const baseURL = "http://localhost:4173"; // `bun run preview` pins this port with --strictPort

export default defineConfig({
  testDir: "./e2e",
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  use: { baseURL, trace: "on-first-retry" },
  projects: [
    {
      name: "mobile-chrome",
      use: {
        ...devices["Pixel 7"],
        // The fake camera (Chromium flags) for the scanner test.
        permissions: ["camera"],
        launchOptions: {
          args: [
            "--use-fake-device-for-media-stream",
            "--use-fake-ui-for-media-stream",
            `--use-file-for-fake-video-capture=${FAKE_CAMERA}`,
          ],
        },
      },
    },
    {
      // iOS Safari's engine. A guest scans a stop's QR code with the iPhone Camera app in airplane
      // mode, and Safari opens /stop/n: the service worker must answer that navigation offline.
      name: "mobile-safari",
      use: { ...devices["iPhone 14"] },
      testMatch: /offline-stop-link\.spec\.ts/,
    },
  ],
  webServer: {
    // Always a fresh build: a leftover preview server would test an old bundle.
    command: "bun run build && bun run preview",
    url: baseURL,
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
