import { describe, expect, it } from "vitest";
import { normalize } from "../src/text/normalize.ts";
import { THEME_ORDER, THEMES, themeOf } from "../src/themes/themes.ts";
import { THEME_IDS, type ThemeId, VISITOR_LANGS } from "../src/types.ts";

// Every theme except `other`, in at least two languages (here three, spread across all four).
const CASES: [ThemeId, string, string][] = [
  ["stay", "en", "Can I stay overnight?"],
  ["stay", "de", "Kann man hier übernachten?"],
  ["stay", "nl", "Kan ik hier overnachten?"],
  ["food", "en", "Is lunch included?"],
  ["food", "de", "Gibt es etwas zu essen?"],
  ["food", "sv", "Finns det mat?"],
  ["buy", "en", "Where can I buy coffee?"],
  ["buy", "de", "Wo kann ich Kaffee kaufen?"],
  ["buy", "nl", "Waar kan ik koffie kopen?"],
  ["price", "en", "How much does the tour cost?"],
  ["price", "de", "Was kostet die Tour?"],
  ["price", "sv", "Vad kostar det?"],
  ["path", "en", "Is the trail steep?"],
  ["path", "de", "Ist der Weg steil?"],
  ["path", "sv", "Är stigen brant?"],
  ["kids", "en", "Can children join?"],
  ["kids", "de", "Dürfen Kinder mit?"],
  ["kids", "nl", "Mogen kinderen mee?"],
  ["roast", "en", "How is the coffee roasted?"],
  ["roast", "de", "Wie wird der Kaffee geröstet?"],
  ["roast", "nl", "Wanneer wordt de koffie geroosterd?"],
  ["picking", "en", "When do you pick the cherries?"],
  ["picking", "de", "Wann ist die Ernte?"],
  ["picking", "sv", "När plockar ni?"],
  ["story", "en", "What is the history of the farm?"],
  ["story", "de", "Wie ist die Geschichte der Farm?"],
  ["story", "nl", "Wat is het verhaal van de boerderij?"],
  ["view", "en", "Is there a nice view?"],
  ["view", "de", "Gibt es eine schöne Aussicht?"],
  ["view", "sv", "Finns det någon utsikt?"],
  ["welcome", "en", "Hello and welcome"],
  ["welcome", "de", "Hallo, willkommen"],
  ["welcome", "sv", "Välkommen!"],
  ["taste", "en", "What does it taste like?"],
  ["taste", "de", "Wie schmeckt der Kaffee?"],
  ["taste", "nl", "Hoe smaakt het?"],
  ["length", "en", "How long is the tour?"],
  ["length", "de", "Wie lange dauert die Tour?"],
  ["length", "nl", "Hoe lang duurt de tour?"],
  ["wifi", "en", "Is there WiFi here?"],
  ["wifi", "de", "Gibt es WLAN?"],
  ["wifi", "sv", "Finns det wifi?"],
  ["transport", "en", "Is there parking?"],
  ["transport", "de", "Gibt es einen Parkplatz?"],
  ["transport", "sv", "Finns det parkering?"],
];

describe("themeOf: each theme in several languages", () => {
  it.each(CASES)("%s [%s] %s", (theme, _lang, text) => {
    expect(themeOf(text)).toBe(theme);
  });

  it("covers every theme except other in at least two languages", () => {
    for (const id of THEME_IDS.filter((t) => t !== "other")) {
      const langs = new Set(CASES.filter(([t]) => t === id).map(([, lang]) => lang));
      expect(langs.size, id).toBeGreaterThanOrEqual(2);
    }
  });
});

describe("themeOf: edge cases", () => {
  it("returns other for gibberish, empty text and unrelated words", () => {
    expect(themeOf("asdf qwerty")).toBe("other");
    expect(themeOf("")).toBe("other");
    expect(themeOf("Do you have a dog?")).toBe("other");
  });

  it("breaks ties by taxonomy order", () => {
    expect(themeOf("Can I stay overnight and buy coffee?")).toBe("stay");
    expect(themeOf("How long is the roasting?")).toBe("roast");
    expect(themeOf("Wie lange dauert das Rösten?")).toBe("roast");
    expect(themeOf("Hoe lang duurt het roosteren?")).toBe("roast");
  });

  it("ignores case and accents", () => {
    expect(themeOf("UBERNACHTEN?")).toBe("stay");
    expect(themeOf("kann man hier ubernachten")).toBe("stay");
  });

  it("matches whole words only", () => {
    expect(themeOf("Is there a bedroom?")).toBe("other");
    expect(themeOf("Is there a bed?")).toBe("stay");
  });

  it("matches in any language whatever the guest chose", () => {
    expect(themeOf("Where can I kaufen coffee?")).toBe("buy");
  });
});

describe("theme taxonomy", () => {
  it("lists THEME_IDS in order, with other last", () => {
    expect(THEME_ORDER).toEqual([...THEME_IDS]);
    expect(THEME_ORDER.at(-1)).toBe("other");
  });

  it("has hints in every language for every theme but other", () => {
    for (const theme of THEMES) {
      for (const lang of VISITOR_LANGS) {
        if (theme.id === "other") expect(theme.hints[lang]).toEqual([]);
        else expect(theme.hints[lang].length, `${theme.id}/${lang}`).toBeGreaterThan(0);
      }
    }
  });

  it("never maps one hint to two different themes", () => {
    const owner = new Map<string, ThemeId>();
    for (const theme of THEMES) {
      for (const lang of VISITOR_LANGS) {
        for (const hint of theme.hints[lang]) {
          const key = normalize(hint);
          const seen = owner.get(key);
          expect(
            seen === undefined || seen === theme.id,
            `"${hint}" in ${seen} and ${theme.id}`,
          ).toBe(true);
          owner.set(key, theme.id);
        }
      }
    }
  });
});
