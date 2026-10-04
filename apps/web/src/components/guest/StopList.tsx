import { type Clip, t, type VisitorLang } from "@asknoor/core";
import { useEffect, useState } from "react";
import { Button } from "@/components/animate-ui/components/buttons/button";
import { findStop, stopNumber, stopsOf } from "@/lib/stops.ts";
import { ScanStop } from "./ScanStop.tsx";

/** The tour stops, plus the stop-number entry that works without a camera. */
export function StopList({
  lang,
  clips,
  onOpen,
  notFound = false,
}: {
  lang: VisitorLang;
  clips: readonly Clip[];
  onOpen: (clip: Clip) => void;
  /** A link or a scan named a stop this pack does not have. */
  notFound?: boolean;
}) {
  const [entry, setEntry] = useState("");
  const [missing, setMissing] = useState(notFound);
  const [scanning, setScanning] = useState(false);
  useEffect(() => {
    if (notFound) setMissing(true);
  }, [notFound]);
  const openNumber = (n: number) => {
    const clip = findStop(clips, String(n));
    setMissing(!clip);
    if (clip) {
      setScanning(false);
      onOpen(clip);
    }
  };
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const clip = findStop(clips, entry);
    setMissing(!clip);
    if (clip) onOpen(clip);
  };
  return (
    <section aria-labelledby="stops-title" className="flex flex-col gap-4">
      <h2 id="stops-title" className="text-2xl font-bold">
        {t(lang, "stops.title")}
      </h2>
      <ul className="flex flex-col gap-2">
        {stopsOf(clips).map((clip) => (
          <li key={clip.id}>
            <Button
              className="w-full justify-start text-lg"
              variant="outline"
              onClick={() => onOpen(clip)}
            >
              {t(lang, "stops.stop", { n: stopNumber(clip) ?? clip.id })}
            </Button>
          </li>
        ))}
      </ul>
      {scanning ? (
        <ScanStop lang={lang} onStop={openNumber} onClose={() => setScanning(false)} />
      ) : (
        <Button
          onClick={() => {
            setMissing(false);
            setScanning(true);
          }}
        >
          {t(lang, "stops.scan")}
        </Button>
      )}
      {missing && <p role="alert">{t(lang, "stops.notFound")}</p>}
      <form onSubmit={submit} className="flex flex-col gap-2">
        <label htmlFor="stop-number" className="font-bold">
          {t(lang, "stops.number")}
        </label>
        <div className="flex gap-2">
          <input
            id="stop-number"
            inputMode="numeric"
            aria-label={t(lang, "stops.numberLabel")}
            className="min-h-11 w-28 rounded-md border border-input bg-card px-3 text-lg"
            value={entry}
            onChange={(e) => setEntry(e.target.value)}
          />
          <Button type="submit">{t(lang, "stops.go")}</Button>
        </div>
      </form>
    </section>
  );
}
