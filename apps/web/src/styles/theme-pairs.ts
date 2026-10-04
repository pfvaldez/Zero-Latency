import type { Layer, Mode } from "./contrast.ts";

// Every foreground and background pair the Phase 0 components rely on, with the ratio recorded
// when the token values were chosen (2026-10-03). theme.test.ts fails if a pair drops below its
// minimum, or if a token change moves a ratio without this table being updated.
//
// A pair lists the modes it applies to: the ones in `ratio`. A layer is a token or a literal hex;
// `t("ring", 0.5)` is the ring token drawn at 50% opacity, stacked bottom to top.

export const TEXT = 4.5; // WCAG 1.4.3: text
export const NON_TEXT = 3; // WCAG 1.4.11: icons, borders and focus rings

const t = (token: string, alpha?: number): Layer =>
  alpha === undefined ? { token } : { token, alpha };
const WHITE: Layer = { hex: "#ffffff" }; // Animate UI hard-codes white text on the destructive button

export type Pair = {
  readonly use: string;
  readonly fg: readonly Layer[];
  readonly bg: readonly Layer[];
  /** The ratio this pair must reach. Absent for FACTS, which are recorded but not required. */
  readonly min?: number;
  readonly ratio: Partial<Record<Mode, number>>;
};

// Text: 4.5:1.
export const TEXT_PAIRS: readonly Pair[] = [
  {
    use: "body text on the page",
    fg: [t("foreground")],
    bg: [t("background")],
    min: TEXT,
    ratio: { light: 15.01, dark: 15.01 },
  },
  {
    use: "text on a card",
    fg: [t("card-foreground")],
    bg: [t("card")],
    min: TEXT,
    ratio: { light: 16, dark: 13.38 },
  },
  {
    use: "text on a popover",
    fg: [t("popover-foreground")],
    bg: [t("popover")],
    min: TEXT,
    ratio: { light: 16, dark: 13.38 },
  },
  {
    use: "primary button text",
    fg: [t("primary-foreground")],
    bg: [t("primary")],
    min: TEXT,
    ratio: { light: 5.31, dark: 5.31 },
  },
  {
    use: "primary button text on hover (fill at 90%)",
    fg: [t("primary-foreground")],
    bg: [t("background"), t("primary", 0.9)],
    min: TEXT,
    ratio: { light: 5.85, dark: 4.58 },
  },
  {
    use: "secondary button text",
    fg: [t("secondary-foreground")],
    bg: [t("secondary")],
    min: TEXT,
    ratio: { light: 12.05, dark: 11.09 },
  },
  {
    use: "secondary button text on hover (fill at 80%)",
    fg: [t("secondary-foreground")],
    bg: [t("background"), t("secondary", 0.8)],
    min: TEXT,
    ratio: { light: 12.61, dark: 11.84 },
  },
  {
    use: "accent text on its fill",
    fg: [t("accent-foreground")],
    bg: [t("accent")],
    min: TEXT,
    ratio: { light: 12.05, dark: 11.09 },
  },
  {
    use: "accent button text on hover (fill at 90%)",
    fg: [t("accent-foreground")],
    bg: [t("background"), t("accent", 0.9)],
    min: TEXT,
    ratio: { light: 12.33, dark: 11.46 },
  },
  {
    use: "destructive button text (Animate UI hard-codes white)",
    fg: [WHITE],
    bg: [t("destructive")],
    min: TEXT,
    ratio: { light: 7.97, dark: 4.75 },
  },
  {
    use: "destructive button text on hover (fill at 90%)",
    fg: [WHITE],
    bg: [t("background"), t("destructive", 0.9)],
    min: TEXT,
    ratio: { light: 6.56, dark: 5.6 },
  },
  {
    use: "destructive button text in dark mode (fill at 60%)",
    fg: [WHITE],
    bg: [t("background"), t("destructive", 0.6)],
    min: TEXT,
    ratio: { dark: 9.23 },
  },
  {
    use: "muted text on the page",
    fg: [t("muted-foreground")],
    bg: [t("background")],
    min: TEXT,
    ratio: { light: 7.11, dark: 9.15 },
  },
  {
    use: "muted text on the tab list",
    fg: [t("muted-foreground")],
    bg: [t("muted")],
    min: TEXT,
    ratio: { light: 5.71, dark: 6.76 },
  },
  {
    use: "ok text on the page",
    fg: [t("ok")],
    bg: [t("background")],
    min: TEXT,
    ratio: { light: 6.7, dark: 5.29 },
  },
  {
    use: "draft text on the page",
    fg: [t("draft")],
    bg: [t("background")],
    min: TEXT,
    ratio: { light: 5.11, dark: 9.11 },
  },
  {
    use: "safety text on the page",
    fg: [t("safety")],
    bg: [t("background")],
    min: TEXT,
    ratio: { light: 7.48, dark: 5.52 },
  },
  {
    use: "ok text on a card",
    fg: [t("ok")],
    bg: [t("card")],
    min: TEXT,
    ratio: { light: 7.15, dark: 4.71 },
  },
  {
    use: "draft text on a card",
    fg: [t("draft")],
    bg: [t("card")],
    min: TEXT,
    ratio: { light: 5.45, dark: 8.12 },
  },
  {
    use: "safety text on a card",
    fg: [t("safety")],
    bg: [t("card")],
    min: TEXT,
    ratio: { light: 7.97, dark: 4.91 },
  },
  {
    use: "outline button text in dark mode (input at 30%)",
    fg: [t("foreground")],
    bg: [t("background"), t("input", 0.3)],
    min: TEXT,
    ratio: { dark: 9.47 },
  },
  {
    use: "outline button text on hover in dark mode (input at 50%)",
    fg: [t("foreground")],
    bg: [t("background"), t("input", 0.5)],
    min: TEXT,
    ratio: { dark: 6.71 },
  },
  {
    use: "active tab text in dark mode (input at 30% over the tab list)",
    fg: [t("foreground")],
    bg: [t("muted"), t("input", 0.3)],
    min: TEXT,
    ratio: { dark: 7.41 },
  },
];

