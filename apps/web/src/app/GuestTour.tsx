import type { FarmPackManifest, VisitorLang } from "@asknoor/core";
import { t } from "@asknoor/core";

/** The tour once the pack is saved. Grows step by step: stops, player, ask, feedback, shop. */
export function GuestTour({ lang, manifest }: { lang: VisitorLang; manifest: FarmPackManifest }) {
  return (
    <section>
      <p role="status">{t(lang, "pack.done")}</p>
      <p className="text-sm">{manifest.clips.length}</p>
    </section>
  );
}
