import type { OutboxItem } from "@asknoor/core";
import { describe, expect, it } from "vitest";
import { fixtureManifest } from "@/test/fakes.ts";
import { monthlyText, orderLine, summarize } from "./month.ts";

const FARM = "00000000-0000-4000-8000-0000000000f1";
const T = "2026-10-04T00:00:00.000Z";
let n = 0;
const id = () => `00000000-0000-4000-8000-${String(++n).padStart(12, "0")}`;
const question = (text: string): OutboxItem => ({
  type: "question",
  id: id(),
  farmId: FARM,
  lang: "en",
  text,
  deviceTheme: "other",
  createdAt: T,
});
const feedback = (loved: string, change: string): OutboxItem => ({
  type: "feedback",
  id: id(),
  farmId: FARM,
  lang: "en",
  loved,
  change,
  createdAt: T,
});
const order = (qtys: number[]): OutboxItem => ({
  type: "order",
  id: id(),
  farmId: FARM,
  items: qtys.map((qty, i) => ({ productId: `p${i}`, qty })),
  total: 10,
  currency: "GMD",
  confirmedByNoor: true,
  createdAt: T,
});

const outbox: OutboxItem[] = [
  question("Can we stay overnight in a room?"),
  question("Is there a place to sleep at night?"),
  question("How do you roast the coffee beans?"),
  feedback("The roasting demo was great", "More shade on the walk"),
  feedback("Loved the roasting", "Rooms to stay overnight"),
  order([2, 1]),
];

describe("summarize", () => {
  it("counts guests (feedback), confirmed orders and items, and the most common theme of each kind", () => {
    const s = summarize(outbox);
    expect(s).toMatchObject({ guests: 2, orders: 1, items: 3, hasData: true });
    expect(s.asked).toEqual({ theme: "stay", count: 2 });
    expect(s.loved).toBe("roast");
    expect(s.wished).not.toBeNull();
  });
  it("says there is no data for an empty outbox, and has no top themes", () => {
    expect(summarize([])).toMatchObject({
      hasData: false,
      asked: null,
      loved: null,
      wished: null,
      guests: 0,
    });
  });
});

describe("the monthly text for the demo screen", () => {
  const manifest = fixtureManifest();
  const noor = manifest.noorText;
  if (!noor) throw new Error("the fixture has no noorText");

  it("is filled by fillTemplate with the counts and the theme labels, in Wolof and in English", () => {
    const s = summarize(outbox);
    const wo = monthlyText(manifest, noor, s, "wo");
    const en = monthlyText(manifest, noor, s, "en");
    expect(wo.body).toContain(noor.themeLabels.stay.wo);
    expect(en.body).toContain(noor.themeLabels.stay.en);
    expect(en.body).toContain("2 guests");
    expect(wo.segments).toBeLessThanOrEqual(2);
    expect(en.dropped).toEqual([]);
  });

  it("refuses to run for a pack that is not a demo pack (the checked-label guard stays for the real send path)", () => {
    const production = { ...manifest, mode: "production" as const };
    expect(() => monthlyText(production, noor, summarize(outbox), "wo")).toThrow(/demo-only/);
  });
});

describe("orderLine", () => {
  const noor = fixtureManifest().noorText;
  if (!noor) throw new Error("the fixture has no noorText");
  it("fills the items, the total and the currency, and shows ? for a total that is not known", () => {
    expect(orderLine(noor, "en", { items: 3, total: 450, currency: "GMD" })).toBe(
      "Order: 3 items, total 450 GMD. Noor confirms payment.",
    );
    expect(orderLine(noor, "wo", { items: 3, total: null, currency: "GMD" })).toContain(
      "total ? GMD",
    );
  });
});
