// Interface strings per visitor language. `Strings` comes from the English source, so a key
// missing from de, nl or sv fails `tsc -b`.

import type { VisitorLang } from "../types.ts";
import { de } from "./de.ts";
import { en } from "./en.ts";
import { nl } from "./nl.ts";
import { sv } from "./sv.ts";

export type StringKey = keyof typeof en;
export type Strings = Record<StringKey, string>;
export type StringParams = Record<string, string | number>;

export const STRINGS: Record<VisitorLang, Strings> = { en, de, nl, sv };

/**
 * en is the source text. de, nl and sv are drafts that no native speaker has checked yet:
 * the guest app labels them in demo mode and a production build must wait for the check.
 */
export const I18N_STATUS: Record<VisitorLang, "source" | "draft"> = {
  en: "source",
  de: "draft",
  nl: "draft",
  sv: "draft",
};

/** Looks up a string and fills its {placeholders}. Throws on an unknown key or a missing value. */
export function t(lang: VisitorLang, key: StringKey, params: StringParams = {}): string {
  const template = STRINGS[lang][key];
  if (template === undefined) throw new Error(`Unknown string key "${key}"`);
  return template.replace(/\{(\w+)\}/g, (_match, name: string) => {
    const value = params[name];
    if (value === undefined) throw new Error(`Missing value {${name}} for "${key}"`);
    return String(value);
  });
}
