// Offline: the Wolof order line on Noor's order sheet, and "Noor's month" (demo only). A guest
// orders (Noor confirms with her farm code), leaves feedback and asks a question Noor never
// answered; the Month tab then turns this phone's outbox into Noor's monthly text on a phone
// mock-up. Nothing leaves the page.

import { expect, test } from "@playwright/test";
import { watchRequests } from "./support/watch.ts";

test("offline: the order sheet shows the Wolof draft, and Noor's month shows the monthly text from this phone", async ({
  page,
  context,
  baseURL,
}) => {
  test.setTimeout(180_000);
  if (!baseURL) throw new Error("baseURL is not configured");
  const watch = watchRequests(context, new URL(baseURL).origin);
  const problems: string[] = [];
  page.on("pageerror", (e) => problems.push(`page error: ${e.message}`));

  await page.goto("/");
  await page.getByRole("button", { name: "English" }).click();
  await page.getByRole("button", { name: "Download" }).click();
  await expect(page.getByRole("heading", { name: "Tour stops" })).toBeVisible({ timeout: 60_000 });
  await page.evaluate(() => navigator.serviceWorker.ready);
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
  await page.waitForTimeout(3000);

  await context.setOffline(true);
  watch.goOffline();
  await page.reload();
  const nav = page.getByRole("navigation");
  await expect(nav.getByRole("button", { name: "Noor's month" })).toBeVisible();

  // The month screen starts empty: nothing is saved on this phone yet.
  await nav.getByRole("button", { name: "Noor's month" }).click();
  await expect(page.getByText(/No visits are saved on this phone yet/)).toBeVisible();

  // Order: the sheet shows the order line in Wolof, labeled; Noor confirms with her farm code.
  await nav.getByRole("button", { name: "Shop" }).click();
  await page.getByRole("button", { name: "Quantity +" }).click();
  await page.getByRole("button", { name: "Order" }).click();
  await expect(page.getByText("For Noor, in Wolof")).toBeVisible();
  await expect(page.getByText(/Jëfandikukat: 1 item/)).toBeVisible();
  await expect(page.getByText("Draft, not yet checked by a Wolof speaker")).toBeVisible();
  await page.getByLabel("Noor: enter your 4-digit farm code").fill("4827");
  await page.getByRole("button", { name: "Noor confirms your payment in person." }).click();
  await expect(page.getByText("Noor confirmed your order.")).toBeVisible();

  // Feedback.
  await nav.getByRole("button", { name: "Feedback" }).click();
  await page.getByLabel(/What did you love/).fill("The roasting demo");
  await page.getByLabel(/What would you change/).fill("Rooms to stay overnight");
  await page.getByRole("button", { name: "Send" }).click();
  await expect(page.getByText("Thank you! Noor will hear about it.")).toBeVisible();

  // A question Noor never answered is saved (the real model runs in the worker).
  await nav.getByRole("button", { name: "Ask" }).click();
  const ask = page.locator("form button[type=submit]");
  await expect(ask).toHaveText("Ask", { timeout: 90_000 });
  await page.getByRole("textbox").fill("Can we stay overnight in a room?");
  await ask.click();
  await expect(page.getByText("Not sure, ask a person")).toBeVisible({ timeout: 30_000 });

  // Noor's month, from this phone.
  await nav.getByRole("button", { name: "Noor's month" }).click();
  await expect(
    page.getByText(
      "Demo: one phone stands in for a month of synced visits. Sending is not built yet.",
    ),
  ).toBeVisible();
  const phone = page.getByRole("region", { name: "Noor's phone (mock-up)" });
  await expect(phone).toContainText("Draft, not yet checked by a Wolof speaker");
  await expect(phone).toContainText("Ci weer bii: 1 ay doxandéem");
  await expect(page.getByText(/This month: 1 guests/)).toBeVisible();

  expect(watch.foreign, "requests to other origins").toEqual([]);
  expect(watch.failedOffline, "requests that needed the network while offline").toEqual([]);
  expect(problems).toEqual([]);
});
