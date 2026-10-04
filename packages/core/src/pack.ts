// planPack: what goes into a farm pack, as a pure function. It decides which clips, languages,
// add-ons and audio files ship in each mode, and which labels they carry. The pack builder
// (packages/pack) does the I/O around it: embeddings, files, checksums, manifest.
//
// Rules (CLAUDE.md non-negotiables 5, 6, 9, 10; Slice 2 decisions):
//   production  checked English text only; checked add-ons without `needs`; no draft language, no
//               held-back clip, no AI-dubbed audio; a disclosed stand-in voice is allowed
//   demo        also drafts (flagged), needy add-ons (labeled) and AI-dubbed Wolof (labeled)
//   both        the held-back clip only with --publish; any recording of a person needs that
//               person's `publishing` consent row confirmed; AI-dubbed audio also needs `dubbing`;
//               a translation made from different English than today's is stale and stops the build

import { type ConsentRow, requireConfirmed } from "./consent.ts";
import {
  type AddonContent,
  type ChecksFile,
  type ClipsFile,
  type RecordingsFile,
  toAddons,
} from "./content.ts";
import type { Addon, Clip, FarmPackManifest, Moment, VisitorLang } from "./types.ts";
import {
  type Cue,
  cuesEstimated,
  cuesFromWords,
  splitSentences,
  type TimedWord,
  toWebVtt,
} from "./vtt.ts";

export type PackMode = "demo" | "production";

export class PackError extends Error {}

export interface TranslationItem {
  sourceSha256: string;
  sentences: Partial<Record<"en" | "de" | "nl" | "sv" | "wo", string>>[];
}
export type Translations = Record<string, TranslationItem>;

export interface AudioMeta {
  durationMs: number;
  headSilenceMs: number;
  tailSilenceMs: number;
}

export interface PackInput {
  clips: ClipsFile;
  checks: ChecksFile;
  addonContent: AddonContent;
  recordings: RecordingsFile;
  /** Audio facts by registry file ("en/clip01.m4a"). */
  audio: Record<string, AudioMeta>;
  transcripts: ReadonlyMap<number, { text: string; sha256: string; words: readonly TimedWord[] }>;
  /** null when no translation file exists yet. */
  clipTranslations: Translations | null;
  addonTranslations: Translations | null;
  consent: readonly ConsentRow[];
  /** sha256 hex of a string; injected so core stays free of Node and browser APIs. */
  sha256: (text: string) => string;
}

export interface PlannedFile {
  dest: string;
  /** Copy this prepared recording, or write this text. */
  source: { recording: string } | { text: string };
}

export interface PackPlan {
  mode: PackMode;
  visitorLangs: VisitorLang[];
  clips: Clip[];
  moments: Moment[];
  addons: Addon[];
  labels: FarmPackManifest["labels"];
  /** The passages to embed, in the order of the embedding rows. */
  passages: { momentId: string; lang: VisitorLang; text: string }[];
  files: PlannedFile[];
  excluded: { what: string; why: string }[];
}

const TRANSLATED = ["de", "nl", "sv"] as const;
const num = (n: number) => String(n).padStart(2, "0");

/** The English sentences of an add-on, exactly as pipeline/asknoor/translate.py builds them. */
export function addonSentences(content: AddonContent): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const f of content.facts.facts) out[f.id] = splitSentences(f.text.en);
  out[content.recipe.id] = [content.recipe.title.en, ...content.recipe.steps.map((s) => s.en)];
  for (const p of content.products.products) out[p.id] = [p.name.en];
  out[content.farmCard.id] = content.farmCard.lines.map((l) => l.en);
  return out;
}

function freshTranslation(
  items: Translations | null,
  key: string,
  english: readonly string[],
  sha256: (t: string) => string,
  what: string,
): TranslationItem | null {
  if (items === null) return null;
  const item = items[key];
  const current = sha256(english.join("\n"));
  if (
    !item ||
    item.sourceSha256 !== current ||
    item.sentences.some((s, i) => s.en !== english[i]) ||
    item.sentences.length !== english.length
  ) {
    throw new PackError(
      `the translation of ${what} is missing or stale (the English changed): run \`uv run --group translate python -m asknoor.build --steps translate\``,
    );
  }
  return item;
}

function joinTranslated(item: TranslationItem, lang: "de" | "nl" | "sv" | "wo"): string[] | null {
  const parts = item.sentences.map((s) => s[lang]);
  return parts.every((p): p is string => !!p) ? parts : null;
}

function isChecked(checks: ChecksFile, id: string, boundTo?: string): boolean {
  const entry = checks.checks.find((c) => c.id === id);
  if (!entry?.checked) return false;
  return boundTo === undefined || entry.transcriptSha256 === boundTo;
}

