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
  const [dub, setDub] = useState(false);
  // The AI-dubbed Wolof version of the clip: demo packs only, offered for a whole stop (not a moment).
  const dubbed = manifest.mode === "demo" && !moment ? clip.dubbed : undefined;
  const wolof = dub && !!dubbed;
  const audioPath = wolof && dubbed ? dubbed.audio : clip.audio;
  const fellBack = !wolof && !clip.subtitles[lang] && !!clip.subtitles.en;
  const vttPath = wolof ? dubbed?.subtitles : (clip.subtitles[lang] ?? clip.subtitles.en);
  // A subtitle is a draft if the moment being played, or any moment of this clip, is a draft in this language.
  const draft = (
    moment ? [moment] : manifest.moments.filter((m) => clip.momentIds.includes(m.id))
  ).some((m) => !!m.draft?.[lang]);
  const from = moment?.startMs ?? 0;
  const to = moment?.endMs ?? (wolof && dubbed ? dubbed.durationMs : clip.durationMs);

  useEffect(() => {
    let live = true;
    repo.blobUrl(audioPath).then((u) => live && setSrc(u));
    setCues([]);
    if (vttPath) repo.text(vttPath).then((v) => live && setCues(v ? parseVtt(v) : []));
    return () => {
      live = false;
    };
  }, [repo, audioPath, vttPath]);

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
      <VoiceLabels lang={lang} manifest={manifest} audio={audioPath} />
      {wolof && (
        <div className="flex flex-col gap-1">
          <p className="text-base font-bold">{t(lang, "labels.aiDubbed")}</p>
          <p className="text-base font-bold">{t(lang, "labels.wolofDraft")}</p>
          <p className="text-base">{t(lang, "player.dubNote")}</p>
        </div>
      )}
      <DemoNotes lang={lang} manifest={manifest} drafts={draft} />
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
      {dubbed && (
        <Button variant="outline" onClick={() => setDub((d) => !d)} aria-pressed={dub}>
          {dub ? t(lang, "player.hearOriginal") : t(lang, "player.hearWolof")}
        </Button>
      )}
      <Button onClick={toggle} disabled={!src}>
        {playing ? t(lang, "player.pause") : t(lang, "player.play")}
      </Button>
      {fellBack && <p className="text-base">{t(lang, "player.sourceFallback")}</p>}
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
