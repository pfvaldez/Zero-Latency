import { describe, expect, it } from "vitest";
import { FakeMatcher, fixtureManifest, MemoryOutbox } from "@/test/fakes.ts";
import { ask, saveQuestion } from "./ask.ts";

const manifest = fixtureManifest();

describe("ask", () => {
  it("sends a safety question (any visitor language) to the safety card without calling the matcher", async () => {
    for (const q of [
      "Is there a doctor? It is an emergency",
      "Wir brauchen einen Arzt, es ist ein Notfall",
    ]) {
      const matcher = new FakeMatcher([{ momentId: "c1-m1", score: 0.99 }]);
      const { outcome } = await ask(q, matcher, manifest);
      expect(outcome).toEqual({ kind: "safety" });
      expect(matcher.queries).toEqual([]);
    }
  });

  it("control: an ordinary question does reach the matcher", async () => {
    const matcher = new FakeMatcher([{ momentId: "c1-m1", score: 0.99 }]);
    await ask("How do you pick the cherries?", matcher, manifest);
    expect(matcher.queries).toEqual(["How do you pick the cherries?"]);
  });

  it("confirms at or above the pack's threshold and saves below it", async () => {
    const at = manifest.thresholds.match;
    const hit = await ask("q", new FakeMatcher([{ momentId: "c2-m1", score: at }]), manifest);
    expect(hit.outcome).toEqual({ kind: "confirm", momentId: "c2-m1", score: at });
    const miss = await ask(
      "q",
      new FakeMatcher([{ momentId: "c2-m1", score: at - 0.001 }]),
      manifest,
    );
    expect(miss.outcome).toEqual({ kind: "saved", reason: "below-threshold" });
    const none = await ask("q", new FakeMatcher([]), manifest);
    expect(none.outcome.kind).toBe("saved");
  });
});

describe("saveQuestion", () => {
  it("redacts emails and phone numbers, tags a device theme and keeps the farm id", async () => {
    const outbox = new MemoryOutbox();
    const item = await saveQuestion(
      outbox,
      manifest,
      "en",
      "Can I buy coffee? mail me a@b.com or call +220 123 4567",
    );
    expect(item.type).toBe("question");
    if (item.type !== "question") return;
    expect(item.text).not.toContain("a@b.com");
    expect(item.text).not.toMatch(/123 4567/);
    expect(item.farmId).toBe(manifest.farmId);
    expect(item.deviceTheme).toBeTruthy();
    expect(await outbox.count()).toBe(1);
  });
});
