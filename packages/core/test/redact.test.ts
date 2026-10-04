import { describe, expect, it } from "vitest";
import { REDACTED_EMAIL, REDACTED_PHONE, redact } from "../src/text/redact.ts";

const P = REDACTED_PHONE;
const E = REDACTED_EMAIL;

describe("redact: emails", () => {
  it.each([
    ["write to a@b.co", `write to ${E}`],
    ["john.doe+tour@mail.example.com please", `${E} please`],
    ["JOHN@EXAMPLE.COM", E],
    ["mail a@b.co.", `mail ${E}.`],
    ["two: a@b.co and c@d.org", `two: ${E} and ${E}`],
    ["user123@sub.domain.example", E],
    ["Jürgen@Müller.de", E],
  ])("%s", (input, expected) => {
    expect(redact(input)).toBe(expected);
  });

  it("leaves text with an @ but no address alone", () => {
    expect(redact("meet @ the gate")).toBe("meet @ the gate");
    expect(redact("a@b")).toBe("a@b");
  });
});

describe("redact: Gambian phone numbers", () => {
  it.each([
    "+220 345 6789",
    "+2203456789",
    "+220-7123456",
    "(+220) 345-6789",
    "00220 3456789",
    "+220 7 123 456",
    "345 6789", // 7-digit local
    "3456789",
    "345-6789",
    "712.3456",
  ])("%s", (number) => {
    expect(redact(number)).toBe(P);
    expect(redact(`call me on ${number} tonight`)).toBe(`call me on ${P} tonight`);
  });
});

describe("redact: other international and national formats", () => {
  it.each([
    "+49 170 1234567",
    "+31 6 12345678",
    "+46 70 123 45 67",
    "+44 (0)20 7946 0958",
    "0170 1234567",
    "06-12345678",
    "070-123 45 67",
    "(555) 123-4567",
    "+1 555 123 4567",
    "00 46 70 123 45 67",
  ])("%s", (number) => {
    expect(redact(`WhatsApp ${number}!`)).toBe(`WhatsApp ${P}!`);
  });
});

describe("redact: things that stay", () => {
  it.each([
    "Is there a stop 3?",
    "NOOR-STOP-3",
    "clip c3-m1",
    "I have 2 kids and 4 bags",
    "It costs 500 GMD",
    "in 2026",
    "1234",
    "123456",
    "2026-10-03",
    "We arrive at 10:30",
    "3.5 hours",
    "How long is the roasting?",
    "",
  ])("%s", (text) => {
    expect(redact(text)).toBe(text);
  });
});

describe("redact: mixed and repeated", () => {
  it("redacts an email and a phone in one text", () => {
    expect(redact("a@b.co or +220 345 6789")).toBe(`${E} or ${P}`);
  });

  it("redacts several numbers", () => {
    expect(redact("345 6789 / 712 3456")).toBe(`${P} / ${P}`);
  });

  it("is idempotent", () => {
    const once = redact("a@b.co +220 345 6789");
    expect(redact(once)).toBe(once);
  });

  it("does not let digits inside an email become a phone", () => {
    expect(redact("12345678@mail.com")).toBe(E);
  });

  it("keeps text around a number", () => {
    expect(redact("Call (+220) 345-6789, thanks")).toBe(`Call ${P}, thanks`);
  });
});
