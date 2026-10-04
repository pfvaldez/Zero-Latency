import { describe, expect, it } from "vitest";
import { parseConsent, requireConfirmed } from "../src/consent.ts";

const HEADER =
  "| Person | What they consented to | Where | Date | Status |\n|---|---|---|---|---|\n";
const row = (
  what = "AI dubbing of her English recordings",
  status = "confirmed",
  person = "Preet Patel",
) => `| ${person} | ${what} | Discord | 2026-10-03 | ${status} |`;
const table = (...rows: string[]) => `# Consent\n\n${HEADER}${rows.join("\n")}\n`;

describe("parseConsent", () => {
  it("reads rows by their header cells and skips the separator", () => {
    const rows = parseConsent(table(row()));
    expect(rows).toEqual([
      {
        person: "Preet Patel",
        what: "AI dubbing of her English recordings",
        where: "Discord",
        date: "2026-10-03",
        status: "confirmed",
      },
    ]);
  });
  it("reads a second table with its own header order", () => {
    const md = `${table(row())}\nNotes\n\n| Person | Where | What they consented to | Date | Status |\n|---|---|---|---|---|\n| Ana | Mail | Publishing | 2026-10-04 | pending |\n`;
    expect(parseConsent(md)[1]).toMatchObject({
      person: "Ana",
      where: "Mail",
      what: "Publishing",
      status: "pending",
    });
  });
  it("drops malformed rows (fails closed)", () => {
    expect(parseConsent(`${HEADER}| a | b | c |\n`)).toEqual([]);
  });
  it("reads the real docs/CONSENT.md shape: three rows for Preet", () => {
    const rows = parseConsent(
      table(
        row(),
        row("Transcription of her English recordings", "pending"),
        row("Publishing: demo app", "pending"),
      ),
    );
    expect(rows.map((r) => r.status)).toEqual(["confirmed", "pending", "pending"]);
  });
});

describe("requireConfirmed (same cases as pipeline/tests/test_consent.py)", () => {
  const ok = (md: string, person = "Preet Patel", scope = "dubbing") =>
    requireConfirmed(parseConsent(md), person, scope);

  it("passes a confirmed row and ignores case in the person", () => {
    ok(table(row()));
    ok(table(row()), "preet patel");
  });
  it("refuses pending, a missing person and a missing scope", () => {
    expect(() => ok(table(row(undefined, "pending")))).toThrow(/pending/);
    expect(() => ok(table(row()), "Someone Else")).toThrow(/no consent row/);
    expect(() => ok(table(row("Appearing in the video")))).toThrow(/no consent row/);
  });
  it("refuses extra words, other cases and an empty status", () => {
    for (const status of ["confirmed (set by the captain)", "Confirmed", "confirmed?", ""]) {
      expect(() => ok(table(row(undefined, status))), status).toThrow();
    }
  });
  it("refuses when any row for the scope is not confirmed", () => {
    expect(() => ok(table(row(), row("AI dubbing into Dutch", "pending")))).toThrow(/pending/);
  });
  it("refuses a row that reads as a refusal or a limit", () => {
    for (const what of [
      "Does not consent to AI dubbing",
      "AI dubbing, except in the video",
      "No AI dubbing",
      "AI dubbing (revoked)",
    ]) {
      expect(() => ok(table(row(what))), what).toThrow(/refusal/);
    }
  });
  it("matches the scope as a whole word", () => {
    expect(() => ok(table(row("Undubbing is not a word")))).toThrow(/no consent row/);
  });
  it("treats publishing and transcription as separate scopes", () => {
    const md = table(row(), row("Publishing: the demo app and video", "confirmed"));
    ok(md, "Preet Patel", "publishing");
    expect(() => ok(md, "Preet Patel", "transcription")).toThrow(/no consent row/);
  });
});
