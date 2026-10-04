import { type FarmPackManifest, type Moment, t, type VisitorLang } from "@asknoor/core";
import { useEffect, useState } from "react";
import { Button } from "@/components/animate-ui/components/buttons/button";
import { type AskResult, ask, saveQuestion } from "@/lib/ask.ts";
import { useServices } from "@/services/context.tsx";

type View =
  | { step: "idle" }
  | { step: "asking" }
  | { step: "safety" }
  | { step: "confirm"; moment: Moment; score: number; question: string }
  | { step: "saved" }
  | { step: "saved-no" }
  | { step: "error" };

/** Ask Noor a question. The answer is always one of Noor's own moments, confirmed by the guest. */
export function AskPanel({
  lang,
  manifest,
  onPlay,
}: {
  lang: VisitorLang;
  manifest: FarmPackManifest;
  onPlay: (moment: Moment) => void;
}) {
  const { matcher, outbox } = useServices();
  const [text, setText] = useState("");
  const [view, setView] = useState<View>({ step: "idle" });
  const [ready, setReady] = useState(false);
  const demo = manifest.mode === "demo";
  const [last, setLast] = useState<AskResult | null>(null);

  // Warm the model up as soon as the Ask tab opens, so the first question is quick.
  useEffect(() => {
    let live = true;
    matcher
      .ready()
      .then(() => live && setReady(true))
      .catch((e: unknown) => {
        console.error("the matcher did not start", e);
        if (live) setView({ step: "error" });
      });
    return () => {
      live = false;
    };
  }, [matcher]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const question = text.trim();
    if (!question) return;
    setView({ step: "asking" });
    try {
      const result = await ask(question, matcher, manifest);
      setLast(result);
      const { outcome } = result;
      if (outcome.kind === "safety") return setView({ step: "safety" });
      if (outcome.kind === "confirm") {
        const moment = manifest.moments.find((m) => m.id === outcome.momentId);
        if (moment) return setView({ step: "confirm", moment, score: outcome.score, question });
      }
      await saveQuestion(outbox, manifest, lang, question);
      setView({ step: "saved" });
    } catch {
      setView({ step: "error" });
    }
  };

  const no = async (question: string) => {
    await saveQuestion(outbox, manifest, lang, question);
    setView({ step: "saved-no" });
  };

  return (
    <section aria-labelledby="ask-title" className="flex flex-col gap-4">
      <h2 id="ask-title" className="text-2xl font-bold">
        {t(lang, "ask.title")}
      </h2>
      <form onSubmit={submit} className="flex flex-col gap-2">
        <label htmlFor="ask-text" className="sr-only">
          {t(lang, "ask.placeholder")}
        </label>
        <textarea
          id="ask-text"
          className="min-h-24 rounded-md border border-input bg-card p-3 text-lg"
          placeholder={t(lang, "ask.placeholder")}
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        <Button type="submit" disabled={!ready || view.step === "asking"}>
          {ready ? t(lang, "ask.submit") : t(lang, "common.loading")}
        </Button>
      </form>

      {view.step === "safety" && (
        <div
          role="alert"
          className="flex flex-col gap-2 rounded-md border-2 border-input bg-card p-4"
        >
          <h3 className="text-xl font-bold">{t(lang, "ask.safety.title")}</h3>
          <p>{t(lang, "ask.safety.body")}</p>
        </div>
      )}
      {view.step === "confirm" && (
        <div className="flex flex-col gap-3 rounded-md border border-input bg-card p-4">
          <p className="text-xl">
            {t(lang, "ask.confirm", {
              topic: view.moment.topic[lang] ?? view.moment.topic.en ?? "",
            })}
          </p>
          {demo && (
            <p className="text-sm font-bold">{`${t(lang, "labels.demo")}: ${view.score.toFixed(4)}`}</p>
          )}
          <div className="flex gap-2">
            <Button onClick={() => onPlay(view.moment)}>{t(lang, "ask.yes")}</Button>
            <Button variant="outline" onClick={() => no(view.question)}>
              {t(lang, "ask.no")}
            </Button>
          </div>
        </div>
      )}
      {view.step === "saved" && (
        <div
          role="status"
          className="flex flex-col gap-2 rounded-md border border-input bg-card p-4"
        >
          <h3 className="text-xl font-bold">{t(lang, "ask.saved.title")}</h3>
          <p>{t(lang, "ask.saved.body")}</p>
          {demo && last && (
            <p className="text-sm font-bold">{`${t(lang, "labels.demo")}: ${(last.top[0]?.score ?? 0).toFixed(4)}`}</p>
          )}
        </div>
      )}
      {view.step === "saved-no" && <p role="status">{t(lang, "ask.savedNo")}</p>}
      {view.step === "error" && <p role="alert">{t(lang, "pack.error")}</p>}
    </section>
  );
}
