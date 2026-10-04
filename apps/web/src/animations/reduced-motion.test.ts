import gsap from "gsap";
import { afterEach, describe, expect, it, vi } from "vitest";
import { REDUCED_MOTION_QUERY, reducedMotion } from "./reduced-motion.ts";

function stubMatchMedia(matches: boolean) {
  const matchMedia = vi.fn((query: string) => ({ matches, media: query }) as MediaQueryList);
  vi.stubGlobal("matchMedia", matchMedia);
  return matchMedia;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("reducedMotion", () => {
  it("is true when the guest prefers reduced motion", () => {
    const matchMedia = stubMatchMedia(true);
    expect(reducedMotion()).toBe(true);
    expect(matchMedia).toHaveBeenCalledWith(REDUCED_MOTION_QUERY);
  });

  it("is false when the guest has no preference", () => {
    stubMatchMedia(false);
    expect(reducedMotion()).toBe(false);
  });

  it("is false where matchMedia is unavailable", () => {
    vi.stubGlobal("matchMedia", undefined);
    expect(reducedMotion()).toBe(false);
  });
});

describe("gsap", () => {
  it("is installed and exposes matchMedia, which Phase 4 uses with the same query", () => {
    expect(typeof gsap.matchMedia).toBe("function");
  });
});
