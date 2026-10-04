import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "@/app/App.tsx";
import { ServicesProvider } from "@/services/context.tsx";
import { useGuest } from "@/state/guest-store.ts";
import { FakeScanner, fixtureManifest, testServices } from "@/test/fakes.ts";
import { StopList } from "./StopList.tsx";

afterEach(() => {
  cleanup();
  window.history.replaceState(null, "", "/");
});
beforeEach(() => {
  localStorage.clear();
  useGuest.setState({ lang: null, tab: "stops", clipId: null, momentId: null });
});

describe("scanning a stop code", () => {
  const clips = fixtureManifest().clips;
  const mount = (scanner = new FakeScanner(), onOpen = vi.fn()) => {
    render(
      <ServicesProvider services={testServices({ scanner })}>
        <StopList lang="en" clips={clips} onOpen={onOpen} />
      </ServicesProvider>,
    );
    return { scanner, onOpen };
  };

  it("opens the stop for a scanned NOOR-STOP-n code or a /stop/n link, and stops the camera", async () => {
    const { scanner, onOpen } = mount();
    fireEvent.click(screen.getByRole("button", { name: "Scan a stop code" }));
    await waitFor(() => expect(scanner.onCode).not.toBeNull());
    scanner.onCode?.("NOOR-STOP-3");
    await waitFor(() => expect(onOpen).toHaveBeenCalledWith(expect.objectContaining({ id: 3 })));
    await waitFor(() => expect(scanner.stopped).toBeGreaterThan(0));
  });

  it("accepts a link", async () => {
    const { scanner, onOpen } = mount();
    fireEvent.click(screen.getByRole("button", { name: "Scan a stop code" }));
    await waitFor(() => expect(scanner.onCode).not.toBeNull());
    scanner.onCode?.("https://asknoor.example/stop/2");
    await waitFor(() => expect(onOpen).toHaveBeenCalledWith(expect.objectContaining({ id: 2 })));
  });

  it("ignores a QR code that is not a stop, and says so for a stop this pack does not have", async () => {
    const { scanner, onOpen } = mount();
    fireEvent.click(screen.getByRole("button", { name: "Scan a stop code" }));
    await waitFor(() => expect(scanner.onCode).not.toBeNull());
    scanner.onCode?.("https://example.com/promo");
    scanner.onCode?.("WIFI:S:guesthouse;P:secret;;");
    expect(onOpen).not.toHaveBeenCalled();
    scanner.onCode?.("NOOR-STOP-9");
    expect(
      await screen.findByText("We could not find that stop. Check the number and try again."),
    ).toBeInTheDocument();
    expect(onOpen).not.toHaveBeenCalled();
  });

  it("when the camera is refused, says so and the number field still works", async () => {
    const scanner = new FakeScanner();
    scanner.deny = true;
    const { onOpen } = mount(scanner);
    fireEvent.click(screen.getByRole("button", { name: "Scan a stop code" }));
    expect(
      await screen.findByText("The camera is not available. Enter the stop number instead."),
    ).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Stop number"), { target: { value: "2" } });
    fireEvent.click(screen.getByRole("button", { name: "Open stop" }));
    expect(onOpen).toHaveBeenCalledWith(expect.objectContaining({ id: 2 }));
  });

  it("stops the camera when the guest closes the scanner", async () => {
    const { scanner } = mount();
    fireEvent.click(screen.getByRole("button", { name: "Scan a stop code" }));
    await waitFor(() => expect(scanner.started).toBe(1));
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(scanner.stopped).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: "Scan a stop code" })).toBeInTheDocument();
  });
});

describe("stop links (/stop/n)", () => {
  async function openLink(path: string, lang: "en" | "de" = "en") {
    useGuest.setState({ lang });
    window.history.replaceState(null, "", path);
    const services = testServices();
    await services.repo.download(() => {});
    render(
      <ServicesProvider services={services}>
        <App />
      </ServicesProvider>,
    );
  }

  it("opens that stop's player once the pack is saved, and returns the address bar to /", async () => {
    await openLink("/stop/2");
    expect(await screen.findByRole("heading", { name: "Noor's story" })).toBeInTheDocument();
    expect(await screen.findByText(/red coffee cherries/)).toBeInTheDocument();
    expect(window.location.pathname).toBe("/");
  });

  it("for a stop the pack does not have, shows the stop list with the not-found line", async () => {
    await openLink("/stop/9");
    expect(await screen.findByRole("heading", { name: "Tour stops" })).toBeInTheDocument();
    expect(
      await screen.findByText("We could not find that stop. Check the number and try again."),
    ).toBeInTheDocument();
    expect(window.location.pathname).toBe("/");
  });

  it("waits for the language: a guest with no language picks one first, then lands on the stop", async () => {
    window.history.replaceState(null, "", "/stop/1");
    const services = testServices();
    await services.repo.download(() => {});
    render(
      <ServicesProvider services={services}>
        <App />
      </ServicesProvider>,
    );
    expect(
      await screen.findByRole("heading", { name: "Choose your language" }),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Deutsch" }));
    expect(await screen.findByText(/Willkommen auf der Fixture-Farm/)).toBeInTheDocument();
  });

  it("does nothing special for the normal address", async () => {
    await openLink("/");
    expect(await screen.findByRole("heading", { name: "Tour stops" })).toBeInTheDocument();
    expect(
      screen.queryByText("We could not find that stop. Check the number and try again."),
    ).not.toBeInTheDocument();
  });
});
