import { type FarmPackManifest, t } from "@asknoor/core";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GuestTour } from "@/app/GuestTour.tsx";
import { ServicesProvider } from "@/services/context.tsx";
import { useGuest } from "@/state/guest-store.ts";
import { fixtureManifest, MemoryOutbox, testServices } from "@/test/fakes.ts";
import { MonthScreen } from "./MonthScreen.tsx";
import { Player } from "./Player.tsx";
import { Shop } from "./Shop.tsx";

afterEach(cleanup);
beforeEach(() => {
  localStorage.clear();
  useGuest.setState({ lang: "en", tab: "stops", clipId: null, momentId: null });
});

const noor = () => {
  const m = fixtureManifest().noorText;
  if (!m) throw new Error("the fixture has no noorText");
  return m;
};
const FARM = "00000000-0000-4000-8000-0000000000f1";

describe("the Wolof order line on Noor's order sheet", () => {
  async function openSheet(manifest: FarmPackManifest) {
    render(
      <ServicesProvider services={testServices({ outbox: new MemoryOutbox() })}>
        <Shop lang="en" manifest={manifest} />
      </ServicesProvider>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Quantity +" }));
    fireEvent.click(screen.getByRole("button", { name: "Quantity +" }));
    fireEvent.click(screen.getByRole("button", { name: "Order" }));
    await screen.findByText("Show this to Noor");
  }

  it("in demo mode shows the order in Wolof, labeled as a draft not yet checked by a Wolof speaker", async () => {
    await openSheet(fixtureManifest());
    expect(screen.getByText("For Noor, in Wolof")).toBeInTheDocument();
    expect(
      screen.getByText(/Jëfandikukat: 2 item, total \? GMD\. Noor xamal na ko\./),
    ).toBeInTheDocument();
    expect(screen.getByText("Draft, not yet checked by a Wolof speaker")).toBeInTheDocument();
  });

  it("is hidden in a production pack, even if the pack object held the text", async () => {
    await openSheet({ ...fixtureManifest(), mode: "production" });
    expect(screen.queryByText("For Noor, in Wolof")).not.toBeInTheDocument();
    expect(screen.queryByText(/Jëfandikukat/)).not.toBeInTheDocument();
  });

  it("is absent when the pack has no Wolof text", async () => {
    const { noorText: _removed, ...rest } = fixtureManifest();
    await openSheet(rest);
    expect(screen.queryByText("For Noor, in Wolof")).not.toBeInTheDocument();
  });
});

describe("Hear Noor in Wolof (AI-dubbed)", () => {
  const withDub = (): FarmPackManifest => {
    const m = fixtureManifest();
    const clip = m.clips[1];
    if (!clip) throw new Error("no clip");
    clip.dubbed = {
      lang: "wo",
      audio: "audio/clip03.m4a", // a stand-in file for the test: the fixture has no dubbed audio
      durationMs: 6000,
      subtitles: "subtitles/clip03.en.vtt",
      subtitlesDraft: true,
      label: "AI-dubbed (ElevenLabs)",
    };
    m.labels.aiDubbed = ["audio/clip03.m4a"];
    return m;
  };

  async function mountPlayer(manifest: FarmPackManifest, momentId?: string) {
    const services = testServices();
    await services.repo.download(() => {});
    const blob = vi.spyOn(services.repo, "blobUrl");
    const clip = manifest.clips[1];
    if (!clip) throw new Error("no clip");
    render(
      <ServicesProvider services={services}>
        <Player
          lang="en"
          manifest={manifest}
          clip={clip}
          moment={manifest.moments.find((x) => x.id === momentId)}
          onClose={() => {}}
        />
      </ServicesProvider>,
    );
    return blob;
  }

  it("in demo mode offers the dub, switches to the dubbed file, and labels it AI-dubbed, a draft and not Noor's own voice", async () => {
    const blob = await mountPlayer(withDub());
    await waitFor(() => expect(blob).toHaveBeenCalledWith("audio/clip02.m4a"));
    fireEvent.click(await screen.findByRole("button", { name: "Hear Noor in Wolof (AI-dubbed)" }));
    await waitFor(() => expect(blob).toHaveBeenCalledWith("audio/clip03.m4a"));
    expect((await screen.findAllByText("AI-dubbed")).length).toBeGreaterThan(0);
    expect(screen.getByText("Draft, not yet checked by a Wolof speaker")).toBeInTheDocument();
    expect(screen.getByText(t("en", "player.dubNote"))).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Hear the original recording" }));
    await screen.findByRole("button", { name: "Hear Noor in Wolof (AI-dubbed)" });
    expect(screen.queryByText(t("en", "player.dubNote"))).not.toBeInTheDocument();
  });

  it("is hidden in a production pack, and for a confirmed moment (the dub's timing differs)", async () => {
    await mountPlayer({ ...withDub(), mode: "production" });
    await screen.findByRole("heading", { name: "Noor's own recording" });
    expect(screen.queryByRole("button", { name: /Wolof/ })).not.toBeInTheDocument();
    cleanup();
    await mountPlayer(withDub(), "c2-m1");
    await screen.findByRole("heading", { name: "Noor's own recording" });
    expect(screen.queryByRole("button", { name: /Wolof/ })).not.toBeInTheDocument();
  });

  it("is not offered for a clip with no dub", async () => {
    await mountPlayer(fixtureManifest());
    await screen.findByRole("heading", { name: "Noor's own recording" });
    expect(screen.queryByRole("button", { name: /Wolof/ })).not.toBeInTheDocument();
  });
});

describe("Noor's month (demo only)", () => {
  const seed = async (outbox: MemoryOutbox) => {
    const base = { farmId: FARM, lang: "en" as const, createdAt: "2026-10-04T00:00:00.000Z" };
    await outbox.add({
      ...base,
      type: "question",
      id: "00000000-0000-4000-8000-000000000001",
      text: "Can we stay overnight?",
      deviceTheme: "stay",
    });
    await outbox.add({
      ...base,
      type: "question",
      id: "00000000-0000-4000-8000-000000000002",
      text: "Is there a room to sleep over?",
      deviceTheme: "stay",
    });
    await outbox.add({
      ...base,
      type: "feedback",
      id: "00000000-0000-4000-8000-000000000003",
      loved: "the roasting",
      change: "more shade",
    });
    await outbox.add({
      type: "order",
      id: "00000000-0000-4000-8000-000000000004",
      farmId: FARM,
      items: [{ productId: "beans-250", qty: 2 }],
      total: 0,
      currency: "GMD",
      confirmedByNoor: true,
      createdAt: base.createdAt,
    });
  };

  it("counts this phone's outbox and shows the Wolof text on a phone mock-up, with the demo note and the draft label, and an English preview", async () => {
    const outbox = new MemoryOutbox();
    await seed(outbox);
    render(
      <ServicesProvider services={testServices({ outbox })}>
        <MonthScreen lang="en" manifest={fixtureManifest()} />
      </ServicesProvider>,
    );
    expect(
      await screen.findByText(
        "Demo: one phone stands in for a month of synced visits. Sending is not built yet.",
      ),
    ).toBeInTheDocument();
    const phone = screen.getByRole("region", { name: "Noor's phone (mock-up)" });
    expect(phone).toHaveTextContent("Draft, not yet checked by a Wolof speaker");
    expect(phone).toHaveTextContent("Ci weer bii: 1 ay doxandéem");
    expect(phone).toHaveTextContent(noor().themeLabels.stay.wo);
    expect(screen.getByText("English preview of the same text")).toBeInTheDocument();
    expect(screen.getByText(/This month: 1 guests/)).toBeInTheDocument();
  });

  it("says so when the phone holds no visits yet", async () => {
    render(
      <ServicesProvider services={testServices()}>
        <MonthScreen lang="en" manifest={fixtureManifest()} />
      </ServicesProvider>,
    );
    expect(await screen.findByText(/No visits are saved on this phone yet/)).toBeInTheDocument();
    expect(
      screen.queryByRole("region", { name: "Noor's phone (mock-up)" }),
    ).not.toBeInTheDocument();
  });

  it("makes no network request", async () => {
    const outbox = new MemoryOutbox();
    await seed(outbox);
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    render(
      <ServicesProvider services={testServices({ outbox })}>
        <MonthScreen lang="en" manifest={fixtureManifest()} />
      </ServicesProvider>,
    );
    await screen.findByRole("region", { name: "Noor's phone (mock-up)" });
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  it("is a tab only in a demo pack that has the Wolof texts", async () => {
    const mountTour = (manifest: FarmPackManifest) =>
      render(
        <ServicesProvider services={testServices()}>
          <GuestTour lang="en" manifest={manifest} />
        </ServicesProvider>,
      );
    mountTour(fixtureManifest());
    expect(screen.getByRole("button", { name: "Noor's month" })).toBeInTheDocument();
    cleanup();
    mountTour({ ...fixtureManifest(), mode: "production" });
    expect(screen.queryByRole("button", { name: "Noor's month" })).not.toBeInTheDocument();
    cleanup();
    const { noorText: _removed, ...rest } = fixtureManifest();
    mountTour(rest);
    expect(screen.queryByRole("button", { name: "Noor's month" })).not.toBeInTheDocument();
  });

  it("shows nothing at all in a production pack, even if rendered directly", () => {
    render(
      <ServicesProvider services={testServices()}>
        <MonthScreen lang="en" manifest={{ ...fixtureManifest(), mode: "production" }} />
      </ServicesProvider>,
    );
    expect(screen.queryByText(/Demo: one phone/)).not.toBeInTheDocument();
  });
});
