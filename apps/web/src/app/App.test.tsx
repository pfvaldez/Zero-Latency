import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ServicesProvider } from "@/services/context.tsx";
import { useGuest } from "@/state/guest-store.ts";
import { testServices } from "@/test/fakes.ts";
import { App } from "./App.tsx";

const mount = (services = testServices()) =>
  render(
    <ServicesProvider services={services}>
      <App />
    </ServicesProvider>,
  );

beforeEach(() => {
  localStorage.clear();
  useGuest.setState({ lang: null, tab: "stops", clipId: null, momentId: null });
});
afterEach(cleanup);

describe("App: language and pack", () => {
  it("asks for the language first, in the four visitor languages", () => {
    mount();
    expect(screen.getByRole("heading", { name: "Choose your language" })).toBeInTheDocument();
    for (const name of ["English", "Deutsch", "Nederlands", "Svenska"])
      expect(screen.getByRole("button", { name })).toBeInTheDocument();
  });

  it("switches the interface to the chosen language and remembers it across a reload", async () => {
    const first = mount();
    fireEvent.click(screen.getByRole("button", { name: "Deutsch" }));
    expect(
      await screen.findByRole("heading", { name: "Farmführung herunterladen" }),
    ).toBeInTheDocument();
    first.unmount();
    // A reload: the store is rebuilt from localStorage.
    await useGuest.persist.rehydrate();
    mount();
    expect(
      await screen.findByRole("heading", { name: "Farmführung herunterladen" }),
    ).toBeInTheDocument();
    expect(screen.queryByText("Choose your language")).not.toBeInTheDocument();
  });

  it("offers the download with its size, shows progress, and then the tour", async () => {
    useGuest.setState({ lang: "en" });
    mount();
    expect(await screen.findByText(/Download size: \d+\.\d MB/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Download" }));
    expect(await screen.findByRole("heading", { name: "Tour stops" })).toBeInTheDocument();
  });

  it("starts straight on the tour when the pack is already saved", async () => {
    useGuest.setState({ lang: "en" });
    const services = testServices();
    await services.repo.download(() => {});
    mount(services);
    expect(await screen.findByRole("heading", { name: "Tour stops" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Download" })).not.toBeInTheDocument();
  });

  it("lets the guest retry after a failed download", async () => {
    useGuest.setState({ lang: "en" });
    const base = testServices();
    let fail = true;
    const repo = Object.create(base.repo) as typeof base.repo;
    repo.download = async (p) => {
      if (fail) throw new Error("offline");
      return base.repo.download(p);
    };
    mount({ ...base, repo });
    fireEvent.click(await screen.findByRole("button", { name: "Download" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("The download did not finish");
    fail = false;
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByRole("heading", { name: "Tour stops" })).toBeInTheDocument();
  });
});
