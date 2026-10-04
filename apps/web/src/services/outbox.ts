// DexieOutbox: everything a guest says or orders waits here until a sync sends it. Nothing in the
// guest app reaches the network, so this is also where saved questions, feedback and orders live.

import type { OutboxItem } from "@asknoor/core";
import Dexie, { type EntityTable } from "dexie";
import type { Outbox } from "./types.ts";

type Row = { id: string; item: OutboxItem; synced: 0 | 1 };

export class DexieOutbox implements Outbox {
  private readonly db: Dexie & { items: EntityTable<Row, "id"> };

  constructor(name = "asknoor-outbox") {
    this.db = new Dexie(name) as Dexie & { items: EntityTable<Row, "id"> };
    this.db.version(1).stores({ items: "id, synced" });
  }

  async add(item: OutboxItem): Promise<void> {
    await this.db.items.put({ id: item.id, item, synced: 0 });
  }

  async pending(): Promise<OutboxItem[]> {
    return (await this.db.items.where("synced").equals(0).toArray()).map((r) => r.item);
  }

  async markSynced(ids: string[]): Promise<void> {
    await this.db.items.where("id").anyOf(ids).modify({ synced: 1 });
  }

  async count(): Promise<number> {
    return this.db.items.where("synced").equals(0).count();
  }
}
