import { describe, expect, it } from "vitest";
import committedSchema from "../schema/manifest.schema.json" with { type: "json" };
import { FarmPackManifestSchema, manifestJsonSchema, OutboxItemSchema } from "../src/schemas.ts";
import type { FarmPackManifest, OutboxItem } from "../src/types.ts";

const UUID = "3f2504e0-4f89-41d3-9a0c-0305e82c3301";
const FARM_ID = "7c9e6679-7425-40de-944b-e07fc1f90ae7";
const NOW = "2026-10-03T20:15:00Z";

function manifest(overrides: Partial<FarmPackManifest> = {}): FarmPackManifest {
  return {
    packId: "ondera-noor-1",
    farmId: FARM_ID,
    farmSlug: "ondera-noor",
    version: 1,
    mode: "production",
    createdAt: NOW,
    noorLang: "wo",
    visitorLangs: ["en", "de", "nl", "sv"],
    clips: [
      {
        id: 1,
        kind: "stop",
        stopCode: "NOOR-STOP-1",
        audio: "clip1.mp3",
        durationMs: 30000,
        momentIds: ["c1-m1"],
      },
    ],
    moments: [
      {
        id: "c1-m1",
        clipId: 1,
        startMs: 0,
        endMs: 9000,
        subtitles: { en: "Welcome" },
        topic: { en: "welcome" },
      },
    ],
    addons: [{ id: "fact-1", kind: "fact", text: { en: "A fact" }, source: "ICO", checked: true }],
    model: {
      id: "multilingual-e5-small",
      dir: "model",
      dim: 384,
      quantization: "int8",
      vocab: "full",
      sizeBytes: 118_000_000,
    },
    embeddings: { file: "embeddings.bin", count: 1, dim: 384, dtype: "float32" },
    thresholds: { match: 0.8, margin: 0.05 },
    sizes: { "clip1.mp3": 480_000 },
    checksums: { "clip1.mp3": "abc123" },
    labels: { standIn: [], syntheticVoice: [] },
    ...overrides,
  };
}

const question = (): OutboxItem => ({
  type: "question",
  id: UUID,
  farmId: FARM_ID,
  lang: "de",
  text: "Kann man hier übernachten?",
  deviceTheme: "stay",
  createdAt: NOW,
});
const feedback = (): OutboxItem => ({
  type: "feedback",
  id: UUID,
  farmId: FARM_ID,
  lang: "nl",
  loved: "De verhalen",
  change: "Meer schaduw",
  lovedTheme: "story",
  changeTheme: "other",
  createdAt: NOW,
});
const order = (): OutboxItem => ({
  type: "order",
  id: UUID,
  farmId: FARM_ID,
  items: [{ productId: "beans-250", qty: 2 }],
  total: 500,
  currency: "GMD",
  confirmedByNoor: true,
  createdAt: NOW,
});

describe("FarmPackManifestSchema", () => {
  it("accepts a valid production manifest", () => {
    expect(FarmPackManifestSchema.safeParse(manifest()).success).toBe(true);
  });

  it("accepts a valid demo manifest with drafts, an unchecked add-on and a stand-in", () => {
    const demo = manifest({
      mode: "demo",
      moments: [
        {
          id: "c1-m1",
          clipId: 1,
          startMs: 0,
          endMs: 9000,
          subtitles: { de: "Willkommen" },
          topic: { de: "Willkommen" },
          draft: { de: true },
        },
      ],
      addons: [{ id: "r", kind: "recipe", text: { en: "x" }, checked: false }],
      labels: { standIn: ["noorLang: stand-in voice"], syntheticVoice: ["narrator"] },
    });
    expect(FarmPackManifestSchema.safeParse(demo).success).toBe(true);
  });

  it("rejects a production manifest with draft text, an unchecked add-on or a stand-in", () => {
    const withDraft = manifest({
      moments: [
        {
          id: "c1-m1",
          clipId: 1,
          startMs: 0,
          endMs: 9000,
          subtitles: { de: "x" },
          topic: {},
          draft: { de: true },
        },
      ],
    });
    const unchecked = manifest({
      addons: [{ id: "f", kind: "fact", text: {}, source: "s", checked: false }],
    });
    const standIn = manifest({ labels: { standIn: ["x"], syntheticVoice: [] } });
    for (const bad of [withDraft, unchecked, standIn]) {
      expect(FarmPackManifestSchema.safeParse(bad).success).toBe(false);
    }
  });

  it("allows draft: false flags in production", () => {
    const m = manifest({
      moments: [
        {
          id: "c1-m1",
          clipId: 1,
          startMs: 0,
          endMs: 9000,
          subtitles: { de: "x" },
          topic: {},
          draft: { de: false },
        },
      ],
    });
    expect(FarmPackManifestSchema.safeParse(m).success).toBe(true);
  });

  it("requires farmId to be a UUID and farmSlug to be a safe slug", () => {
    const ok = (overrides: object) =>
      FarmPackManifestSchema.safeParse({ ...manifest(), ...overrides }).success;
    expect(ok({})).toBe(true);
    expect(ok({ farmId: "ondera-noor" })).toBe(false); // the slug is not an identifier
    expect(ok({ farmId: "" })).toBe(false);
    for (const slug of [
      "",
      "Ondera-Noor",
      "ondera noor",
      "../etc",
      "a/b",
      "a..b",
      "-a",
      "a-",
      "a--b",
      "a.b",
    ]) {
      expect(ok({ farmSlug: slug }), slug).toBe(false);
    }
    for (const slug of ["ondera-noor", "farm2", "a"])
      expect(ok({ farmSlug: slug }), slug).toBe(true);
    const { farmSlug: _slug, ...withoutSlug } = manifest();
    expect(FarmPackManifestSchema.safeParse(withoutSlug).success).toBe(false);
  });

  it("rejects unknown language, empty visitorLangs, wrong dim, wrong quantization and bad mode", () => {
    const bad = [
      { ...manifest(), noorLang: "fr" },
      { ...manifest(), visitorLangs: [] },
      { ...manifest(), visitorLangs: ["fr"] },
      { ...manifest(), model: { ...manifest().model, dim: 768 } },
      { ...manifest(), model: { ...manifest().model, quantization: "fp16" } },
      { ...manifest(), mode: "staging" },
      { ...manifest(), embeddings: { ...manifest().embeddings, dtype: "int8" } },
    ];
    for (const m of bad) expect(FarmPackManifestSchema.safeParse(m).success).toBe(false);
  });

  it("rejects out-of-range thresholds, a moment that ends before it starts and unknown fields", () => {
    expect(
      FarmPackManifestSchema.safeParse(manifest({ thresholds: { match: 1.5, margin: 0 } })).success,
    ).toBe(false);
    const backwards = manifest({
      moments: [{ id: "m", clipId: 1, startMs: 5, endMs: 5, subtitles: {}, topic: {} }],
    });
    expect(FarmPackManifestSchema.safeParse(backwards).success).toBe(false);
    expect(FarmPackManifestSchema.safeParse({ ...manifest(), extra: 1 }).success).toBe(false);
  });

  it("rejects a subtitle for a language outside the visitor languages enum", () => {
    const m = manifest({
      moments: [
        { id: "m", clipId: 1, startMs: 0, endMs: 5, subtitles: { fr: "x" } as never, topic: {} },
      ],
    });
    expect(FarmPackManifestSchema.safeParse(m).success).toBe(false);
  });
});

