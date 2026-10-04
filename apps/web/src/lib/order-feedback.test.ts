import { OutboxItemSchema } from "@asknoor/core";
import { describe, expect, it } from "vitest";
import { fixtureManifest, MemoryOutbox } from "@/test/fakes.ts";
import { saveFeedback } from "./feedback.ts";
import { confirmOrder, orderTotal, productsOf } from "./order.ts";

const manifest = fixtureManifest();
const DEMO_CODE = "4827"; // the documented PROTOTYPE demo code of the fixture pack (tasks/HANDOFF.md)

describe("saveFeedback", () => {
  it("stores loved and change with themes, redacts contact details, and passes the outbox schema", async () => {
    const outbox = new MemoryOutbox();
    const item = await saveFeedback(outbox, manifest, "en", {
      loved: "The coffee tasting! call 0123 456 789",
      change: "mail me at x@y.org",
    });
    expect(item).not.toBeNull();
    expect(OutboxItemSchema.safeParse(item).success).toBe(true);
    const stored = JSON.stringify(outbox.items);
    expect(stored).not.toContain("x@y.org");
    expect(stored).not.toContain("456 789");
  });
  it("stores nothing for blank answers, and only the part that was filled in", async () => {
    const outbox = new MemoryOutbox();
    expect(await saveFeedback(outbox, manifest, "en", { loved: " ", change: "" })).toBeNull();
    expect(outbox.items).toEqual([]);
    const one = await saveFeedback(outbox, manifest, "en", { loved: "tour", change: "" });
    expect(one).toMatchObject({ loved: "tour" });
    expect(one).not.toHaveProperty("change");
  });
});

describe("orders", () => {
  const products = productsOf(manifest);
  it("totals priced products, and says when a chosen product has no price yet", () => {
    expect(products.length).toBeGreaterThan(0);
    const p = products[0];
    if (!p) throw new Error("no product");
    const unpriced = orderTotal({ [p.id]: 2 }, [{ ...p, price: undefined }]);
    expect(unpriced.complete).toBe(false);
    const priced = orderTotal({ [p.id]: 2 }, [{ ...p, price: 150 }]);
    expect(priced).toMatchObject({ total: 300, complete: true });
    expect(orderTotal({}, products).lines).toEqual([]);
  });
  it("stores an order only with Noor's farm code, as confirmedByNoor, and never an empty one", async () => {
    const outbox = new MemoryOutbox();
    const p = products[0];
    if (!p) throw new Error("no product");
    expect(await confirmOrder(outbox, manifest, {}, DEMO_CODE)).toEqual({
      ok: false,
      reason: "empty",
    });
    const wrong = await confirmOrder(outbox, manifest, { [p.id]: 3 }, "0000");
    expect(wrong).toEqual({ ok: false, reason: "wrong-code" });
    expect(outbox.items).toEqual([]);
    const ok = await confirmOrder(outbox, manifest, { [p.id]: 3 }, DEMO_CODE);
    expect(ok.ok).toBe(true);
    if (!ok.ok) return;
    expect(OutboxItemSchema.safeParse(ok.item).success).toBe(true);
    expect(ok.item).toMatchObject({
      type: "order",
      confirmedByNoor: true,
      items: [{ productId: p.id, qty: 3 }],
    });
    expect(outbox.items).toHaveLength(1);
  });

  it("a pack with no farm code cannot confirm an order at all, even with the right digits", async () => {
    const outbox = new MemoryOutbox();
    const p = products[0];
    if (!p) throw new Error("no product");
    const { farmCode: _removed, ...rest } = manifest;
    const result = await confirmOrder(outbox, rest, { [p.id]: 1 }, DEMO_CODE);
    expect(result).toEqual({ ok: false, reason: "no-code" });
    expect(outbox.items).toEqual([]);
  });

  it("the pack holds a salted hash and the demo code appears nowhere in the manifest", () => {
    expect(manifest.farmCode?.prototype).toBe(true);
    expect(JSON.stringify(manifest)).not.toContain(DEMO_CODE);
  });
});
