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

// jsdom's media elements do not play. Tests that need playback spy on these.
Object.defineProperty(HTMLMediaElement.prototype, "play", {
  configurable: true,
  value() {
    return Promise.resolve();
  },
});
Object.defineProperty(HTMLMediaElement.prototype, "pause", { configurable: true, value() {} });
URL.createObjectURL ??= () => "blob:test";