describe("OutboxItemSchema", () => {
  it("accepts each variant", () => {
    for (const item of [question(), feedback(), order()]) {
      expect(OutboxItemSchema.safeParse(item).success, item.type).toBe(true);
    }
  });

  it("accepts feedback with only one field", () => {
    const {
      change: _c,
      changeTheme: _t,
      ...rest
    } = feedback() as Extract<OutboxItem, { type: "feedback" }>;
    expect(OutboxItemSchema.safeParse(rest).success).toBe(true);
  });

  it("rejects a farmId that is not a UUID (the slug is not accepted)", () => {
    for (const item of [question(), feedback(), order()]) {
      expect(
        OutboxItemSchema.safeParse({ ...item, farmId: "ondera-noor" }).success,
        item.type,
      ).toBe(false);
    }
  });

  it("rejects an unknown type", () => {
    expect(OutboxItemSchema.safeParse({ ...question(), type: "survey" }).success).toBe(false);
  });

  it("rejects an order Noor has not confirmed", () => {
    expect(OutboxItemSchema.safeParse({ ...order(), confirmedByNoor: false }).success).toBe(false);
    const { confirmedByNoor: _c, ...missing } = order() as Extract<OutboxItem, { type: "order" }>;
    expect(OutboxItemSchema.safeParse(missing).success).toBe(false);
  });

  it("rejects extra fields, so no personal data can ride along", () => {
    for (const item of [question(), feedback(), order()]) {
      expect(OutboxItemSchema.safeParse({ ...item, email: "a@b.co" }).success, item.type).toBe(
        false,
      );
    }
  });

  it("rejects bad quantities, totals and currency", () => {
    const base = order() as Extract<OutboxItem, { type: "order" }>;
    const items = (qty: number) => ({ ...base, items: [{ productId: "p", qty }] });
    for (const bad of [
      items(0),
      items(-1),
      items(1.5),
      { ...base, items: [] },
      { ...base, total: -1 },
      { ...base, currency: "dalasi" },
    ]) {
      expect(OutboxItemSchema.safeParse(bad).success).toBe(false);
    }
  });

  it("rejects an unknown theme or language, a non-UUID id, an empty or oversized question and a bad date", () => {
    const q = question() as Extract<OutboxItem, { type: "question" }>;
    for (const bad of [
      { ...q, deviceTheme: "weather" },
      { ...q, lang: "fr" },
      { ...q, id: "not-a-uuid" },
      { ...q, text: "" },
      { ...q, text: "x".repeat(1001) },
      { ...q, createdAt: "yesterday" },
    ]) {
      expect(OutboxItemSchema.safeParse(bad).success).toBe(false);
    }
  });
});

describe("manifestJsonSchema", () => {
  it("equals the committed schema/manifest.schema.json (run `bun run --cwd packages/core export:schema`)", () => {
    expect(manifestJsonSchema()).toEqual(committedSchema);
  });

  it("marks the contract fields as required and closes the objects", () => {
    const schema = manifestJsonSchema() as {
      required: string[];
      additionalProperties: boolean;
      properties: { model: { required: string[] }; thresholds: { required: string[] } };
    };
    expect(schema.required).toEqual(
      expect.arrayContaining(["mode", "thresholds", "model", "embeddings", "labels"]),
    );
    expect(schema.properties.model.required).toContain("dim");
    expect(schema.properties.thresholds.required).toEqual(["match", "margin"]);
    expect(schema.additionalProperties).toBe(false);
  });
});
