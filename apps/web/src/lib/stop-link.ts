/**
 * The stop number inside what a QR code or a link carries. Accepts a stop code (NOOR-STOP-3), a
 * link (https://any.host/stop/3 or /stop/3) and nothing else, so a QR code for some other site
 * does nothing. The number is only a request: the stop must still exist in the saved pack.
 */
export function parseStopCode(text: string): number | null {
  const value = text.trim();
  const code = /^NOOR-STOP-(\d{1,3})$/i.exec(value);
  if (code) return Number(code[1]);
  try {
    const url = new URL(value, "https://placeholder.invalid");
    const link = /^\/stop\/(\d{1,3})\/?$/.exec(url.pathname);
    if (link) return Number(link[1]);
  } catch {
    // not a link
  }
  return null;
}

/** The path a stop link uses. */
export const stopPath = (n: number) => `/stop/${n}`;
