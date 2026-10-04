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

export function smsSize(text: string): SmsSize {
  let septets = 0;
  let gsm = true;
  for (const char of text) {
    if (BASIC.includes(char)) septets += 1;
    else if (EXTENSION.includes(char)) septets += 2;
    else {
      gsm = false;
      break;
    }
  }
  const encoding: SmsEncoding = gsm ? "gsm7" : "ucs2";
  const length = gsm ? septets : text.length;
  const { single, multi } = LIMITS[encoding];
  const segments = length === 0 ? 0 : length <= single ? 1 : Math.ceil(length / multi);
  return { encoding, length, segments };
}
