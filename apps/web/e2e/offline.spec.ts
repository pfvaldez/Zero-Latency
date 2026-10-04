// The airplane-mode test (non-negotiable 1). Download the farm pack online, then go offline,
// reload, and use the tour. The test fails on ANY request that leaves the page: a request to
// another origin, or a request that has to go to the network and fails.
//
// It needs the model in the fixture pack, which is not committed:
//   bun run pack:model --trimmed --into apps/web/public/packs/fixture   (or without --trimmed)

import { expect, test } from "@playwright/test";
import { watchRequests } from "./support/watch.ts";

const OUTBOX_DB = "asknoor-outbox";

const outboxCount = (page: import("@playwright/test").Page) =>
  page.evaluate(
    (name) =>
      new Promise<number>((resolve, reject) => {
        const open = indexedDB.open(name);
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const db = open.result;
          if (!db.objectStoreNames.contains("items")) return resolve(0);
          const req = db.transaction("items").objectStore("items").count();
          req.onsuccess = () => resolve(req.result);
          req.onerror = () => reject(req.error);
        };
      }),
    OUTBOX_DB,
  );

test("control: the request watcher does catch a request that leaves the page", async ({
  page,
  context,
  baseURL,
}) => {
  if (!baseURL) throw new Error("baseURL is not configured");
  const watch = watchRequests(context, new URL(baseURL).origin);
  await page.goto("/");
  await context.setOffline(true);
  watch.goOffline();
  await page.evaluate(() => fetch("https://example.com/leak").catch(() => {}));
  await page.evaluate(() => fetch(`/not-in-the-cache-${Date.now()}`).catch(() => {}));
  expect(watch.foreign).toEqual(["https://example.com/leak"]);
  expect(watch.failedOffline.length).toBeGreaterThan(0);
});

test("download, go offline, reload, play stop 1, ask a question, and a German safety question stores nothing", async ({
  page,
  context,
  baseURL,
}) => {
  test.setTimeout(180_000);
  if (!baseURL) throw new Error("baseURL is not configured");
  const origin = new URL(baseURL).origin;

  const problems: string[] = [];
  page.on("console", (m) => {
    if (m.type() === "error") problems.push(`console error: ${m.text()}`);
  });
  page.on("pageerror", (e) => problems.push(`page error: ${e.message}`));

  const watch = watchRequests(context, origin);
  const { foreign, failedOffline } = watch;

  // 1. Online: pick the language and download the pack once.
  await page.goto("/");
  await page.getByRole("button", { name: "English" }).click();
  await expect(page.getByRole("heading", { name: "Download the farm tour" })).toBeVisible();
  await page.getByRole("button", { name: "Download" }).click();
  await expect(page.getByRole("heading", { name: "Tour stops" })).toBeVisible({ timeout: 60_000 });

  // The service worker must control the page before we cut the network.
  await page.evaluate(() => navigator.serviceWorker.ready);
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
  // Let the shell and the ONNX runtime finish precaching.
  await page.waitForTimeout(3000);

  // 2. Airplane mode, then a reload: the language, the pack and the app all come from the phone.
  await context.setOffline(true);
  watch.goOffline();
  await page.reload();
  await expect(page.getByRole("heading", { name: "Tour stops" })).toBeVisible();

  // 3. Play stop 1: Noor's recording and its subtitles.
  await page.getByRole("button", { name: "Stop 1" }).click();
  await expect(page.getByRole("heading", { name: "Noor's story" })).toBeVisible();
  await expect(page.getByText(/Welcome to the fixture farm/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Play" })).toBeEnabled();
  await page.getByRole("button", { name: "Back" }).click();

  // 4. Ask: the e5 model runs in the worker from the saved pack; the guest sees the Confirm card.
  await page.getByRole("navigation").getByRole("button", { name: "Ask" }).click();
  const askButton = page.locator("form button[type=submit]");
  await expect(askButton).toHaveText("Ask", { timeout: 90_000 });
  await page.getByRole("textbox").fill("We pick the red coffee cherries by hand.");
  await askButton.click();
  await expect(page.getByText(/Noor talks about picking the coffee cherries/)).toBeVisible({
    timeout: 30_000,
  });
  await page.getByRole("button", { name: "Yes, play it" }).click();
  await expect(page.getByRole("heading", { name: "Noor's story" })).toBeVisible();
  await expect(page.getByText(/red coffee cherries/)).toBeVisible();
  await page.getByRole("button", { name: "Back" }).click();

  // 5. A question Noor never recorded is saved for her.
  await page.getByRole("textbox").fill("Do you have a zip line and a swimming pool?");
  await askButton.click();
  await expect(page.getByText("Not sure, ask a person")).toBeVisible({ timeout: 30_000 });
  const saved = await outboxCount(page);
  expect(saved).toBe(1);

  // 6. A German safety question shows the card and stores nothing.
  await page.getByRole("button", { name: "Change language" }).click();
  await page.getByRole("button", { name: "Deutsch" }).click();
  await page.getByRole("navigation").getByRole("button", { name: "Fragen" }).click();
  await page.getByRole("textbox").fill("Wir brauchen einen Arzt, es ist ein Notfall");
  await expect(askButton).toHaveText("Fragen", { timeout: 30_000 });
  await askButton.click();
  await expect(page.getByRole("alert")).toBeVisible();
  expect(await outboxCount(page)).toBe(saved);

  // Nothing left the page.
  expect(foreign, "requests to other origins").toEqual([]);
  expect(failedOffline, "requests that needed the network while offline").toEqual([]);
  expect(problems, "console and page errors").toEqual([]);
});
