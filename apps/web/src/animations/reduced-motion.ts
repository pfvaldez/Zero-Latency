// The one place that knows the reduced-motion media query. Phase 4's signature GSAP timeline
// passes REDUCED_MOTION_QUERY to gsap.matchMedia(), so both agree on what "reduced" means.
export const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

/** True when the guest has asked for reduced motion. False where matchMedia does not exist. */
export function reducedMotion(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return false;
  return window.matchMedia(REDUCED_MOTION_QUERY).matches;
}
