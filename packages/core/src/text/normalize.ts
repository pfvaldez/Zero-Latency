// Normalizes free text for whole-word matching (safety lexicon, theme hints).
// Known limit: letters that NFD does not decompose (æ, ø, ł) are left as they are. Not needed
// for English, German, Dutch or Swedish.

/**
 * Lowercase, `ß` to `ss`, strip diacritics, turn every run of non-alphanumerics into one space,
 * and pad both ends with a space so `" word "` matches whole words only.
 */
export function normalize(text: string): string {
  const words = text
    .toLowerCase()
    .replaceAll("ß", "ss")
    .normalize("NFD")
    .replace(/\p{M}+/gu, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
  return ` ${words} `;
}
