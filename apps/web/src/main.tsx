import "@fontsource/atkinson-hyperlegible-next/400.css";
import "@fontsource/atkinson-hyperlegible-next/700.css";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import { App } from "./app/App.tsx";
import { ServicesProvider } from "./services/context.tsx";
import { createServices } from "./services/default-services.ts";

const services = createServices();

const root = document.getElementById("root");
if (!root) throw new Error("Missing #root element");

createRoot(root).render(
  <StrictMode>
    <ServicesProvider services={services}>
      <App />
    </ServicesProvider>
  </StrictMode>,
);
