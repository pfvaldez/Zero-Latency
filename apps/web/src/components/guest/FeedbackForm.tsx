import { type FarmPackManifest, t, type VisitorLang } from "@asknoor/core";
import { useState } from "react";
import { Button } from "@/components/animate-ui/components/buttons/button";
import { saveFeedback } from "@/lib/feedback.ts";
import { useServices } from "@/services/context.tsx";

export function FeedbackForm({
  lang,
  manifest,
}: {
  lang: VisitorLang;
  manifest: FarmPackManifest;
}) {
  const { outbox } = useServices();
  const [loved, setLoved] = useState("");
  const [change, setChange] = useState("");
  const [sent, setSent] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (await saveFeedback(outbox, manifest, lang, { loved, change })) {
      setSent(true);
      setLoved("");
      setChange("");
    }
  };

  return (
    <section aria-labelledby="feedback-title" className="flex flex-col gap-3">
      <h2 id="feedback-title" className="text-2xl font-bold">
        {t(lang, "feedback.title")}
      </h2>
      <p className="text-base">{t(lang, "feedback.privacy")}</p>
      <form onSubmit={submit} className="flex flex-col gap-3">
        <Field
          id="loved"
          label={t(lang, "feedback.loved")}
          optional={t(lang, "feedback.optional")}
          value={loved}
          onChange={setLoved}
        />
        <Field
          id="change"
          label={t(lang, "feedback.change")}
          optional={t(lang, "feedback.optional")}
          value={change}
          onChange={setChange}
        />
        <Button type="submit">{t(lang, "feedback.submit")}</Button>
      </form>
      {sent && <p role="status">{t(lang, "feedback.thanks")}</p>}
    </section>
  );
}

function Field(props: {
  id: string;
  label: string;
  optional: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={props.id} className="font-bold">
        {props.label} <span className="font-normal">({props.optional})</span>
      </label>
      <textarea
        id={props.id}
        className="min-h-20 rounded-md border border-input bg-card p-3 text-lg"
        value={props.value}
        onChange={(e) => props.onChange(e.target.value)}
      />
    </div>
  );
}
