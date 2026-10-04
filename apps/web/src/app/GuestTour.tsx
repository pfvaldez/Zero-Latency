import { type FarmPackManifest, t, type VisitorLang } from "@asknoor/core";
import { Button } from "@/components/animate-ui/components/buttons/button";
import { AskPanel } from "@/components/guest/AskPanel.tsx";
import { FeedbackForm } from "@/components/guest/FeedbackForm.tsx";
import { Player } from "@/components/guest/Player.tsx";
import { Shop } from "@/components/guest/Shop.tsx";
import { StopList } from "@/components/guest/StopList.tsx";
import { type Tab, useGuest } from "@/state/guest-store.ts";

const TABS: { id: Tab; key: "nav.stops" | "nav.ask" | "nav.shop" | "nav.feedback" }[] = [
  { id: "stops", key: "nav.stops" },
  { id: "ask", key: "nav.ask" },
  { id: "shop", key: "nav.shop" },
  { id: "feedback", key: "nav.feedback" },
];

/** The tour once the pack is saved: stops and player, ask. Feedback and shop follow. */
export function GuestTour({ lang, manifest }: { lang: VisitorLang; manifest: FarmPackManifest }) {
  const { tab, setTab, clipId, momentId, openClip, closeClip } = useGuest();
  const clip = manifest.clips.find((c) => c.id === clipId);
  const moment = manifest.moments.find((m) => m.id === momentId);

  if (clip) {
    return (
      <Player lang={lang} manifest={manifest} clip={clip} moment={moment} onClose={closeClip} />
    );
  }
  return (
    <div className="flex flex-col gap-4">
      <nav aria-label={t(lang, "app.name")} className="flex gap-2">
        {TABS.map(({ id, key }) => (
          <Button
            key={id}
            variant={tab === id ? "default" : "outline"}
            aria-pressed={tab === id}
            onClick={() => setTab(id)}
          >
            {t(lang, key)}
          </Button>
        ))}
      </nav>
      {tab === "stops" && (
        <StopList lang={lang} clips={manifest.clips} onOpen={(c) => openClip(c.id)} />
      )}
      {tab === "shop" && <Shop lang={lang} manifest={manifest} />}
      {tab === "feedback" && <FeedbackForm lang={lang} manifest={manifest} />}
      {tab === "ask" && (
        <AskPanel lang={lang} manifest={manifest} onPlay={(m) => openClip(m.clipId, m.id)} />
      )}
    </div>
  );
}
