// A real iPhone bug report: the guest downloads the pack, turns on airplane mode, scans a stop's QR
// code with the Camera app, and Safari opens /stop/3 as a fresh navigation. The service worker must
// answer it with the app shell, and the app must open stop 3 from the saved pack.
//
// Runs in WebKit (iOS Safari's engine) and Chromium. Airplane mode is a real network failure: the
// test serves the built app itself and shuts the server down after the download.

import { fileURLToPath } from "node:url";
import { expect, test } from "@playwright/test";
import { serveDist } from "./support/static-server.ts";

const DIST = fileURLToPath(new URL("../dist", import.meta.url));

test("offline: a stop link opened as a new navigation (as the iPhone Camera app does) opens the stop", async ({
  page,
  context,
}) => {
  test.setTimeout(120_000);
  const server = await serveDist(DIST);
  const failed: string[] = [];
  const foreign: string[] = [];
  let down = false;
  context.on("requestfailed", (r) => down && failed.push(`${r.url()} (${r.failure()?.errorText})`));
  context.on("request", (r) => {
    const url = r.url();
    if (
      !url.startsWith("blob:") &&
      !url.startsWith("data:") &&
      new URL(url).origin !== server.origin
    )
      foreign.push(url);
  });

  try {
    await page.goto(`${server.origin}/`);
    await page.getByRole("button", { name: "English" }).click();
    await page.getByRole("button", { name: "Download" }).click();
    await expect(page.getByRole("heading", { name: "Tour stops" })).toBeVisible({
      timeout: 60_000,
    });
    // The service worker is installed (the shell is precached) and controls the page.
    await page.evaluate(() => navigator.serviceWorker.ready);
    await expect
      .poll(() => page.evaluate(() => !!navigator.serviceWorker.controller), { timeout: 15_000 })
      .toBe(true);
  } finally {
    // Airplane mode: nothing answers on the network any more.
    await server.close();
    down = true;
  }

  // A brand-new tab, like Safari opening a link from the Camera app.
  const tab = await context.newPage();
  const response = await tab.goto(`${server.origin}/stop/3`);
  expect(response?.fromServiceWorker(), "the service worker answered the navigation").toBe(true);
  await expect(tab.getByRole("heading", { name: "Noor's story" })).toBeVisible({ timeout: 15_000 });
  await expect(tab.getByText(/roast the coffee beans/)).toBeVisible();
  await expect(tab.getByRole("button", { name: "Play" })).toBeEnabled();

  expect(foreign, "requests to other origins").toEqual([]);
  expect(failed, "requests that needed the network after it went down").toEqual([]);
});

test("control: with the server down and no service worker, the stop link does fail", async ({
  browser,
}) => {
  const server = await serveDist(DIST);
  const context = await browser.newContext({ serviceWorkers: "block" });
  try {
    const page = await context.newPage();
    await page.goto(`${server.origin}/`);
    await server.close();
    await expect(page.goto(`${server.origin}/stop/3`)).rejects.toThrow();
  } finally {
    await server.close().catch(() => {});
    await context.close();
  }
});
