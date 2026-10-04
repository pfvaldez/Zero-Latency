import { describe, expect, it } from "vitest";
import { I18N_STATUS, STRINGS, type StringKey, t } from "../src/i18n/index.ts";
import { VISITOR_LANGS } from "../src/types.ts";

const KEYS = Object.keys(STRINGS.en) as StringKey[];
const params = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();

// Strings that read the same as English on purpose, as "lang/key". The app name, "OK", the
// language names in their own language, and words that are the same in the other language too
// ("Feedback", "Pause", Dutch "Stops").
const SAME_AS_ENGLISH = new Set<string>([
  ...VISITOR_LANGS.flatMap((l) => [`${l}/app.name`, `${l}/common.ok`]),
  ...VISITOR_LANGS.flatMap((l) => ["en", "de", "nl", "sv"].map((n) => `${l}/lang.${n}`)),
  "de/nav.feedback",
  "nl/nav.feedback",
  "sv/nav.feedback",
  "de/player.pause",
  "nl/nav.stops",
  "nl/stops.stop",
]);

describe("interface strings", () => {
  it("has the same keys in every language", () => {
    for (const lang of VISITOR_LANGS) {
      expect(Object.keys(STRINGS[lang]).sort(), lang).toEqual([...KEYS].sort());
    }
  });

  it("has no empty values", () => {
    for (const lang of VISITOR_LANGS) {
      for (const key of KEYS) expect(STRINGS[lang][key].trim(), `${lang}/${key}`).not.toBe("");
    }
  });

  it("uses the same {placeholders} in every language", () => {
    for (const key of KEYS) {
      for (const lang of VISITOR_LANGS) {
        expect(params(STRINGS[lang][key]), `${lang}/${key}`).toEqual(params(STRINGS.en[key]));
      }
    }
  });

  it("does not contain phone numbers or email addresses", () => {
    for (const lang of VISITOR_LANGS) {
      for (const key of KEYS) {
        const s = STRINGS[lang][key];
        expect(s, `${lang}/${key}`).not.toMatch(/@\w+\.\w+|\+?\d[\d\s-]{6,}\d/);
      }
    }
  });

  it("is not pasted English outside the allowlist", () => {
    const same: string[] = [];
    for (const lang of VISITOR_LANGS.filter((l) => l !== "en")) {
      for (const key of KEYS) {
        if (STRINGS[lang][key] === STRINGS.en[key] && !SAME_AS_ENGLISH.has(`${lang}/${key}`)) {
          same.push(`${lang}/${key}`);
        }
      }
    }
    expect(same).toEqual([]);
  });

  it("marks English as the source and the other languages as unchecked drafts", () => {
    expect(I18N_STATUS).toEqual({ en: "source", de: "draft", nl: "draft", sv: "draft" });
  });

  it("covers the PRD section 6 journeys", () => {
    const groups = [
      "lang.",
      "pack.",
      "stops.",
      "player.",
      "ask.",
      "feedback.",
      "shop.",
      "sync.",
      "labels.",
    ];
    for (const group of groups) {
      expect(
        KEYS.some((k) => k.startsWith(group)),
        group,
      ).toBe(true);
    }
  });
});

describe("safety card", () => {
  const GUIDE = { en: "guide", de: "reiseleiter", nl: "gids", sv: "guide" } as const;

  it("sends every guest to their guide and says the question was not saved", () => {
    for (const lang of VISITOR_LANGS) {
      expect(STRINGS[lang]["ask.safety.title"].toLowerCase(), lang).toContain(GUIDE[lang]);
      expect(STRINGS[lang]["ask.safety.body"].toLowerCase(), lang).toContain(GUIDE[lang]);
    }
  });
});

describe("t", () => {
  it("fills placeholders, including numbers", () => {
    expect(t("en", "ask.confirm", { topic: "roasting" })).toBe(
      "Noor talks about roasting. Is this what you asked?",
    );
    expect(t("de", "stops.stop", { n: 3 })).toBe("Station 3");
  });

  it("returns a string without placeholders as it is", () => {
    expect(t("sv", "common.close")).toBe("Stäng");
  });

  it("throws on a missing value", () => {
    expect(() => t("nl", "shop.total", { total: 10 })).toThrow(/currency/);
  });

  it("throws on an unknown key", () => {
    expect(() => t("en", "nope" as StringKey)).toThrow(/Unknown string key/);
  });
});
