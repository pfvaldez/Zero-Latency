import {
  type Clip,
  type Cue,
  type FarmPackManifest,
  type Moment,
  t,
  type VisitorLang,
} from "@asknoor/core";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/animate-ui/components/buttons/button";
import { parseVtt } from "@/lib/vtt.ts";
import { useServices } from "@/services/context.tsx";
import { DemoNotes, VoiceLabels } from "./Labels.tsx";

/**
 * Plays Noor's own recording with checked subtitles. With a `moment`, plays only that moment of the
 * clip. A language with no subtitle file falls back to the checked source script (English), with a note.
 */
export function Player({
  lang,
  manifest,
  clip,
  moment,
  onClose,
}: {
  lang: VisitorLang;
  manifest: FarmPackManifest;
  clip: Clip;
  moment?: Moment | undefined;
  onClose: () => void;
}) {
  const { repo } = useServices();
  const audioRef = useRef<HTMLAudioElement>(null);
  const [src, setSrc] = useState<string | null>(null);
  const [cues, setCues] = useState<Cue[]>([]);
  const [nowMs, setNowMs] = useState(0);
  const [playing, setPlaying] = useState(false);
  const fellBack = !clip.subtitles[lang] && !!clip.subtitles.en;
  const vttPath = clip.subtitles[lang] ?? clip.subtitles.en;
  const from = moment?.startMs ?? 0;
  const to = moment?.endMs ?? clip.durationMs;

  useEffect(() => {
    let live = true;
    repo.blobUrl(clip.audio).then((u) => live && setSrc(u));
    setCues([]);
    if (vttPath) repo.text(vttPath).then((v) => live && setCues(v ? parseVtt(v) : []));
    return () => {
      live = false;
    };
  }, [repo, clip.audio, vttPath]);

  // Start at the moment's start as soon as the audio is loaded, so a confirmed match plays at once.
  useEffect(() => {
    const el = audioRef.current;
    if (!el || !src) return;
    el.currentTime = from / 1000;
    if (moment) void el.play().catch(() => {});
  }, [src, from, moment]);

  const shown = moment ? cues.filter((c) => c.endMs > from && c.startMs < to) : cues;
  const toggle = () => {
    const el = audioRef.current;
    if (!el) return;
    if (el.paused) void el.play().catch(() => {});
    else el.pause();
  };

  return (
    <section aria-labelledby="player-title" className="flex flex-col gap-3">
      <h2 id="player-title" className="text-2xl font-bold">
        {t(lang, "player.noorSays")}
      </h2>
      <VoiceLabels lang={lang} manifest={manifest} audio={clip.audio} />
      <DemoNotes lang={lang} manifest={manifest} drafts={!!moment?.draft?.[lang]} />
      {/* biome-ignore lint/a11y/useMediaCaption: the subtitles are the visible cue list below, from the pack's checked WebVTT */}
      <audio
        ref={audioRef}
        src={src ?? undefined}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onTimeUpdate={(e) => {
          const el = e.currentTarget;
          setNowMs(el.currentTime * 1000);
          if (moment && el.currentTime * 1000 >= to) el.pause();
        }}
      />
      <Button onClick={toggle} disabled={!src}>
        {playing ? t(lang, "player.pause") : t(lang, "player.play")}
      </Button>
      {fellBack && <p className="text-sm">{t(lang, "player.sourceFallback")}</p>}
      <section aria-label={t(lang, "player.subtitles")} className="flex flex-col gap-2 text-xl">
        {shown.map((cue) => (
          <p
            key={cue.startMs}
            aria-current={nowMs >= cue.startMs && nowMs < cue.endMs ? "true" : undefined}
            className={nowMs >= cue.startMs && nowMs < cue.endMs ? "font-bold" : undefined}
          >
            {cue.text}
          </p>
        ))}
      </section>
      <Button variant="outline" onClick={onClose}>
        {t(lang, "common.back")}
      </Button>
    </section>
  );
}
