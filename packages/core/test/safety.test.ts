import { describe, expect, it } from "vitest";
import { decideSafety, SAFETY_LEXICON } from "../src/guardrails/safety.ts";
import { VISITOR_LANGS } from "../src/types.ts";

const MUST_TRIGGER: [string, string][] = [
  ["en", "Someone is hurt"],
  ["en", "My friend is injured"],
  ["en", "I need a doctor"],
  ["en", "Call an ambulance"],
  ["en", "Emergency!"],
  ["en", "I feel very sick"],
  ["en", "I'm lost"],
  ["en", "Is there a hospital nearby?"],
  ["en", "I was bitten by a snake"],
  ["en", "I am allergic to nuts"],
  ["en", "I am pregnant, is the walk safe?"],
  ["en", "I can't breathe"],
  ["de", "Ich brauche einen Arzt"],
  ["de", "Hilfe, ein Notfall"],
  ["de", "Mein Freund ist verletzt"],
  ["de", "Ich bin allergisch"],
  ["de", "Wo ist das Krankenhaus?"],
  ["de", "Ich habe mich verlaufen"],
  ["nl", "Mijn vriend is gewond"],
  ["nl", "Ik heb een dokter nodig"],
  ["nl", "Bel een ambulance"],
  ["nl", "Ik ben verdwaald"],
  ["nl", "Noodgeval"],
  ["sv", "Jag är vilse"],
  ["sv", "Jag behöver en läkare"],
  ["sv", "Min kompis är skadad"],
  ["sv", "Ring en ambulans"],
  ["sv", "Jag är allergisk"],
];

const MUST_NOT_TRIGGER: [string, string][] = [
  ["en", "Can you help me buy coffee?"],
  ["en", "How long is the roasting?"],
  ["en", "Can I stay overnight?"],
  ["en", "Is the coffee strong?"],
  ["en", "Do you sell beans?"],
  ["en", "Do you roast over a fire?"],
  ["en", "Is there a faint chocolate aroma?"],
  ["de", "Wo kann ich Kaffee kaufen?"],
  ["de", "Kannst du mir beim Kaffee helfen?"],
  ["nl", "Hoe lang duurt het roosteren?"],
  ["sv", "Kan jag köpa kaffe?"],
];

describe("decideSafety: must trigger", () => {
  it.each(MUST_TRIGGER)("[%s] %s", (_lang, text) => {
    expect(decideSafety(text)).toBe(true);
  });
});

// Inflected and plural forms: whole-word matching misses them unless they are listed.
describe("decideSafety: inflected forms must trigger", () => {
  it.each([
    "my son hurts his leg",
    "she bleeds",
    "there are snakes?",
    "is it poisonous",
    "I feel dizzy",
    "I think I broke my arm",
    "my husband collapsed",
    "is the water safe to drink",
    "the hut is on fire",
    "Kopfschmerzen",
    "Er ist kollabiert",
    "Hij heeft hoofdpijn",
    "Het doet pijn",
    "Hon är yr",
    "Han drunknade",
  ])("%s", (text) => {
    expect(decideSafety(text)).toBe(true);
  });
});

describe("decideSafety: ordinary tour questions must not trigger", () => {
  it.each(MUST_NOT_TRIGGER)("[%s] %s", (_lang, text) => {
    expect(decideSafety(text)).toBe(false);
  });
});

describe("decideSafety: input handling", () => {
  it("ignores case and punctuation", () => {
    expect(decideSafety("SOMEONE IS HURT!!!")).toBe(true);
    expect(decideSafety("ich brauche einen ARZT")).toBe(true);
  });

  it("matches accent-free typing", () => {
    expect(decideSafety("Jag ar vilse")).toBe(true);
    expect(decideSafety("Ich habe mich verlaufen")).toBe(true);
    expect(decideSafety("Wo ist die Apotheke, es ist gefahrlich")).toBe(true);
  });

  it("matches whole words only", () => {
    expect(decideSafety("She wrote a doctoral thesis on coffee")).toBe(false);
    expect(decideSafety("The hurtle of the cart")).toBe(false);
    expect(decideSafety("Ill-advised? No, illustrated")).toBe(true); // "ill" is its own word here
    expect(decideSafety("An illustrated guide")).toBe(false);
  });

  it("matches explicit German compounds", () => {
    expect(decideSafety("Wir brauchen einen Notarzt")).toBe(true);
    expect(decideSafety("Ruf den Krankenwagen")).toBe(true);
  });

  it("matches multi-word entries", () => {
    expect(decideSafety("He may have a heart attack")).toBe(true);
    expect(decideSafety("Ik ben de weg kwijt")).toBe(true);
    expect(decideSafety("heart of the farm")).toBe(false);
  });

  it("is false for empty text", () => {
    expect(decideSafety("")).toBe(false);
    expect(decideSafety("   ")).toBe(false);
  });
});

describe("safety lexicon", () => {
  it("has at least 10 entries per language", () => {
    for (const lang of VISITOR_LANGS) {
      expect(SAFETY_LEXICON[lang].length).toBeGreaterThanOrEqual(10);
    }
  });

  it("triggers on every entry inside a sentence", () => {
    for (const lang of VISITOR_LANGS) {
      for (const entry of SAFETY_LEXICON[lang]) {
        expect(decideSafety(`please, ${entry} now?`), `${lang}: ${entry}`).toBe(true);
      }
    }
  });

  it("leaves out the words that are common in tour questions", () => {
    for (const banned of ["help", "hilfe", "hulp", "hjalp", "fire", "burn", "faint", "bite"]) {
      for (const lang of VISITOR_LANGS) {
        expect(SAFETY_LEXICON[lang]).not.toContain(banned);
      }
    }
  });
});
