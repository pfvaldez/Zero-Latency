import { t } from "@asknoor/core";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ServicesProvider } from "@/services/context.tsx";
import { FakeMatcher, fixtureManifest, MemoryOutbox, testServices } from "@/test/fakes.ts";
import { AskPanel } from "./AskPanel.tsx";

afterEach(cleanup);
const manifest = fixtureManifest();

function mount(matcher: FakeMatcher, lang: "en" | "de" = "en", onPlay = vi.fn()) {
  const outbox = new MemoryOutbox();
  render(
    <ServicesProvider services={testServices({ matcher, outbox })}>
      <AskPanel lang={lang} manifest={manifest} onPlay={onPlay} />
    </ServicesProvider>,
  );
  return { outbox, onPlay };
}

async function type(text: string, name = "Ask") {
  const button = await screen.findByRole("button", { name });
  await vi.waitFor(() => expect(button).toBeEnabled());
  fireEvent.change(screen.getByRole("textbox"), { target: { value: text } });
  fireEvent.click(button);
}

describe("AskPanel", () => {
  it("shows the confirm card with the topic; Yes plays that moment and stores nothing", async () => {
    const matcher = new FakeMatcher([{ momentId: "c2-m1", score: 0.95 }]);
    const { outbox, onPlay } = mount(matcher);
    await type("How are cherries picked?");
    expect(
      await screen.findByText(
        "Noor talks about picking the coffee cherries. Is this what you asked?",
      ),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Yes, play it" }));
    expect(onPlay).toHaveBeenCalledWith(expect.objectContaining({ id: "c2-m1", clipId: 2 }));
    expect(matcher.queries).toEqual(["How are cherries picked?"]); // control: an ordinary question does reach the matcher
    expect(outbox.items).toEqual([]);
  });

  it("No saves the question for Noor and says so", async () => {
    const { outbox } = mount(new FakeMatcher([{ momentId: "c2-m1", score: 0.95 }]));
    await type("How are cherries picked?");
    fireEvent.click(await screen.findByRole("button", { name: "No" }));
    expect(
      await screen.findByText("Thank you. We saved your question for Noor."),
    ).toBeInTheDocument();
    expect(outbox.items).toHaveLength(1);
    expect(outbox.items[0]).toMatchObject({ type: "question", text: "How are cherries picked?" });
  });

  it("below the threshold shows 'Not sure, ask a person' and saves the question", async () => {
    const { outbox } = mount(new FakeMatcher([{ momentId: "c2-m1", score: 0.5 }]));
    await type("Do you have a zip line?");
    expect(await screen.findByText("Not sure, ask a person")).toBeInTheDocument();
    expect(outbox.items).toHaveLength(1);
    expect(screen.queryByRole("button", { name: "Yes, play it" })).not.toBeInTheDocument();
  });

  it("a German safety question shows the safety card, never calls the matcher and stores nothing", async () => {
    const matcher = new FakeMatcher([{ momentId: "c1-m1", score: 0.99 }]);
    const { outbox } = mount(matcher, "de");
    await type("Wir brauchen einen Arzt, es ist ein Notfall", "Fragen");
    expect(await screen.findByRole("alert")).toBeInTheDocument();
    expect(matcher.queries).toEqual([]);
    expect(outbox.items).toEqual([]);
  });

  it("shows the match score in a demo pack only", async () => {
    mount(new FakeMatcher([{ momentId: "c2-m1", score: 0.95 }]));
    await type("How are cherries picked?");
    expect(await screen.findByText(/0\.9500/)).toBeInTheDocument();
    cleanup();
    const prod = { ...manifest, mode: "production" as const };
    render(
      <ServicesProvider
        services={testServices({ matcher: new FakeMatcher([{ momentId: "c2-m1", score: 0.95 }]) })}
      >
        <AskPanel lang="en" manifest={prod} onPlay={() => {}} />
      </ServicesProvider>,
    );
    await type("How are cherries picked?");
    await screen.findByText(/Noor talks about/);
    expect(screen.queryByText(/0\.9500/)).not.toBeInTheDocument();
  });

  it("shows the draft label on the confirm card for a draft language in a demo pack", async () => {
    const matcher = new FakeMatcher([{ momentId: "c2-m1", score: 0.95 }]);
    render(
      <ServicesProvider services={testServices({ matcher })}>
        <AskPanel lang="de" manifest={manifest} onPlay={() => {}} />
      </ServicesProvider>,
    );
    await type("Wie werden die Kirschen gepflückt?", "Fragen");
    await screen.findByText(/Noor spricht über|Noor/);
    expect(screen.getAllByText(t("de", "labels.draftTranslation")).length).toBeGreaterThan(0);
  });
});
