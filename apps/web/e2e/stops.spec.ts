// Stop links and the in-app QR scanner, offline. A guest can open /stop/n (for example from the
// QR code on a sign) or scan NOOR-STOP-n with the camera, and both work in airplane mode after
// the download. The camera is a fake feed that shows the QR code of stop 3 (playwright.config.ts).

import { expect, test } from "@playwright/test";
import { watchRequests } from "./support/watch.ts";

test("offline: /stop/2 opens stop 2, and scanning the QR code for stop 3 opens stop 3", async ({
  page,
  context,
  baseURL,
}) => {
  test.setTimeout(120_000);
  if (!baseURL) throw new Error("baseURL is not configured");
  const watch = watchRequests(context, new URL(baseURL).origin);
  const problems: string[] = [];
  page.on("pageerror", (e) => problems.push(`page error: ${e.message}`));

  // Force the scanner's own decoder (a worker), the path iPhones and Linux browsers use: they have no
  // native BarcodeDetector. Chromium on a Mac has one, which would hide a broken worker.
  await page.addInitScript(() => {
    Reflect.deleteProperty(window, "BarcodeDetector");
  });

  // Online: language and download.
  await page.goto("/");
  await page.getByRole("button", { name: "English" }).click();
  await page.getByRole("button", { name: "Download" }).click();
  await expect(page.getByRole("heading", { name: "Tour stops" })).toBeVisible({ timeout: 60_000 });
  await page.evaluate(() => navigator.serviceWorker.ready);
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
  await page.waitForTimeout(3000);

  // Airplane mode. A stop link, typed as a new address, opens that stop.
  await context.setOffline(true);
  watch.goOffline();
  await page.goto("/stop/2");
  await expect(page.getByRole("heading", { name: "Noor's own recording" })).toBeVisible();
  await expect(page.getByText(/red coffee cherries/)).toBeVisible();
  expect(new URL(page.url()).pathname).toBe("/");

  // A stop that does not exist falls back to the list with a plain message.
  await page.goto("/stop/9");
  await expect(page.getByRole("heading", { name: "Tour stops" })).toBeVisible();
  await expect(
    page.getByText("We could not find that stop. Check the number and try again."),
  ).toBeVisible();

  // Scan: the fake camera shows NOOR-STOP-3, the roasting stop.
  const consoleLines: string[] = [];
  page.on("console", (m) => consoleLines.push(`${m.type()}: ${m.text()}`));
  await page.getByRole("button", { name: "Scan a stop code" }).click();
  try {
    await expect(page.getByRole("heading", { name: "Noor's own recording" })).toBeVisible({
      timeout: 30_000,
    });
  } catch (error) {
    // Say what the camera view looked like, so a failure on another machine can be diagnosed from the log.
    const video = await page
      .locator("video")
      .evaluate((v: HTMLVideoElement) => ({
        readyState: v.readyState,
        width: v.videoWidth,
        height: v.videoHeight,
        paused: v.paused,
        hasStream: !!v.srcObject,
        barcodeDetector: "BarcodeDetector" in window,
        // A coarse picture of what the camera shows (# = dark), to tell "no code in view" from "not decoded".
        ascii: (() => {
          const c = document.createElement("canvas");
          c.width = 48;
          c.height = 24;
          const ctx = c.getContext("2d");
          if (!ctx) return "";
          ctx.drawImage(v, 0, 0, 48, 24);
          const d = ctx.getImageData(0, 0, 48, 24).data;
          const rows: string[] = [];
          for (let y = 0; y < 24; y++) {
            let row = "";
            for (let x = 0; x < 48; x++) row += (d[(y * 48 + x) * 4] ?? 0) < 128 ? "#" : ".";
            rows.push(row);
          }
          return rows.join("|");
        })(),
      }))
      .catch((e: unknown) => String(e));
    console.log(
      "scan diagnostics",
      JSON.stringify({
        video,
        console: consoleLines,
        text: await page.locator("main").innerText(),
      }),
    );
    throw error;
  }
  await expect(page.getByText(/roast the coffee beans/)).toBeVisible();

  expect(watch.foreign, "requests to other origins").toEqual([]);
  expect(watch.failedOffline, "requests that needed the network while offline").toEqual([]);
  expect(problems).toEqual([]);
});
