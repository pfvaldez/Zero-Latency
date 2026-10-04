// Schema for content/<farm>/eval/wolof.json, written by pipeline/asknoor/evidence/run.py: FLORES-200
// chrF for NLLB, MMS word error rate on FLEURS Wolof, and the round trip on the AI-dubbed clips.
// Evaluation evidence only, with every sample size recorded.

import { z } from "zod";

const chrfScore = z.strictObject({
  chrf: z.number().min(0).max(100),
  n: z.number().int().positive(),
  signature: z.string().min(1),
  seconds: z.number().nonnegative(),
});

export const WolofEvidenceSchema = z.strictObject({
  flores: z
    .strictObject({
      split: z.literal("devtest"),
      sentences_in_split: z.number().int().positive(),
      n: z.number().int().positive(),
      seed: z.number().int(),
      sampled: z.boolean(),
      directions: z.record(z.string(), chrfScore),
    })
    .optional(),
  fleurs: z
    .strictObject({
      split: z.string().min(1),
      utterances_in_split: z.number().int().positive(),
      seed: z.number().int(),
      audio_seconds: z.number().nonnegative(),
      decode_seconds: z.number().nonnegative(),
      examples: z.array(
        z.strictObject({ id: z.number(), reference: z.string(), hypothesis: z.string() }),
      ),
      wer: z.number().min(0),
      cer: z.number().min(0),
      n: z.number().int().positive(),
      reference_words: z.number().int().positive(),
    })
    .optional(),
  roundtrip: z
    .strictObject({
      n: z.number().int().nonnegative(),
      pooled_chrf: z.number().min(0).max(100),
      signature: z.string().min(1),
      clips: z.array(
        z.strictObject({
          clip: z.number().int().positive(),
          wolof_transcript: z.string(),
          back_to_english: z.string(),
          script: z.string().min(1),
          chrf: z.number().min(0).max(100),
          seconds_of_audio: z.number().nonnegative(),
        }),
      ),
    })
    .optional(),
  versions: z.record(z.string(), z.unknown()),
});
export type WolofEvidence = z.infer<typeof WolofEvidenceSchema>;
