import { type FarmPackManifest, I18N_STATUS, t, type VisitorLang } from "@asknoor/core";

/** Every stand-in, draft and synthetic voice is labeled (non-negotiable 9). Demo packs only, except the disclosed stand-in voice. */
export function VoiceLabels({
  lang,
  manifest,
  audio,
}: {
  lang: VisitorLang;
  manifest: FarmPackManifest;
  audio: string;
}) {
  const standIn = manifest.labels.standInVoice.find((v) => v.files.includes(audio));
  const synthetic = manifest.labels.syntheticVoice.includes(audio);
  const aiDubbed = manifest.labels.aiDubbed.includes(audio);
  return (
    <ul className="flex flex-wrap gap-2 text-base font-bold">
      {standIn && <Chip>{t(lang, "labels.standInVoice", { person: standIn.person })}</Chip>}
      {synthetic && <Chip>{t(lang, "labels.aiVoice")}</Chip>}
      {aiDubbed && <Chip>{t(lang, "labels.aiDubbed")}</Chip>}
    </ul>
  );
}

export function DemoNotes({
  lang,
  manifest,
  drafts,
}: {
  lang: VisitorLang;
  manifest: FarmPackManifest;
  drafts: boolean;
}) {
  if (manifest.mode !== "demo") return null;
  // The interface text itself (de, nl, sv) is an unchecked draft too.
  const interfaceDraft = I18N_STATUS[lang] === "draft";
  return (
    <ul className="flex flex-wrap gap-2 text-base font-bold">
      <Chip>{t(lang, "labels.demo")}</Chip>
      {manifest.labels.standIn.map((what) => (
        <Chip key={what}>{t(lang, "labels.standIn", { what })}</Chip>
      ))}
      {(drafts || interfaceDraft) && <Chip>{t(lang, "labels.draftTranslation")}</Chip>}
    </ul>
  );
}

function Chip({ children }: { children: React.ReactNode }) {
  return <li className="rounded-md border border-input bg-card px-2 py-1">{children}</li>;
}
