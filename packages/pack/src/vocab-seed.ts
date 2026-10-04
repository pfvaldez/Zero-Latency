// The text of our own content that the vocabulary trim must keep tokens for: scripts, topic labels,
// translations, add-ons, index-only phrasings and interface strings. The test questions are NOT in it
// (content/<farm>/eval/ is never read), so the trim cannot be tuned to the questions it is scored on.

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { STRINGS } from "@asknoor/core";
import { contentDir, loadQuestions } from "./load-content.ts";

const FILES = [
  "clips.json",
  "facts.json",
  "recipe.json",
  "products.json",
  "farm-card.json",
  "sms-templates.json",
  "index-passages.json",
  "translations/clips.json",
  "translations/addons.json",
];
// Bookkeeping strings that are not language: ids, hashes, dates, file names and statuses.
const NOT_TEXT = /^(?:[\w./:#-]+|\d[\d\s.,:-]*)$/;

function strings(value: unknown, out: Set<string>): void {
  if (typeof value === "string") {
    const t = value.trim();
    if (t.length > 2 && !NOT_TEXT.test(t)) out.add(t);
  } else if (Array.isArray(value)) for (const v of value) strings(v, out);
  else if (value && typeof value === "object")
    for (const v of Object.values(value)) strings(v, out);
}

export async function vocabSeed(farm: string): Promise<string[]> {
  const out = new Set<string>();
  for (const f of FILES) {
    try {
      strings(JSON.parse(await readFile(join(contentDir(farm), f), "utf8")), out);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
  }
  for (const lang of Object.values(STRINGS)) strings(lang, out);
  // Never the held-out questions, even if one of them also appears as a phrasing elsewhere.
  const questions = new Set((await loadQuestions(farm)).map((q) => q.question.trim()));
  return [...out].filter((s) => !questions.has(s));
}

export async function writeVocabSeed(farm: string, path: string): Promise<number> {
  const lines = await vocabSeed(farm);
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${lines.join("\n")}\n`);
  return lines.length;
}
