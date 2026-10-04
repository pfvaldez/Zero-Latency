// Imports the index-only phrasings that an isolated writer produced (it saw only the clip scripts,
// never the test questions), audits them against the test questions, removes exact repeats (it
// never rewrites them) and writes content/<farm>/index-passages.json.

import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import {
  type IndexPassagesFile,
  IndexPassagesFileSchema,
  type LeakageReport,
  leakageAudit,
} from "@asknoor/core";
import { contentDir, loadQuestions } from "./load-content.ts";

type Raw = Record<string, Record<"en" | "de" | "nl" | "sv", string[]>>;

export const WRITER =
  "an isolated Claude subagent that was given only the clip scripts and topics in its prompt and read no repository file (its transcript shows no access to the test questions)";

export async function importIndexPassages(
  farm: string,
  rawPath: string,
): Promise<{ file: IndexPassagesFile; audit: LeakageReport }> {
  const raw = JSON.parse(await readFile(rawPath, "utf8")) as Raw;
  const questions = (await loadQuestions(farm)).map((q) => ({
    id: q.id,
    lang: q.lang,
    question: q.question,
  }));
  const flat = Object.entries(raw).flatMap(([clip, byLang]) =>
    Object.entries(byLang).flatMap(([lang, texts]) => texts.map((text) => ({ clip, lang, text }))),
  );
  const before = leakageAudit(flat, questions);
  const dropKey = (c: string, l: string, t: string) => `${c}|${l}|${t}`;
  const drop = new Set(before.exact.map((e) => dropKey(e.clip, e.lang, e.text)));

  const clips: IndexPassagesFile["clips"] = {};
  for (const [clip, byLang] of Object.entries(raw)) {
    const kept = (lang: "en" | "de" | "nl" | "sv") =>
      byLang[lang].filter((t) => !drop.has(dropKey(clip, lang, t)));
    clips[clip] = { en: kept("en"), de: kept("de"), nl: kept("nl"), sv: kept("sv") };
  }
  const file = IndexPassagesFileSchema.parse({
    note: "Short question-style phrasings per clip, written without looking at the test questions and NEVER shown to a guest or to Noor. They only help the matcher find the clip; the guest still confirms every match. Unchecked machine text: draft, labeled indexOnly in the manifest.",
    writer: WRITER,
    draft: true,
    neverShown: true,
    removedAsDuplicates: before.exact,
    clips,
  });
  const after = leakageAudit(
    Object.entries(file.clips).flatMap(([clip, byLang]) =>
      Object.entries(byLang).flatMap(([lang, texts]) =>
        texts.map((text) => ({ clip, lang, text })),
      ),
    ),
    questions,
  );
  await writeFile(
    join(contentDir(farm), "index-passages.json"),
    `${JSON.stringify(file, null, 2)}\n`,
  );
  return { file, audit: after };
}
