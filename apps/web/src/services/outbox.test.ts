import "fake-indexeddb/auto";
import type { OutboxItem } from "@asknoor/core";
import { describe, expect, it } from "vitest";
import { DexieOutbox } from "./outbox.ts";

const item = (id: string): OutboxItem => ({
  type: "feedback",
  id,
  farmId: "00000000-0000-4000-8000-0000000000f1",
  lang: "en",
  loved: "the coffee",
  createdAt: "2026-10-04T00:00:00.000Z",
});

describe("DexieOutbox", () => {
  it("keeps items until they are marked synced, and counts what is pending", async () => {
    const outbox = new DexieOutbox("test-outbox-1");
    await outbox.add(item("a"));
    await outbox.add(item("b"));
    expect(await outbox.count()).toBe(2);
    await outbox.markSynced(["a"]);
    expect((await outbox.pending()).map((i) => i.id)).toEqual(["b"]);
    expect(await outbox.count()).toBe(1);
  });

  it("survives being opened again (a reload)", async () => {
    await new DexieOutbox("test-outbox-2").add(item("c"));
    expect(await new DexieOutbox("test-outbox-2").count()).toBe(1);
  });
});
