import { describe, expect, it } from "vitest";
import { normalize } from "../src/text/normalize.ts";

describe("normalize", () => {
  it("turns ß into ss", () => {
    expect(normalize("Straße")).toBe(" strasse ");
  });

  it("strips German umlauts", () => {
    expect(normalize("Über Käse")).toBe(" uber kase ");
  });

  it("strips Swedish letters", () => {
    expect(normalize("Är jag vilse?")).toBe(" ar jag vilse ");
    expect(normalize("Räksmörgås")).toBe(" raksmorgas ");
  });

  it("strips Dutch diacritics", () => {
    expect(normalize("Café, Reünie, Zoë")).toBe(" cafe reunie zoe ");
  });

  it("collapses punctuation and repeated whitespace", () => {
    expect(normalize("a,,  b!!\t\nc")).toBe(" a b c ");
  });

  it("keeps digits", () => {
    expect(normalize("Clip 3")).toBe(" clip 3 ");
  });

  it("returns two spaces for empty and punctuation-only input", () => {
    expect(normalize("")).toBe("  ");
    expect(normalize("?!...")).toBe("  ");
  });

  it("is idempotent", () => {
    const once = normalize("Ich brauche einen ARZT!");
    expect(normalize(once)).toBe(once);
  });

  it("turns capital ẞ into ss", () => {
    expect(normalize("STRAẞE")).toBe(" strasse ");
  });

  it("treats emoji and symbols as separators", () => {
    expect(normalize("coffee ☕ is great 🙂")).toBe(" coffee is great ");
  });

  it("always starts and ends with exactly one space", () => {
    for (const s of ["hello", "  hello  ", "!hello!", "a b"]) {
      const n = normalize(s);
      expect(n.startsWith(" ") && !n.startsWith("  ")).toBe(true);
      expect(n.endsWith(" ") && !n.endsWith("  ")).toBe(true);
    }
  });
});
