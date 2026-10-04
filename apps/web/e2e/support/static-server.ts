// A tiny static server for the built app (dist), so a test can shut it down: a real network
// failure, like airplane mode on a phone. Playwright's own offline switches are not faithful in
// WebKit (they fail navigations before the service worker sees them). Unknown paths get
// index.html, like the deployed host's rewrite for /stop/n.

import { createReadStream, existsSync, statSync } from "node:fs";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { extname, join, normalize } from "node:path";

const TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript",
  ".mjs": "text/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".webmanifest": "application/manifest+json",
  ".wasm": "application/wasm",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".m4a": "audio/mp4",
  ".vtt": "text/vtt",
};

export async function serveDist(
  root: string,
): Promise<{ origin: string; close: () => Promise<void> }> {
  const server: Server = createServer((req, res) => {
    let raw = (req.url ?? "/").split("?")[0] ?? "/";
    try {
      raw = decodeURIComponent(raw);
    } catch {
      raw = "/"; // a malformed escape gets the app shell
    }
    const path = normalize(raw).replace(/^(\.\.[/\\])+/, "");
    let file = join(root, path);
    if (!file.startsWith(root) || !existsSync(file) || statSync(file).isDirectory()) {
      file = join(root, "index.html");
    }
    res.writeHead(200, { "Content-Type": TYPES[extname(file)] ?? "application/octet-stream" });
    createReadStream(file).pipe(res);
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address() as AddressInfo;
  return {
    origin: `http://localhost:${port}`,
    close: () =>
      new Promise((resolve) => {
        server.closeAllConnections();
        server.close(() => resolve());
      }),
  };
}
