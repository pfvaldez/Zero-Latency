import { OutboxItemSchema } from "@asknoor/core";
import { describe, expect, it } from "vitest";
import { fixtureManifest, MemoryOutbox } from "@/test/fakes.ts";
import { saveFeedback } from "./feedback.ts";
import { confirmOrder, orderTotal, productsOf } from "./order.ts";

const manifest = fixtureManifest();

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
  it("stores an order only through confirmOrder, as confirmedByNoor, and never an empty one", async () => {
    const outbox = new MemoryOutbox();
    const p = products[0];
    if (!p) throw new Error("no product");
    expect(await confirmOrder(outbox, manifest, {})).toBeNull();
    const item = await confirmOrder(outbox, manifest, { [p.id]: 3 });
    expect(OutboxItemSchema.safeParse(item).success).toBe(true);
    expect(item).toMatchObject({
      type: "order",
      confirmedByNoor: true,
      items: [{ productId: p.id, qty: 3 }],
    });
    expect(outbox.items).toHaveLength(1);
  });
});
