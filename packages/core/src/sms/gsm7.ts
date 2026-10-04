// SMS length rules (GSM 03.38). A text made only of GSM-7 characters fits 160 characters in one
// segment (153 per segment when split); anything else is sent as UCS-2: 70 (67 when split).
// Characters in the extension table (€ [ ] { } \ ^ ~ |) cost two.

const BASIC =
  "@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ !\"#¤%&'()*+,-./0123456789:;<=>?¡" +
  "ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà";
const EXTENSION = "^{}\\[~]|€\f";

export type SmsEncoding = "gsm7" | "ucs2";

export interface SmsSize {
  encoding: SmsEncoding;
  /** GSM-7 septets (extension characters count 2) or UTF-16 code units. */
  length: number;
  /** 0 for an empty text. */
  segments: number;
}

const LIMITS = {
  gsm7: { single: 160, multi: 153 },
  ucs2: { single: 70, multi: 67 },
} as const;

/** Parts needed when each character costs `costs[i]` units and a part holds `capacity` units. */
function countParts(costs: readonly number[], capacity: number): number {
  let parts = 0;
  let used = capacity; // forces the first character to open a part
  for (const cost of costs) {
    // A character is never split across parts: an escape pair (€, [) or an emoji's two UTF-16
    // units move together to the next part, so ceil(length / capacity) can undercount.
    if (used + cost > capacity) {
      parts += 1;
      used = 0;
    }
    used += cost;
  }
  return parts;
}

export function smsSize(text: string): SmsSize {
  const chars = [...text];
  const gsmCosts: number[] = [];
  for (const char of chars) {
    if (BASIC.includes(char)) gsmCosts.push(1);
    else if (EXTENSION.includes(char)) gsmCosts.push(2);
    else break;
  }
  const gsm = gsmCosts.length === chars.length;
  const encoding: SmsEncoding = gsm ? "gsm7" : "ucs2";
  const costs = gsm ? gsmCosts : chars.map((char) => char.length); // UTF-16 code units
  const length = costs.reduce((sum, cost) => sum + cost, 0);
  const { single, multi } = LIMITS[encoding];
  // Multipart messages lose room to the concatenation header: 153 (GSM-7) and 67 (UCS-2) per part.
  const segments = length === 0 ? 0 : length <= single ? 1 : countParts(costs, multi);
  return { encoding, length, segments };
}