// Icons, borders and focus rings: 3:1.
export const NON_TEXT_PAIRS: readonly Pair[] = [
  {
    use: "interactive border on the page (outline button, tabs)",
    fg: [t("input")],
    bg: [t("background")],
    min: NON_TEXT,
    ratio: { light: 3.87, dark: 4.97 },
  },
  {
    use: "interactive border on a card",
    fg: [t("input")],
    bg: [t("card")],
    min: NON_TEXT,
    ratio: { light: 4.13, dark: 4.42 },
  },
  {
    use: "focus ring drawn at 50% opacity",
    fg: [t("background"), t("ring", 0.5)],
    bg: [t("background")],
    min: NON_TEXT,
    ratio: { light: 3.2, dark: 4.69 },
  },
  {
    use: "invalid-field border (destructive) on the page",
    fg: [t("destructive")],
    bg: [t("background")],
    min: NON_TEXT,
    ratio: { light: 7.48, dark: 3.37 },
  },
  {
    use: "sheet close icon at 70% opacity",
    fg: [t("background"), t("foreground", 0.7)],
    bg: [t("background")],
    min: NON_TEXT,
    ratio: { light: 5.92, dark: 7.91 },
  },
];

// Brand facts behind the cyan rule (TRD 6.5). Recorded so a change to a brand value is noticed,
// not required to reach a minimum: several of them fail on purpose.
export const FACTS: readonly Pair[] = [
  {
    use: "navy on white",
    fg: [t("wb-navy")],
    bg: [WHITE],
    ratio: { light: 16, dark: 16 },
  },
  {
    use: "navy on the page background",
    fg: [t("wb-navy")],
    bg: [t("surface")],
    ratio: { light: 15.01, dark: 15.01 },
  },
  {
    use: "navy text on a cyan fill (primary buttons)",
    fg: [t("wb-navy")],
    bg: [t("wb-cyan")],
    ratio: { light: 5.31, dark: 5.31 },
  },
  {
    use: "cyan on white: fails 4.5 for text",
    fg: [t("wb-cyan")],
    bg: [WHITE],
    ratio: { light: 3.01, dark: 3.01 },
  },
  {
    use: "cyan on the page background: fails 3 for icons and rings, so cyan is a fill only",
    fg: [t("wb-cyan")],
    bg: [t("surface")],
    ratio: { light: 2.83, dark: 2.83 },
  },
  {
    use: "cyan on navy (dark mode)",
    fg: [t("wb-cyan")],
    bg: [t("wb-navy")],
    ratio: { light: 5.31, dark: 5.31 },
  },
  {
    use: "cyan ring at 50% on navy: fails 3, so the dark-mode ring is --surface",
    fg: [t("wb-navy"), t("wb-cyan", 0.5)],
    bg: [t("wb-navy")],
    ratio: { light: 2.35, dark: 2.35 },
  },
  {
    use: "--line on the page background: dividers only",
    fg: [t("line")],
    bg: [t("surface")],
    ratio: { light: 1.25, dark: 1.25 },
  },
];
