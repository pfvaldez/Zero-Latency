// Pure colour maths for theme.test.ts: WCAG 2.x contrast, alpha blending, and a reader that
// resolves tokens straight out of theme.css, so the test checks the CSS that ships.

export type Rgb = readonly [number, number, number];
export type Mode = "light" | "dark";
/** One colour in a stack: a theme token (optionally drawn at some opacity) or a literal hex. */
export type Layer = { readonly token: string; readonly alpha?: number } | { readonly hex: string };
export type Tokens = Readonly<Record<Mode, ReadonlyMap<string, string>>>;

function channel(value: number): number {
  const c = value / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

/** WCAG 2.x relative luminance. */
export function luminance([r, g, b]: Rgb): number {
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

/** WCAG 2.x contrast ratio, from 1 to 21. */
export function contrastRatio(a: Rgb, b: Rgb): number {
  const [la, lb] = [luminance(a), luminance(b)];
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

export function parseHex(hex: string): Rgb {
  const match = /^#([0-9a-f]{6})$/i.exec(hex.trim());
  if (!match?.[1]) throw new Error(`Not a #rrggbb colour: "${hex}"`);
  const n = Number.parseInt(match[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** Draws `top` at `alpha` over `bottom` in sRGB space, which is how browsers blend. */
export function over(top: Rgb, bottom: Rgb, alpha: number): Rgb {
  const mix = (a: number, b: number) => a * alpha + b * (1 - alpha);
  return [mix(top[0], bottom[0]), mix(top[1], bottom[1]), mix(top[2], bottom[2])];
}

/** Reads the `:root` and `.dark` blocks of theme.css. Dark mode inherits what it doesn't set. */
export function readTokens(css: string): Tokens {
  const source = css.replace(/\/\*[\s\S]*?\*\//g, "");
  const block = (selector: string): Map<string, string> => {
    const match = new RegExp(`(?:^|\\s)${selector}\\s*\\{([^}]*)\\}`).exec(source);
    if (!match?.[1]) throw new Error(`theme.css has no ${selector} block`);
    const entries = [...match[1].matchAll(/--([\w-]+)\s*:\s*([^;]+);/g)].flatMap((m) =>
      m[1] && m[2] ? [[m[1], m[2].trim()] as const] : [],
    );
    return new Map(entries);
  };
  const light = block(":root");
  return { light, dark: new Map([...light, ...block("\\.dark")]) };
}

export function resolveToken(
  tokens: Tokens,
  mode: Mode,
  name: string,
  seen: readonly string[] = [],
): Rgb {
  if (seen.includes(name)) throw new Error(`Token cycle: ${[...seen, name].join(" -> ")}`);
  const value = tokens[mode].get(name);
  if (value === undefined) throw new Error(`Unknown token --${name} in ${mode} mode`);
  const reference = /^var\(--([\w-]+)\)$/.exec(value);
  return reference?.[1]
    ? resolveToken(tokens, mode, reference[1], [...seen, name])
    : parseHex(value);
}

/** Stacks layers bottom to top into the colour a guest actually sees. */
export function compose(tokens: Tokens, mode: Mode, layers: readonly Layer[]): Rgb {
  let result: Rgb | undefined;
  for (const layer of layers) {
    const color = "token" in layer ? resolveToken(tokens, mode, layer.token) : parseHex(layer.hex);
    const alpha = "token" in layer ? (layer.alpha ?? 1) : 1;
    result = result === undefined || alpha === 1 ? color : over(color, result, alpha);
  }
  if (!result) throw new Error("A colour needs at least one layer");
  return result;
}

export function ratioOf(
  tokens: Tokens,
  mode: Mode,
  fg: readonly Layer[],
  bg: readonly Layer[],
): number {
  return contrastRatio(compose(tokens, mode, fg), compose(tokens, mode, bg));
}
