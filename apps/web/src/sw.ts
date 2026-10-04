/// <reference lib="webworker" />
// The service worker: precaches the app shell (so the app opens with no signal) and serves the
// farm pack from the cache the download filled. It never fetches anything from another origin.

import {
  cleanupOutdatedCaches,
  createHandlerBoundToURL,
  precacheAndRoute,
} from "workbox-precaching";
import { NavigationRoute, registerRoute } from "workbox-routing";

declare const self: ServiceWorkerGlobalScope;

precacheAndRoute(self.__WB_MANIFEST);
cleanupOutdatedCaches();
registerRoute(new NavigationRoute(createHandlerBoundToURL("/index.html")));

// Pack files (manifest, subtitles, embeddings, model) come from the pack cache saved at download
// time. A download asks for the network on purpose (cache "reload" or "no-store"), so a new pack
// version is never answered with the old one.
self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);
  if (request.method !== "GET" || url.origin !== self.location.origin) return;
  if (!url.pathname.startsWith("/packs/")) return;
  if (request.cache === "reload" || request.cache === "no-store") return;
  event.respondWith(caches.match(request).then((saved) => saved ?? fetch(request)));
});

self.addEventListener("install", () => void self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));
