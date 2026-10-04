import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath, URL } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, type Plugin } from "vite";
import { VitePWA } from "vite-plugin-pwa";

// The ONNX runtime's WebAssembly files must come from our own origin: Transformers.js would
// otherwise fetch them from a CDN, which the offline tour cannot do. They are copied from the
// installed package into public/ort (gitignored) at the start of every dev server and build.
const ORT_FILES = [
  "ort-wasm-simd-threaded.asyncify.mjs",
  "ort-wasm-simd-threaded.asyncify.wasm",
  "ort-wasm-simd-threaded.mjs",
  "ort-wasm-simd-threaded.wasm",
];

function copyOrt(): Plugin {
  const copy = () => {
    const here = createRequire(import.meta.url);
    const transformers = here.resolve("@huggingface/transformers");
    const ortDist = dirname(createRequire(transformers).resolve("onnxruntime-web"));
    const out = fileURLToPath(new URL("./public/ort", import.meta.url));
    mkdirSync(out, { recursive: true });
    for (const file of ORT_FILES) {
      if (!existsSync(join(out, file))) copyFileSync(join(ortDist, file), join(out, file));
    }
  };
  return { name: "copy-ort-wasm", buildStart: copy, configureServer: copy };
}

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    copyOrt(),
    VitePWA({
      strategies: "injectManifest",
      srcDir: "src",
      filename: "sw.ts",
      injectRegister: false, // main.tsx registers it, in production builds only
      manifest: {
        name: "Ask Noor",
        short_name: "Ask Noor",
        description: "An offline tour of the farm, in Noor's own voice.",
        display: "standalone",
        start_url: "/",
        background_color: "#f3e5d0",
        theme_color: "#3b2314",
        icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" }],
      },
      injectManifest: {
        // The shell and the ONNX runtime. The farm pack is NOT precached: it is downloaded once into
        // its own cache. The bundler also emits a hashed copy of the wasm that we never load.
        globPatterns: ["**/*.{js,css,html,svg,webp,woff,woff2,wasm,mjs,webmanifest}"],
        globIgnores: ["packs/**", "assets/ort-wasm-*"],
        maximumFileSizeToCacheInBytes: 40_000_000,
      },
    }),
  ],
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  worker: { format: "es" },
});