export function planPack(
  input: PackInput,
  mode: PackMode,
  options: { publish?: readonly number[]; allowSyntheticTones?: boolean } = {},
): PackPlan {
  const production = mode === "production";
  const publish = new Set(options.publish ?? []);
  const plan: PackPlan = {
    mode,
    visitorLangs: ["en"],
    clips: [],
    moments: [],
    addons: [],
    labels: { standIn: [], standInVoice: [], syntheticVoice: [], aiDubbed: [] },
    passages: [],
    files: [],
    excluded: [],
  };
  const langsUsed = new Set<VisitorLang>(["en"]);
  const standInFiles: string[] = [];
  let standInPerson = "";

  for (const clip of input.clips.clips) {
    const n = num(clip.id);
    if (!clip.published && !publish.has(clip.id)) {
      plan.excluded.push({ what: `clip ${clip.id}`, why: "held back (publish it with --publish)" });
      continue;
    }

    // English text: the transcript if there is one, otherwise the script.
    const transcript = input.transcripts.get(clip.id);
    const enText = transcript?.text ?? clip.script.en;
    const enSentences = splitSentences(enText);
    // Checked against the transcript when there is one (the hash must match), else by ear.
    const enChecked = isChecked(input.checks, `clip-${clip.id}/subtitles/en`, transcript?.sha256);
    if (production && !enChecked) {
      plan.excluded.push({ what: `clip ${clip.id}`, why: "no checked English text" });
      continue;
    }

    const rec = input.recordings.recordings.find((r) => r.clip === clip.id && r.lang === "en");
    if (!rec) throw new PackError(`clip ${clip.id} has no English recording in recordings.json`);
    // A person's voice needs that person's confirmed publishing row. Generated tones are not a voice.
    if (rec.kind === "synthetic-tone") {
      // Only the fixture builder may use tones. Anywhere else this kind could be used to skip the
      // consent check for a real recording, so it is refused.
      if (!options.allowSyntheticTones) {
        throw new PackError(
          `${rec.file}: synthetic-tone recordings are only allowed in the fixture pack; a real recording needs a consent row`,
        );
      }
      if (!plan.labels.standIn.includes(rec.label)) plan.labels.standIn.push(rec.label); // refused in production by the manifest schema
    } else {
      try {
        requireConfirmed(input.consent, rec.person, "publishing");
      } catch (error) {
        throw new PackError(
          `${rec.file}: ${(error as Error).message}: ${rec.person}'s voice cannot go into any pack`,
        );
      }
    }
    const meta = input.audio[rec.file];
    if (!meta) throw new PackError(`no audio facts for ${rec.file}: run the audio step`);

    // Cues: word timestamps when a transcript exists, otherwise estimated from the script.
    const timing: Moment["timing"] = transcript ? "word-timestamps" : "estimated";
    const cues: Cue[] = transcript
      ? cuesFromWords(transcript.words, enSentences)
      : cuesEstimated(enSentences, meta.durationMs, meta.headSilenceMs, meta.tailSilenceMs);
    const note = transcript
      ? undefined
      : "timing estimated from the script, not from the recording";
    const subtitleFiles: Partial<Record<VisitorLang, string>> = { en: `subtitles/clip${n}.en.vtt` };
    plan.files.push({ dest: subtitleFiles.en as string, source: { text: toWebVtt(cues, note) } });
    plan.passages.push({ momentId: clip.momentId, lang: "en", text: enText });

    const subtitles: Moment["subtitles"] = { en: enText };
    const topic: Moment["topic"] = { en: clip.topic.en };
    const draft: Partial<Record<VisitorLang, boolean>> = { en: !enChecked };

    const translation = freshTranslation(
      input.clipTranslations,
      String(clip.id),
      enSentences,
      input.sha256,
      `clip ${clip.id}`,
    );
    for (const lang of TRANSLATED) {
      const lines = translation ? joinTranslated(translation, lang) : null;
      const textChecked =
        !!translation &&
        isChecked(input.checks, `clip-${clip.id}/subtitles/${lang}`, translation.sourceSha256);
      if (lines && (!production || textChecked)) {
        subtitles[lang] = lines.join(" ");
        draft[lang] = !textChecked;
        subtitleFiles[lang] = `subtitles/clip${n}.${lang}.vtt`;
        plan.files.push({
          dest: subtitleFiles[lang] as string,
          source: {
            text: toWebVtt(
              cues.map((c, i) => ({ ...c, text: lines[i] as string })),
              `machine draft translation; ${note ?? "timing from the transcript"}`,
            ),
          },
        });
        plan.passages.push({ momentId: clip.momentId, lang, text: lines.join(" ") });
        langsUsed.add(lang);
      } else if (lines) {
        plan.excluded.push({
          what: `clip ${clip.id} ${lang} subtitles`,
          why: "draft translation, not checked",
        });
      }
      if (!production || isChecked(input.checks, `clip-${clip.id}/topic/${lang}`)) {
        topic[lang] = clip.topic[lang];
        draft[lang] = draft[lang] ?? true;
      }
    }

    plan.moments.push({
      id: clip.momentId,
      clipId: clip.id,
      startMs: 0,
      endMs: meta.durationMs,
      subtitles,
      topic,
      ...(production ? {} : { draft }),
      timing,
    });

    const planned: Clip = {
      id: clip.id,
      kind: clip.kind,
      ...(clip.stopCode ? { stopCode: clip.stopCode } : {}),
      audio: `audio/clip${n}.m4a`,
      durationMs: meta.durationMs,
      momentIds: [clip.momentId],
      subtitles: subtitleFiles,
    };
    plan.files.push({ dest: planned.audio, source: { recording: rec.file } });
    if (rec.kind === "stand-in-voice") {
      standInFiles.push(planned.audio);
      standInPerson = rec.person.split(" ")[0] ?? rec.person;
    }

    // AI-dubbed Wolof: demo packs only, labeled, and only with the dubbing and publishing rows.
    const dub = input.recordings.recordings.find((r) => r.clip === clip.id && r.lang === "wo");
    if (dub && production) {
      plan.excluded.push({
        what: `clip ${clip.id} Wolof dub`,
        why: "AI-dubbed audio is demo-only",
      });
    } else if (dub && dub.kind === "ai-dubbed") {
      try {
        requireConfirmed(input.consent, dub.consentPerson, "dubbing");
        requireConfirmed(input.consent, dub.consentPerson, "publishing");
      } catch (error) {
        throw new PackError(
          `${dub.file}: ${(error as Error).message}: the dub cannot go into any pack`,
        );
      }
      const dubMeta = input.audio[dub.file];
      if (!dubMeta) throw new PackError(`no audio facts for ${dub.file}: run the audio step`);
      const woLines = translation ? joinTranslated(translation, "wo") : null;
      const dubbed: NonNullable<Clip["dubbed"]> = {
        lang: "wo",
        audio: `audio/clip${n}_wo.m4a`,
        durationMs: dubMeta.durationMs,
        label: "AI-dubbed (ElevenLabs)",
      };
      plan.files.push({ dest: dubbed.audio, source: { recording: dub.file } });
      if (woLines) {
        dubbed.subtitles = `subtitles/clip${n}.wo.vtt`;
        dubbed.subtitlesDraft = true; // a machine translation of the English, not a transcript of the dub
        const woCues = cuesEstimated(
          woLines,
          dubMeta.durationMs,
          dubMeta.headSilenceMs,
          dubMeta.tailSilenceMs,
        );
        plan.files.push({
          dest: dubbed.subtitles,
          source: {
            text: toWebVtt(
              woCues,
              "machine translation of the English text, timing estimated; NOT a transcript of what the AI-dubbed audio says",
            ),
          },
        });
      }
      planned.dubbed = dubbed;
      plan.labels.aiDubbed.push(dubbed.audio);
    }
    plan.clips.push(planned);
  }

  // Add-ons: toAddons takes `checked` only from checks.json.
  const sentences = addonSentences(input.addonContent);
  for (const addon of toAddons(input.addonContent, input.checks)) {
    if (production && (!addon.checked || (addon.needs && addon.needs.length > 0))) {
      plan.excluded.push({
        what: `add-on ${addon.id}`,
        why: addon.checked ? `still needs ${addon.needs?.join(", ")}` : "not checked",
      });
      continue;
    }
    const english = sentences[addon.id] ?? [];
    const item = production
      ? null
      : freshTranslation(
          input.addonTranslations,
          addon.id,
          english,
          input.sha256,
          `add-on ${addon.id}`,
        );
    const text = { ...addon.text };
    for (const lang of TRANSLATED) {
      const lines = item ? joinTranslated(item, lang) : null;
      if (!lines) continue;
      text[lang] =
        addon.kind === "recipe"
          ? [lines[0], ...lines.slice(1).map((l, i) => `${i + 1}. ${l}`)].join("\n")
          : addon.kind === "farm-card"
            ? lines.join("\n")
            : lines.join(" ");
      langsUsed.add(lang);
    }
    plan.addons.push({ ...addon, text });
  }

  plan.visitorLangs = (["en", "de", "nl", "sv"] as const).filter((l) => langsUsed.has(l));
  if (standInFiles.length > 0)
    plan.labels.standInVoice.push({ person: standInPerson, files: standInFiles });
  return plan;
}
