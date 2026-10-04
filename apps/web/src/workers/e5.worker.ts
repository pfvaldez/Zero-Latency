// The matcher, off the main thread (TRD 6.3). It loads the pack's own model files and embedding
// matrix and nothing else: remote models are switched off, and the ONNX runtime's wasm comes from
// /ort on our own origin. It never calls a network service.

import type { MatchResult } from "@asknoor/core";
import { env, pipeline } from "@huggingface/transformers";
import { topMoments } from "@/lib/score.ts";

export type WorkerRequest =
  | {
      type: "init";
      base: string;
      modelDir: string;
      file: string;
      dim: number;
      rows: { momentId: string }[];
    }
  | { type: "match"; id: number; text: string; k: number };

export type WorkerResponse =
  | { type: "ready"; loadMs: number }
  | { type: "error"; id?: number; message: string }
  | { type: "result"; id: number; results: MatchResult[]; ms: number };

type Extractor = (
  texts: string[],
  options: { pooling: "mean"; normalize: true },
) => Promise<{ data: Float32Array }>;

let extractor: Extractor | null = null;
let matrix = new Float32Array(0);
let rows: { momentId: string }[] = [];
let dim = 384;

const post = (message: WorkerResponse) => self.postMessage(message);

async function init(req: Extract<WorkerRequest, { type: "init" }>) {
  const started = performance.now();
  const origin = self.location.origin;
  env.allowRemoteModels = false; // never fetch a model from the internet
  env.allowLocalModels = true;
  // modelDir is "model/multilingual-e5-small": its parent folder is the model root.
  const parent = req.modelDir.split("/").slice(0, -1).join("/");
  const name = req.modelDir.split("/").at(-1) ?? "";
  env.localModelPath = `${origin}${req.base}/${parent}/`;
  const wasm = (env.backends.onnx as { wasm?: Record<string, unknown> }).wasm;
  if (wasm) {
    wasm.numThreads = 1;
    wasm.wasmPaths = {
      mjs: `${origin}/ort/ort-wasm-simd-threaded.asyncify.mjs`,
      wasm: `${origin}/ort/ort-wasm-simd-threaded.asyncify.wasm`,
    };
  }
  const res = await fetch(`${req.base}/${req.file}`);
  if (!res.ok) throw new Error(`embeddings.f32: ${res.status}`);
  matrix = new Float32Array(await res.arrayBuffer());
  rows = req.rows;
  dim = req.dim;
  extractor = (await pipeline("feature-extraction", name, { dtype: "q8" })) as unknown as Extractor;
  await extractor(["query: warm up"], { pooling: "mean", normalize: true });
  post({ type: "ready", loadMs: Math.round(performance.now() - started) });
}

async function match(req: Extract<WorkerRequest, { type: "match" }>) {
  if (!extractor) throw new Error("the matcher is not ready");
  const started = performance.now();
  const out = await extractor([`query: ${req.text}`], { pooling: "mean", normalize: true });
  const results = topMoments(out.data.slice(0, dim), matrix, rows, dim, req.k);
  post({ type: "result", id: req.id, results, ms: Math.round(performance.now() - started) });
}

self.onmessage = (event: MessageEvent<WorkerRequest>) => {
  const req = event.data;
  const task = req.type === "init" ? init(req) : match(req);
  task.catch((e: unknown) =>
    post({
      type: "error",
      ...(req.type === "match" ? { id: req.id } : {}),
      message: e instanceof Error ? e.message : String(e),
    }),
  );
};
