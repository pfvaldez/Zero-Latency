import { describe, expect, it } from "vitest";
import { smsSize } from "../src/sms/gsm7.ts";
import {
  type CheckedLabel,
  fillTemplate,
  type TemplateCounts,
  type TemplateLabels,
} from "../src/sms/template.ts";

// The English preview from TRD section 7.
const TRD_TEMPLATE =
  "This month: {guests} guests shared feedback. {orders} orders ({items} items). " +
  "Loved: {loved}. Most asked: {asked} ({askedCount}). Most wished for: {wished}.";

const ok = (text: string): CheckedLabel => ({ text, checked: true });
const COUNTS: TemplateCounts = { guests: 7, orders: 3, items: 5, askedCount: 4 };
const LABELS: TemplateLabels = {
  loved: ok("the roasting"),
  asked: ok("staying"),
  wished: ok("a room"),
};

describe("fillTemplate", () => {
  it("fills the TRD preview template", () => {
    const result = fillTemplate(TRD_TEMPLATE, COUNTS, LABELS);
    expect(result.body).toBe(
      "This month: 7 guests shared feedback. 3 orders (5 items). " +
        "Loved: the roasting. Most asked: staying (4). Most wished for: a room.",
    );
    expect(result.encoding).toBe("gsm7");
    expect(result.fitsOneSegment).toBe(true);
  });

  it("throws on an unknown placeholder", () => {
    expect(() => fillTemplate("Hi {name}", COUNTS, LABELS)).toThrow(/Unknown placeholder \{name\}/);
  });

  it("throws when a used label is missing", () => {
    const labels = { loved: ok("x"), asked: ok("y") } as unknown as TemplateLabels;
    expect(() => fillTemplate("{wished}", COUNTS, labels)).toThrow(/wished/);
  });

  it("throws on an unchecked label and names it", () => {
    const labels = { ...LABELS, asked: { text: "staying", checked: false } };
    expect(() => fillTemplate("Asked: {asked}", COUNTS, labels)).toThrow(/\{asked\}.*not checked/);
  });

  it("ignores an unchecked label the template does not use", () => {
    const labels = { ...LABELS, wished: { text: "draft", checked: false } };
    expect(fillTemplate("Loved: {loved}", COUNTS, labels).body).toBe("Loved: the roasting");
  });

  it("throws on unbalanced braces", () => {
    expect(() => fillTemplate("{guests", COUNTS, LABELS)).toThrow(/brace/);
    expect(() => fillTemplate("guests}", COUNTS, LABELS)).toThrow(/brace/);
    expect(() => fillTemplate("{{guests}", COUNTS, LABELS)).toThrow(/brace/);
  });

  it("throws on negative, fractional and NaN counts", () => {
    for (const bad of [-1, 1.5, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(() => fillTemplate("{guests}", { ...COUNTS, guests: bad }, LABELS)).toThrow(/integer/);
    }
  });

  it("accepts zero counts", () => {
    expect(fillTemplate("{orders} orders", { ...COUNTS, orders: 0 }, LABELS).body).toBe("0 orders");
  });

  it("is one segment at 160 GSM-7 characters and two at 161", () => {
    const at160 = fillTemplate("a".repeat(160), COUNTS, LABELS);
    expect(at160).toMatchObject({ length: 160, segments: 1, fitsOneSegment: true });
    const at161 = fillTemplate("a".repeat(161), COUNTS, LABELS);
    expect(at161).toMatchObject({ length: 161, segments: 2, fitsOneSegment: false });
  });

  it("counts extension characters as two", () => {
    const result = fillTemplate(`${"a".repeat(159)}€`, COUNTS, LABELS);
    expect(result).toMatchObject({
      encoding: "gsm7",
      length: 161,
      segments: 2,
      fitsOneSegment: false,
    });
  });

  it("switches to UCS-2 for letters outside GSM-7 (Wolof ë) with 70 and 67 limits", () => {
    const one = fillTemplate(`${"a".repeat(69)}ë`, COUNTS, LABELS);
    expect(one).toMatchObject({ encoding: "ucs2", length: 70, segments: 1, fitsOneSegment: true });
    const two = fillTemplate(`${"a".repeat(70)}ë`, COUNTS, LABELS);
    expect(two).toMatchObject({ encoding: "ucs2", length: 71, segments: 2 });
    expect(smsSize(`${"a".repeat(133)}ë`).segments).toBe(2); // 134 = 2 x 67
    expect(smsSize(`${"a".repeat(134)}ë`).segments).toBe(3); // 135
  });

  it("throws above two segments", () => {
    expect(() => fillTemplate("a".repeat(307), COUNTS, LABELS)).toThrow(/3 SMS segments/);
    expect(fillTemplate("a".repeat(306), COUNTS, LABELS).segments).toBe(2);
  });

  it("inserts a label containing a placeholder literally", () => {
    const labels = { ...LABELS, loved: ok("{guests}") };
    expect(fillTemplate("Loved: {loved}", COUNTS, labels).body).toBe("Loved: {guests}");
  });

  it("fills a repeated placeholder everywhere", () => {
    expect(fillTemplate("{guests} and {guests}", COUNTS, LABELS).body).toBe("7 and 7");
  });

  it("returns a template without placeholders as it is", () => {
    expect(fillTemplate("No news this month.", COUNTS, LABELS).body).toBe("No news this month.");
  });

  it("ignores extra counts the template does not use", () => {
    expect(fillTemplate("{guests}", { ...COUNTS, orders: Number.NaN }, LABELS).body).toBe("7");
  });
});

describe("smsSize: multipart limits are 153 (GSM-7) and 67 (UCS-2), not 160 and 70", () => {
  const gsm = (n: number) => smsSize("a".repeat(n));
  const ucs = (n: number) => smsSize(`${"a".repeat(n - 1)}ë`);

  it("GSM-7: 160 is one part, 161 is two", () => {
    expect(gsm(160).segments).toBe(1);
    expect(gsm(161).segments).toBe(2);
  });

  it("GSM-7: two parts hold 153 x 2 = 306, not 320", () => {
    expect(gsm(306).segments).toBe(2);
    expect(gsm(307).segments).toBe(3);
    expect(gsm(320).segments).toBe(3);
  });

  it("GSM-7: three parts hold 459", () => {
    expect(gsm(459).segments).toBe(3);
    expect(gsm(460).segments).toBe(4);
  });

  it("UCS-2: 70 is one part, 71 is two", () => {
    expect(ucs(70).segments).toBe(1);
    expect(ucs(71).segments).toBe(2);
  });

  it("UCS-2: two parts hold 67 x 2 = 134, not 140", () => {
    expect(ucs(134).segments).toBe(2);
    expect(ucs(135).segments).toBe(3);
    expect(ucs(140).segments).toBe(3);
  });

  it("UCS-2: three parts hold 201", () => {
    expect(ucs(201).segments).toBe(3);
    expect(ucs(202).segments).toBe(4);
  });

  it("never splits a GSM-7 escape pair across parts", () => {
    // 152 + € (2) + 152 = 306 septets: ceil(306 / 153) is 2, but the € cannot straddle the
    // first part, so a third part is needed.
    const text = `${"a".repeat(152)}€${"a".repeat(152)}`;
    expect(smsSize(text)).toMatchObject({ encoding: "gsm7", length: 306, segments: 3 });
  });

  it("never splits an emoji across UCS-2 parts", () => {
    const text = `${"a".repeat(66)}😀${"a".repeat(66)}`;
    expect(smsSize(text)).toMatchObject({ encoding: "ucs2", length: 134, segments: 3 });
  });

  it("fillTemplate throws above two parts using the multipart limits", () => {
    expect(fillTemplate("a".repeat(306), COUNTS, LABELS).segments).toBe(2);
    expect(() => fillTemplate("a".repeat(307), COUNTS, LABELS)).toThrow(/3 SMS segments/);
    expect(() => fillTemplate(`${"a".repeat(134)}ë`, COUNTS, LABELS)).toThrow(/3 SMS segments/);
  });
});

describe("smsSize", () => {
  it("returns zero segments for an empty text", () => {
    expect(smsSize("")).toEqual({ encoding: "gsm7", length: 0, segments: 0 });
  });

  it("treats German and Swedish letters in the basic table as GSM-7", () => {
    expect(smsSize("äöüßñåÄÖÜ").encoding).toBe("gsm7");
  });

  it("treats emoji as UCS-2 and counts UTF-16 code units", () => {
    expect(smsSize("☕")).toEqual({ encoding: "ucs2", length: 1, segments: 1 });
    expect(smsSize("😀").length).toBe(2);
  });
});
