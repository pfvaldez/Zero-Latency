import type { FarmPackManifest, VisitorLang } from "@asknoor/core";
import { Player } from "@/components/guest/Player.tsx";
import { StopList } from "@/components/guest/StopList.tsx";
import { useGuest } from "@/state/guest-store.ts";

/** The tour once the pack is saved. Grows step by step: stops, player, ask, feedback, shop. */
export function GuestTour({ lang, manifest }: { lang: VisitorLang; manifest: FarmPackManifest }) {
  const { clipId, momentId, openClip, closeClip } = useGuest();
  const clip = manifest.clips.find((c) => c.id === clipId);
  if (clip) {
    const moment = manifest.moments.find((m) => m.id === momentId);
    return (
      <Player lang={lang} manifest={manifest} clip={clip} moment={moment} onClose={closeClip} />
    );
  }
  return <StopList lang={lang} clips={manifest.clips} onOpen={(c) => openClip(c.id)} />;
}
