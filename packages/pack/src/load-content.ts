// Reads content/<farm>/ for the evaluation and the pack builder. All validation goes through the
// schemas in @asknoor/core; this file only does the I/O.

import { readFile } from "node:fs/promises";
import { join } from "node:path";
import {
  type ChecksFile,
  ChecksFileSchema,
  ClipsFileSchema,
  parseTestQuestions,
  type SmsTemplatesFile,
  SmsTemplatesFileSchema,
  type TestQuestionRow,
} from "@asknoor/core";
import { REPO_ROOT } from "./model.ts";

export const contentDir = (farm: string) => join(REPO_ROOT, "content", farm);

export type Clips = ReturnType<typeof ClipsFileSchema.parse>;

export interface Transcript {
  clip: number;
  text: string;
  sha256: string;
  words: { text: string; start: number; end: number }[];
}

async function readJson(path: string): Promise<unknown> {
  return JSON.parse(await readFile(path, "utf8"));
}

export async function loadClips(farm: string): Promise<Clips> {
  return ClipsFileSchema.parse(await readJson(join(contentDir(farm), "clips.json")));
}

/** Noor's templates with their Wolof drafts (null if the file is missing). */
export async function loadSmsTemplates(farm: string): Promise<SmsTemplatesFile | null> {
  try {
    return SmsTemplatesFileSchema.parse(
      await readJson(join(contentDir(farm), "sms-templates.json")),
    );
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw e;
  }
}

export async function loadChecks(farm: string): Promise<ChecksFile> {
  return ChecksFileSchema.parse(await readJson(join(contentDir(farm), "checks.json")));
}

export async function loadQuestions(farm: string): Promise<TestQuestionRow[]> {
  return parseTestQuestions(
    await readFile(join(contentDir(farm), "eval", "test-questions.csv"), "utf8"),
  );
}

/** English transcripts by clip number; empty until the transcript step has run. */
export async function loadTranscripts(farm: string): Promise<Map<number, Transcript>> {
  const out = new Map<number, Transcript>();
  for (let n = 1; n <= 99; n++) {
    try {
      const t = (await readJson(
        join(contentDir(farm), "transcripts", "en", `clip${String(n).padStart(2, "0")}.json`),
      )) as Transcript;
      out.set(n, t);
    } catch {
      if (n > 12) break;
    }
  }
  return out;
}
