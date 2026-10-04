import { describe, expect, it } from "vitest";
import { type Mode, ratioOf, readTokens } from "./contrast.ts";
import themeCss from "./theme.css?raw";
import { FACTS, NON_TEXT_PAIRS, type Pair, TEXT_PAIRS } from "./theme-pairs.ts";

const tokens = readTokens(themeCss);
const round2 = (n: number) => Math.round(n * 100) / 100;
const modesOf = (pair: Pair) => Object.keys(pair.ratio) as Mode[];
const measure = (pair: Pair, mode: Mode) => round2(ratioOf(tokens, mode, pair.fg, pair.bg));

describe("theme contrast (TRD 6.5, WCAG 2.x)", () => {
  describe.each([...TEXT_PAIRS, ...NON_TEXT_PAIRS])("$use", (pair) => {
    for (const mode of modesOf(pair)) {
      it(`${mode} mode: reaches ${pair.min}:1 and matches its recorded ratio`, () => {
        const measured = measure(pair, mode);
        expect(measured, `${pair.use} (${mode}) is below its minimum`).toBeGreaterThanOrEqual(
          pair.min ?? 0,
        );
        expect(
          measured,
          `"${pair.use}" (${mode}) moved; if the token change is intended, update theme-pairs.ts`,
        ).toBe(pair.ratio[mode]);
      });
    }
  });

  describe("brand facts behind the cyan rule", () => {
    for (const fact of FACTS) {
      for (const mode of modesOf(fact)) {
        it(`${mode} mode: ${fact.use}`, () => {
          expect(measure(fact, mode)).toBe(fact.ratio[mode]);
        });
      }
    }
  });
});

// Values the theme calls official come from the World Bank Group Branding and Visual Identity
// Guidelines (Feb 2016): p.18 for the primary colours, p.19 for the secondary ones. If one of
// these changes, the comment in theme.css that calls it official has to change with it.
describe("official World Bank values stay official", () => {
  const OFFICIAL: ReadonlyArray<readonly [Mode, string, string]> = [
    ["light", "wb-navy", "#002244"],
    ["light", "wb-cyan", "#009fda"],
    ["light", "ok", "#006450"], // PMS 336 C, muted dark green
    ["light", "safety", "#98252b"], // PMS 7622 C, muted dark red
    ["light", "destructive", "#98252b"],
    ["dark", "ok", "#00ab51"], // PMS 7481 C, green
    ["dark", "draft", "#fdb714"], // PMS 7549 C, amber
  ];
  it.each(OFFICIAL)("%s mode: --%s is %s", (mode, name, hex) => {
    expect(tokens[mode].get(name)).toBe(hex);
  });
});
