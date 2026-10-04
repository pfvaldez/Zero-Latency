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
  await page.getByRole("button", { name: "Scan a stop code" }).click();
  await expect(page.getByRole("heading", { name: "Noor's own recording" })).toBeVisible({
    timeout: 30_000,
  });
  await expect(page.getByText(/roast the coffee beans/)).toBeVisible();

  expect(watch.foreign, "requests to other origins").toEqual([]);
  expect(watch.failedOffline, "requests that needed the network while offline").toEqual([]);
  expect(problems).toEqual([]);
});
