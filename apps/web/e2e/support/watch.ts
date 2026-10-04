import type { BrowserContext } from "@playwright/test";

/** Watches every request of the context (the page, its worker and the service worker). */
export function watchRequests(context: BrowserContext, origin: string) {
  let offline = false;
  const foreign: string[] = [];
  const failedOffline: string[] = [];
  context.on("request", (r) => {
    const url = r.url();
    if (url.startsWith("data:") || url.startsWith("blob:")) return;
    if (new URL(url).origin !== origin) foreign.push(url);
  });
  context.on("requestfailed", (r) => {
    if (offline) failedOffline.push(`${r.url()} (${r.failure()?.errorText})`);
  });
  return {
    foreign,
    failedOffline,
    goOffline() {
      offline = true;
    },
  };
}
