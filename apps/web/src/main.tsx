import "@fontsource/atkinson-hyperlegible-next/400.css";
import "@fontsource/atkinson-hyperlegible-next/700.css";
import "@fontsource/fraunces/500.css";
import "@fontsource/fraunces/600.css";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import { App } from "./app/App.tsx";
import { ServicesProvider } from "./services/context.tsx";
import { createServices } from "./services/default-services.ts";

const services = createServices();

const root = document.getElementById("root");
if (!root) throw new Error("Missing #root element");

// The offline tour needs the service worker, so it is registered in production builds only. It is a
// classic (not module) worker: the build bundles it into one file with no imports, and older iOS
// Safari cannot register a module service worker at all, which would leave the tour without
// offline navigation (a stop link opened from the Camera app in airplane mode).
if (import.meta.env.PROD && "serviceWorker" in navigator) {
  navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {});
}

createRoot(root).render(
  <StrictMode>
    <ServicesProvider services={services}>
      <App />
    </ServicesProvider>
  </StrictMode>,
);
