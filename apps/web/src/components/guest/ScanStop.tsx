import { t, type VisitorLang } from "@asknoor/core";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/animate-ui/components/buttons/button";
import { parseStopCode } from "@/lib/stop-link.ts";
import { useServices } from "@/services/context.tsx";

/** Camera view that reads a stop's QR code (NOOR-STOP-n, or a /stop/n link) and opens that stop. */
export function ScanStop({
  lang,
  onStop,
  onClose,
}: {
  lang: VisitorLang;
  onStop: (n: number) => void;
  onClose: () => void;
}) {
  const { scanner } = useServices();
  const video = useRef<HTMLVideoElement>(null);
  const [denied, setDenied] = useState(false);
  // The latest callbacks without restarting the camera when the parent re-renders.
  const handlers = useRef({ onStop });
  handlers.current = { onStop };

  useEffect(() => {
    const el = video.current;
    if (!el) return;
    let live = true;
    scanner
      .start(el, (code) => {
        const n = parseStopCode(code);
        if (n !== null && live) handlers.current.onStop(n);
      })
      .catch(() => live && setDenied(true));
    return () => {
      live = false;
      scanner.stop();
    };
  }, [scanner]);

  return (
    <div className="flex flex-col gap-3">
      {denied ? (
        <p role="alert">{t(lang, "stops.cameraDenied")}</p>
      ) : (
        // biome-ignore lint/a11y/useMediaCaption: a live camera preview has no audio to caption
        <video
          ref={video}
          muted
          playsInline
          aria-label={t(lang, "stops.scan")}
          className="w-full rounded-md bg-card"
        />
      )}
      <Button variant="outline" onClick={onClose}>
        {t(lang, "common.close")}
      </Button>
    </div>
  );
}
