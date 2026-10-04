import { type FarmPackManifest, t, type VisitorLang } from "@asknoor/core";
import { useEffect, useState } from "react";
import { monthlyText, summarize } from "@/lib/month.ts";
import { useServices } from "@/services/context.tsx";

/**
 * DEMO ONLY. Reads this phone's outbox (saved questions, feedback, confirmed orders), counts the
 * themes and shows the monthly text on a basic-phone mock-up. No network; nothing is sent.
 */
export function MonthScreen({ lang, manifest }: { lang: VisitorLang; manifest: FarmPackManifest }) {
  const { outbox } = useServices();
  const [items, setItems] = useState<Awaited<ReturnType<typeof outbox.pending>> | null>(null);
  const noor = manifest.noorText;

  useEffect(() => {
    let live = true;
    outbox.pending().then((all) => live && setItems(all));
    return () => {
      live = false;
    };
  }, [outbox]);

  if (manifest.mode !== "demo" || !noor) return null;
  const summary = items ? summarize(items) : null;
  const wolof = summary?.hasData ? monthlyText(manifest, noor, summary, "wo") : null;
  const english = summary?.hasData ? monthlyText(manifest, noor, summary, "en") : null;

  return (
    <section aria-labelledby="month-title" className="flex flex-col gap-3">
      <h2 id="month-title" className="text-2xl font-bold">
        {t(lang, "month.title")}
      </h2>
      <p className="rounded-md border border-input bg-card p-3 text-base font-bold">
        {t(lang, "month.demoNote")}
      </p>
      {items && !summary?.hasData && <p>{t(lang, "month.empty")}</p>}
      {wolof && english && (
        <>
          <section
            aria-label={t(lang, "month.phone")}
            className="mx-auto flex w-full max-w-xs flex-col gap-2 rounded-3xl border-4 border-foreground bg-card p-4"
          >
            <p className="text-base font-bold">{t(lang, "month.phone")}</p>
            <p className="text-base font-bold">{t(lang, "labels.wolofDraft")}</p>
            <p className="text-base">{t(lang, "month.wolof")}</p>
            <p
              lang="wo"
              className="rounded-md border border-input bg-background p-3 font-mono text-base"
            >
              {wolof.body}
            </p>
            <p className="text-base">
              {t(lang, "month.size", { chars: wolof.length, segments: wolof.segments })}
            </p>
            {wolof.dropped.length > 0 && (
              <p className="text-base">
                {t(lang, "month.dropped", { parts: wolof.dropped.join(" ") })}
              </p>
            )}
          </section>
          <div className="flex flex-col gap-1">
            <h3 className="text-xl font-bold">{t(lang, "month.englishPreview")}</h3>
            <p className="text-base font-bold">{t(lang, "month.englishDraft")}</p>
            <p className="text-base">{english.body}</p>
          </div>
        </>
      )}
    </section>
  );
}
