// Embeddings with Transformers.js and the pinned multilingual-e5-small (int8 ONNX), loaded from
// local files only. e5 expects "passage: " on documents and "query: " on questions, mean pooling,
// normalized vectors. The phone does exactly this in a Web Worker (TRD 6.3).

import { env, pipeline } from "@huggingface/transformers";
import { PACK_MODEL_ID } from "./model.ts";

export const PASSAGE_PREFIX = "passage: ";
export const QUERY_PREFIX = "query: ";
export const DIM = 384;

export interface Embedder {
  /** One normalized 384-dim vector per text; the prefix is added here. */
  embed(
    texts: readonly string[],
    prefix: typeof PASSAGE_PREFIX | typeof QUERY_PREFIX,
  ): Promise<Float32Array[]>;
  dispose(): Promise<void>;
}

/** `modelsRoot` is the folder that holds `<PACK_MODEL_ID>/` (a pack's `model/` folder). */
export async function loadEmbedder(modelsRoot: string): Promise<Embedder> {
  env.allowRemoteModels = false; // never fetch a model from the internet
  env.allowLocalModels = true;
  env.localModelPath = modelsRoot.endsWith("/") ? modelsRoot : `${modelsRoot}/`;
  const extractor = await pipeline("feature-extraction", PACK_MODEL_ID, { dtype: "q8" });
  return {
    async embed(texts, prefix) {
      const out: Float32Array[] = [];
      for (let i = 0; i < texts.length; i += 16) {
        const batch = texts.slice(i, i + 16).map((t) => prefix + t);
        const tensor = await extractor(batch, { pooling: "mean", normalize: true });
        const data = tensor.data as Float32Array;
        for (let r = 0; r < batch.length; r++) out.push(data.slice(r * DIM, (r + 1) * DIM));
      }
      return out;
    },
    dispose: () => extractor.dispose(),
  };
}

export const dot = (a: Float32Array, b: Float32Array): number => {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += (a[i] ?? 0) * (b[i] ?? 0);
  return s;
};
