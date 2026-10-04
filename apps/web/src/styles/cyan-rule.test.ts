import { describe, expect, it } from "vitest";

// TRD 6.5: in light mode cyan is a fill only. On the page background it is 2.83:1, which fails
// 4.5:1 for text and 3:1 for icons, borders and focus rings. So no source file may use a cyan
// utility for anything but a fill, and none may hard-code the cyan hex outside theme.css.
// This scans every file under src/, including the generated Animate UI components.
const sources = import.meta.glob<string>(
  [
    "/src/**/*.{ts,tsx,css}",
    "!/src/**/*.test.{ts,tsx}",
    "!/src/styles/theme.css", // the one place the cyan hex and its token are defined
  ],
  { query: "?raw", import: "default", eager: true },
);

// text-primary, hover:border-primary/50, ring-wb-cyan, fill-primary ... but not
// text-primary-foreground (navy on a cyan fill) and not bg-primary (the fill itself).
const CYAN_NOT_A_FILL =
  /\b(?:text|border|ring|outline|fill|stroke|decoration|caret|accent)-(?:primary|wb-cyan)(?![\w-])/;
const CYAN_HEX = /#009fda/i;

describe("cyan is a fill only (TRD 6.5)", () => {
  it("scans a real set of files", () => {
    expect(Object.keys(sources).length).toBeGreaterThan(10);
  });

  it("catches cyan text, icons, borders and rings, and allows cyan fills", () => {
    for (const bad of ["text-primary", "hover:border-primary/50", "ring-wb-cyan", "fill-primary"]) {
      expect(CYAN_NOT_A_FILL.test(bad), bad).toBe(true);
    }
    for (const good of ["bg-primary", "text-primary-foreground", "bg-wb-cyan", "border-input"]) {
      expect(CYAN_NOT_A_FILL.test(good), good).toBe(false);
    }
  });

  it("has no cyan text, icon, border or ring utility, and no hard-coded cyan hex", () => {
    const offenders = Object.entries(sources).flatMap(([file, text]) =>
      text
        .split("\n")
        .flatMap((line, index) =>
          CYAN_NOT_A_FILL.test(line) || CYAN_HEX.test(line)
            ? [`${file}:${index + 1}: ${line.trim()}`]
            : [],
        ),
    );
    expect(offenders).toEqual([]);
  });
});
