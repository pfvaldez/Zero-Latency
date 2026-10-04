import { t } from "@asknoor/core";
import { MotionConfig } from "motion/react";
import { Button } from "@/components/animate-ui/components/buttons/button";
import { LanguagePicker } from "@/components/guest/LanguagePicker.tsx";
import { PackGate } from "@/components/guest/PackGate.tsx";
import { usePack } from "@/hooks/use-pack.ts";
import { useStopLink } from "@/hooks/use-stop-link.ts";
import { useGuest } from "@/state/guest-store.ts";
import { GuestTour } from "./GuestTour.tsx";

export function App() {
  const { lang, setLang } = useGuest();
  const { state, download } = usePack();
  const [linkedStop, clearLink] = useStopLink();
  return (
    // Animate UI's accessibility advice: honour the guest's reduced-motion setting everywhere.
    <MotionConfig reducedMotion="user">
      <main className="mx-auto flex min-h-dvh max-w-xl flex-col gap-5 p-4">
        <header className="relative flex min-h-36 items-end justify-between gap-2 overflow-hidden rounded-2xl bg-card p-4">
          <img src="/hero.webp" alt="" className="absolute inset-0 h-full w-full object-cover" />
          <h1 className="relative rounded-xl bg-card/90 px-3 py-1 text-3xl font-semibold">
            {t(lang ?? "en", "app.name")}
          </h1>
          {lang && (
            <Button
              variant="outline"
              size="sm"
              className="relative bg-card"
              onClick={() => setLang(null)}
            >
              {t(lang, "lang.change")}
            </Button>
          )}
        </header>
        {!lang ? (
          <LanguagePicker current={null} onPick={setLang} />
        ) : state.status === "ready" ? (
          <GuestTour
            lang={lang}
            manifest={state.manifest}
            linkedStop={linkedStop}
            onLinkHandled={clearLink}
          />
        ) : (
          <PackGate lang={lang} state={state} onDownload={download} />
        )}
      </main>
    </MotionConfig>
  );
}
