import { expect, test } from "@playwright/test";

test("the app renders the language picker and talks only to its own origin", async ({
  page,
  baseURL,
}) => {
  if (!baseURL) throw new Error("baseURL is not configured");
  const origin = new URL(baseURL).origin;

  const problems: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") problems.push(`console error: ${message.text()}`);
  });
  page.on("pageerror", (error) => problems.push(`page error: ${error.message}`));

  const foreign: string[] = [];
  page.on("request", (request) => {
    const url = request.url();
    if (url.startsWith("data:") || url.startsWith("blob:")) return;
    if (new URL(url).origin !== origin) foreign.push(url);
  });

  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Ask Noor" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Choose your language" })).toBeVisible();
  for (const name of ["English", "Deutsch", "Nederlands", "Svenska"]) {
    await expect(page.getByRole("button", { name })).toBeVisible();
  }

  // The self-hosted font really loaded (from our own origin, per the check above).
  const loadedFamilies = await page.evaluate(async () => {
    await document.fonts.ready;
    return [...document.fonts].filter((f) => f.status === "loaded").map((f) => f.family);
  });
  expect(loadedFamilies.some((family) => family.includes("Atkinson Hyperlegible Next"))).toBe(true);

  expect(foreign, "requests to other origins").toEqual([]);
  expect(problems, "console and page errors").toEqual([]);
});
