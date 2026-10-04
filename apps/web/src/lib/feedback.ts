import {
  type FarmPackManifest,
  type OutboxItem,
  redact,
  themeOf,
  type VisitorLang,
} from "@asknoor/core";
import type { Outbox } from "@/services/types.ts";

/** Saves what the guest loved and would change. Emails and phone numbers are redacted; blank answers are dropped. */
export async function saveFeedback(
  outbox: Outbox,
  manifest: FarmPackManifest,
  lang: VisitorLang,
  answers: { loved: string; change: string },
): Promise<OutboxItem | null> {
  const loved = redact(answers.loved.trim());
  const change = redact(answers.change.trim());
  if (!loved && !change) return null;
  const item: OutboxItem = {
    type: "feedback",
    id: crypto.randomUUID(),
    farmId: manifest.farmId,
    lang,
    ...(loved ? { loved, lovedTheme: themeOf(loved) } : {}),
    ...(change ? { change, changeTheme: themeOf(change) } : {}),
    createdAt: new Date().toISOString(),
  };
  await outbox.add(item);
  return item;
}
