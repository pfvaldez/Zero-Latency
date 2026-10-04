// E5WorkerMatcher: the Matcher the app uses. The model runs in a Web Worker, loaded from the saved pack.

import type { MatchResult } from "@asknoor/core";
import type { WorkerRequest, WorkerResponse } from "@/workers/e5.worker.ts";
import type { Matcher, PackRepository } from "./types.ts";

export class E5WorkerMatcher implements Matcher {
  private worker: Worker | null = null;
  private starting: Promise<void> | null = null;
  private nextId = 1;
  private readonly waiting = new Map<
    number,
    { ok: (r: MatchResult[]) => void; fail: (e: Error) => void }
  >();
  private readonly repo: PackRepository;

  constructor(repo: PackRepository) {
    this.repo = repo;
  }

  ready(): Promise<void> {
    this.starting ??= this.start();
    return this.starting;
  }

  private async start(): Promise<void> {
    const manifest = await this.repo.current();
    if (!manifest) throw new Error("the farm pack is not downloaded");
    const worker = new Worker(new URL("../workers/e5.worker.ts", import.meta.url), {
      type: "module",
    });
    this.worker = worker;
    await new Promise<void>((resolve, reject) => {
      worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
        const msg = event.data;
        if (msg.type === "ready") return resolve();
        if (msg.type === "error" && msg.id === undefined) return reject(new Error(msg.message));
        if (msg.type === "result") this.waiting.get(msg.id)?.ok(msg.results);
        if (msg.type === "error" && msg.id !== undefined)
          this.waiting.get(msg.id)?.fail(new Error(msg.message));
        if (msg.id !== undefined) this.waiting.delete(msg.id);
      };
      worker.onerror = (e) => reject(new Error(e.message));
      const init: WorkerRequest = {
        type: "init",
        base: this.repo.baseUrl(),
        modelDir: manifest.model.dir,
        file: manifest.embeddings.file,
        dim: manifest.embeddings.dim,
        rows: manifest.embeddings.rows.map((r) => ({ momentId: r.momentId })),
      };
      worker.postMessage(init);
    });
  }

  async match(text: string, k = 3): Promise<MatchResult[]> {
    await this.ready();
    const id = this.nextId++;
    return new Promise((ok, fail) => {
      this.waiting.set(id, { ok, fail });
      const req: WorkerRequest = { type: "match", id, text, k };
      this.worker?.postMessage(req);
    });
  }
}
