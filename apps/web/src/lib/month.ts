// "Noor's month": a DEMO-only view that turns this phone's outbox into the counts and the
// monthly text Noor would get. One phone stands in for a month of synced visits. Nothing here
// touches the network, and nothing is sent.
//
// fillTemplate only accepts checked theme labels (non-negotiable 2). The labels of a demo pack are
// machine drafts, so `draftLabels` marks them checked FOR THIS DEMO SCREEN ONLY and refuses to run
// for any pack that is not a demo pack. The real send path keeps the guard.

import {
  type FarmPackManifest,
  type FilledTemplate,
  fillTemplate,
  type NoorText,
  type OutboxItem,
  type TemplateLabels,
  THEME_ORDER,
  type ThemeId,
  themeOf,
} from "@asknoor/core";

export interface MonthSummary {
  guests: number;
  orders: number;
  items: number;
  asked: { theme: ThemeId; count: number } | null;
  loved: ThemeId | null;
  wished: ThemeId | null;
  /** False when the outbox holds no question, feedback or order. */
  hasData: boolean;
}

/** The most frequent theme of some texts; `other` only if nothing else was found. Ties go to the earlier theme. */
function topTheme(texts: readonly string[]): { theme: ThemeId; count: number } | null {
  const counts = new Map<ThemeId, number>();
  for (const text of texts) {
    const theme = themeOf(text);
    counts.set(theme, (counts.get(theme) ?? 0) + 1);
  }
  let best: { theme: ThemeId; count: number } | null = null;
  for (const theme of THEME_ORDER) {
    const count = counts.get(theme) ?? 0;
    if (count === 0) continue;
    if (theme === "other" && best) continue;
    if (!best || (best.theme === "other" && theme !== "other") || count > best.count) {
      best = { theme, count };
    }
  }
  return best;
}

export function summarize(outbox: readonly OutboxItem[]): MonthSummary {
  const questions = outbox.flatMap((i) => (i.type === "question" ? [i.text] : []));
  const feedback = outbox.flatMap((i) => (i.type === "feedback" ? [i] : []));
  const orders = outbox.flatMap((i) => (i.type === "order" ? [i] : []));
  return {
    guests: feedback.length,
    orders: orders.length,
    items: orders.reduce((n, o) => n + o.items.reduce((m, l) => m + l.qty, 0), 0),
    asked: topTheme(questions),
    loved: topTheme(feedback.flatMap((f) => (f.loved ? [f.loved] : [])))?.theme ?? null,
    wished: topTheme(feedback.flatMap((f) => (f.change ? [f.change] : [])))?.theme ?? null,
    hasData: outbox.length > 0,
  };
}

function draftLabels(
  manifest: FarmPackManifest,
  noor: NoorText,
  summary: MonthSummary,
  lang: "wo" | "en",
): TemplateLabels {
  if (manifest.mode !== "demo") throw new Error("Noor's month is a demo-only screen");
  const label = (theme: ThemeId | null) => ({
    text: theme ? noor.themeLabels[theme][lang] : "-",
    checked: true, // demo screen only: see the note at the top of this file
  });
  return {
    loved: label(summary.loved),
    asked: label(summary.asked?.theme ?? null),
    wished: label(summary.wished),
  };
}

export function monthlyText(
  manifest: FarmPackManifest,
  noor: NoorText,
  summary: MonthSummary,
  lang: "wo" | "en",
): FilledTemplate {
  return fillTemplate(
    noor.monthly[lang],
    {
      guests: summary.guests,
      orders: summary.orders,
      items: summary.items,
      askedCount: summary.asked?.count ?? 0,
    },
    draftLabels(manifest, noor, summary, lang),
  );
}

/** The order line for Noor, with the order's numbers filled in (a total of null shows as a question mark). */
export function orderLine(
  noor: NoorText,
  lang: "wo" | "en",
  order: { items: number; total: number | null; currency: string },
): string {
  const values: Record<string, string> = {
    items: String(order.items),
    total: order.total === null ? "?" : String(order.total),
    currency: order.currency,
  };
  return noor.orderLine[lang].replace(/\{(\w+)\}/g, (_m, name: string) => {
    const v = values[name];
    if (v === undefined) throw new Error(`Unknown placeholder {${name}} in the order line`);
    return v;
  });
}
