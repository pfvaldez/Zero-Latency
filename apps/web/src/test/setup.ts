import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

// jsdom has no ResizeObserver; Animate UI's Tabs use one to animate their height.
class ResizeObserverStub implements ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}
globalThis.ResizeObserver ??= ResizeObserverStub;

// jsdom does not implement window.scrollTo and logs "Not implemented" when a sheet opens.
window.scrollTo = () => {};

// Globals are off, so Testing Library's automatic cleanup does not register itself.
afterEach(() => {
  cleanup();
});
