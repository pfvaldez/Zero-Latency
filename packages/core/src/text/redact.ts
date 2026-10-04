// Privacy (non-negotiable 7, GR-7): the app never asks for names or contacts, but a guest can
// still type one into a question or a feedback line. `ingest` (Phase 5) runs this on every
// free-text field before anything is stored, so emails and phone numbers never reach the
// database or Noor's text.
//
// Deliberately blunt: any run of 7 or more digits, with spaces, dots, dashes or brackets between
// them, is treated as a phone number. That covers international numbers (+220 345 6789,
// 00220 3456789, +49 170 1234567), national formats (0170 1234567, (555) 123-4567) and Gambian
// 7-digit local numbers (345 6789). A false positive costs one redacted number; a miss leaks one.
//
// Known limits: names, social handles (@name) and numbers spelled out in words are not caught,
// and a digit run split by letters is not joined. Short codes such as "stop 3" and ISO dates
// (2026-10-03) are left alone.

export const REDACTED_EMAIL = "[email]";
export const REDACTED_PHONE = "[phone]";

const EMAIL = /[\p{L}\p{N}._%+-]+@[\p{L}\p{N}-]+(?:\.[\p{L}\p{N}-]+)+/gu;

// A digit run, optionally opened by "+", "(" or "(+", with digits and separators inside, ending on
// a digit. The lookarounds keep it from starting or ending inside a word ("c3-m1").
const DIGIT_RUN = /(?<![\p{L}\p{N}])(?:\(?\+|\()?\d(?:[\d\s().-]*\d)?(?![\p{L}\p{N}])/gu;

const MIN_PHONE_DIGITS = 7;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export function redact(text: string): string {
  return text.replace(EMAIL, REDACTED_EMAIL).replace(DIGIT_RUN, (run) => {
    if (ISO_DATE.test(run)) return run;
    return run.replace(/\D/g, "").length >= MIN_PHONE_DIGITS ? REDACTED_PHONE : run;
  });
}
