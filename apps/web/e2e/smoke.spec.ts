import { expect, test } from "@playwright/test";

test("the app renders, works, and talks only to its own origin", async ({ page, baseURL }) => {
  if (!baseURL) throw new Error("baseURL is not configured");
  const origin = new URL(baseURL).origin;

  const problems: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") problems.push(`console error: ${message.text()}`);
  });
  page.on("pageerror", (error) => problems.push(`page error: ${error.message}`));

  // The core tour must work in airplane mode, so nothing may come from another origin:
  // no font CDN, no analytics, no remote script.
  const foreign: string[] = [];
  page.on("request", (request) => {
    const url = request.url();
    if (url.startsWith("data:") || url.startsWith("blob:")) return;
    // Compare parsed origins: startsWith would accept http://localhost:41730 or a lookalike host.
    if (new URL(url).origin !== origin) foreign.push(url);
  });

  await page.goto("/");

  // The placeholder screen, including the workspace package linked into the production bundle.
  await expect(page.getByRole("heading", { name: "Ask Noor" })).toBeVisible();
  await expect(page.getByText(/PLACEHOLDER: Phase 0/)).toBeVisible();
  await expect(page.getByText("@asknoor/core")).toBeVisible();

  // Animate UI Tabs.
  await expect(page.getByRole("tab", { name: "Story" })).toHaveAttribute("aria-selected", "true");
  await page.getByRole("tab", { name: "Ask" }).click();
  await expect(page.getByRole("tab", { name: "Ask" })).toHaveAttribute("aria-selected", "true");
  await expect(page.getByText("Ask tab (placeholder).")).toBeVisible();

  // Animate UI Sheet, opened by the Button.
  await page.getByRole("button", { name: "Open sheet" }).click();
  const sheet = page.getByRole("dialog");
  await expect(sheet).toBeVisible();
  await page.getByRole("button", { name: "Close" }).click();
  await expect(sheet).toBeHidden();

  // The self-hosted font really loaded (from our own origin, per the check above).
  const loadedFamilies = await page.evaluate(async () => {
    await document.fonts.ready;
    return [...document.fonts]
      .filter((face) => face.status === "loaded")
      .map((face) => face.family);
  });
  expect(loadedFamilies.some((family) => family.includes("Atkinson Hyperlegible Next"))).toBe(true);

  expect(foreign, "requests to other origins").toEqual([]);
  expect(problems, "console and page errors").toEqual([]);
});
