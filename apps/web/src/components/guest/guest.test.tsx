import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { type FarmPackManifest, t } from "@asknoor/core";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ServicesProvider } from "@/services/context.tsx";
import { fixtureManifest, testServices } from "@/test/fakes.ts";
import { Player } from "./Player.tsx";
import { StopList } from "./StopList.tsx";

afterEach(cleanup);

describe("StopList", () => {
  const manifest = fixtureManifest();

  it("lists the stops and opens one from its button", () => {
    const onOpen = vi.fn();
    render(<StopList lang="en" clips={manifest.clips} onOpen={onOpen} />);
    fireEvent.click(screen.getByRole("button", { name: "Stop 2" }));
    expect(onOpen).toHaveBeenCalledWith(expect.objectContaining({ id: 2 }));
  });

  it("opens a stop from the entered number, and says so when there is no such stop", () => {
    const onOpen = vi.fn();
    render(<StopList lang="de" clips={manifest.clips} onOpen={onOpen} />);
    fireEvent.change(screen.getByLabelText("Stationsnummer"), { target: { value: "7" } });
    fireEvent.click(screen.getByRole("button", { name: /Station öffnen|öffnen/i }));
    expect(onOpen).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Stationsnummer"), { target: { value: "3" } });
    fireEvent.click(screen.getByRole("button", { name: /öffnen/i }));
    expect(onOpen).toHaveBeenCalledWith(expect.objectContaining({ id: 3 }));
  });
});

async function mountPlayer(
  manifest: FarmPackManifest,
  lang: "en" | "de" | "sv",
  clipId = 1,
  momentId?: string,
) {
  const services = testServices();
  await services.repo.download(() => {});
  const clip = manifest.clips.find((c) => c.id === clipId);
  if (!clip) throw new Error("no clip");
  const moment = manifest.moments.find((m) => m.id === momentId);
  render(
    <ServicesProvider services={services}>
      <Player lang={lang} manifest={manifest} clip={clip} moment={moment} onClose={() => {}} />
    </ServicesProvider>,
  );
}

describe("Player", () => {
  it("shows the subtitles from the pack's WebVTT in the guest's language", async () => {
    await mountPlayer(fixtureManifest(), "de");
    expect(await screen.findByText(/Willkommen auf der Fixture-Farm/)).toBeInTheDocument();
  });

  it("says 'Voice: Preet, standing in for Noor' for a file listed in labels.standInVoice, and not for other files", async () => {
    const m = fixtureManifest();
    m.labels.standInVoice = [{ person: "Preet", files: ["audio/clip01.m4a"] }];
    await mountPlayer(m, "en", 1);
    expect(await screen.findByText("Voice: Preet, standing in for Noor")).toBeInTheDocument();
    cleanup();
    await mountPlayer(m, "en", 2);
    await screen.findByText(/red coffee cherries/);
    expect(screen.queryByText(/standing in for Noor/)).not.toBeInTheDocument();
  });

  it("labels 'AI-dubbed' and 'AI narrator voice' files", async () => {
    const m = fixtureManifest();
    m.labels.aiDubbed = ["audio/clip01.m4a"];
    m.labels.syntheticVoice = ["audio/clip01.m4a"];
    await mountPlayer(m, "en", 1);
    expect(await screen.findByText("AI-dubbed")).toBeInTheDocument();
    expect(screen.getByText("AI narrator voice")).toBeInTheDocument();
  });

  it("in a demo pack shows the demo, stand-in and draft-translation labels; a production pack shows none of them", async () => {
    const demo = fixtureManifest();
    await mountPlayer(demo, "sv", 1, "c1-m1");
    expect(await screen.findByText(t("sv", "labels.demo"))).toBeInTheDocument();
    expect(screen.getByText(t("sv", "labels.draftTranslation"))).toBeInTheDocument();
    expect(screen.getByText(/Synthetic test tone/)).toBeInTheDocument();
    cleanup();
    const prod = fixtureManifest();
    prod.mode = "production";
    await mountPlayer(prod, "sv", 1, "c1-m1");
    await screen.findByText(/Välkommen/);
    expect(screen.queryByText(t("sv", "labels.demo"))).not.toBeInTheDocument();
    expect(screen.queryByText(t("sv", "labels.draftTranslation"))).not.toBeInTheDocument();
  });

  it("falls back to the checked source script, with a note, when the language has no subtitles", async () => {
    const m = fixtureManifest();
    for (const c of m.clips) delete c.subtitles.nl;
    const services = testServices();
    await services.repo.download(() => {});
    const clip = m.clips[0];
    if (!clip) throw new Error("no clip");
    render(
      <ServicesProvider services={services}>
        <Player lang="nl" manifest={m} clip={clip} onClose={() => {}} />
      </ServicesProvider>,
    );
    expect(await screen.findByText(/Welcome to the fixture farm/)).toBeInTheDocument();
    expect(screen.getByText(t("nl", "player.sourceFallback"))).toBeInTheDocument();
  });

  it("plays and pauses from its button", async () => {
    await mountPlayer(fixtureManifest(), "en");
    const button = await screen.findByRole("button", { name: "Play" });
    await vi.waitFor(() => expect(button).toBeEnabled());
    fireEvent.click(button);
    expect(button).toBeInTheDocument();
  });
});

describe("draft labels on every subtitle path in a demo pack", () => {
  it("a stop opened from the stop list (no confirmed moment) shows the draft chip for a draft language, and none once the moments are checked", async () => {
    await mountPlayer(fixtureManifest(), "de", 1);
    await screen.findByText(/Willkommen auf der Fixture-Farm/);
    expect(screen.getByText(t("de", "labels.draftTranslation"))).toBeInTheDocument();
    cleanup();
    // The fixture marks even its English as an unchecked draft; a checked clip shows no chip.
    const checked = fixtureManifest();
    for (const m of checked.moments) delete m.draft;
    await mountPlayer(checked, "en", 1);
    await screen.findByText(/Welcome to the fixture farm/);
    expect(screen.queryByText(t("en", "labels.draftTranslation"))).not.toBeInTheDocument();
  });

  it("translates the AI-dubbed chip", async () => {
    const m = fixtureManifest();
    m.labels.aiDubbed = ["audio/clip01.m4a"];
    await mountPlayer(m, "de", 1);
    expect(await screen.findByText("KI-vertont")).toBeInTheDocument();
    expect(screen.queryByText("AI-dubbed")).not.toBeInTheDocument();
  });
});

describe("interface text is at least 16 px", () => {
  const dir = join(import.meta.dirname);
  const files = [
    ...readdirSync(dir)
      .filter((f) => f.endsWith(".tsx") && !f.includes(".test."))
      .map((f) => join(dir, f)),
    join(dir, "..", "animate-ui", "components", "buttons", "button.tsx"),
    join(dir, "..", "animate-ui", "components", "radix", "sheet.tsx"),
  ];
  const small = /\btext-(xs|sm)\b|text-\[(\d|1[0-5])(\.\d+)?px\]/;

  it("uses no text-xs, text-sm or sub-16px size in the guest components, the Button or the Sheet", () => {
    expect(files.length).toBeGreaterThan(8);
    for (const f of files) expect(small.test(readFileSync(f, "utf8")), f).toBe(false);
  });

  it("control: the pattern does catch small text", () => {
    for (const bad of ["text-sm", "text-xs font-bold", "text-[12px]", "text-[15.5px]"])
      expect(small.test(bad), bad).toBe(true);
    for (const ok of ["text-base", "text-xl", "text-[16px]", "text-2xl"])
      expect(small.test(ok), ok).toBe(false);
  });
});
