import { t, type VisitorLang } from "@asknoor/core";
import { Button } from "@/components/animate-ui/components/buttons/button";
import type { PackState } from "@/hooks/use-pack.ts";

const megabytes = (bytes: number) => `${(bytes / 1_000_000).toFixed(1)} MB`;

/** The one-time download screen: size, progress, retry. */
export function PackGate({
  lang,
  state,
  onDownload,
}: {
  lang: VisitorLang;
  state: Exclude<PackState, { status: "ready" }>;
  onDownload: () => void;
}) {
  return (
    <section aria-labelledby="pack-title" className="flex flex-col gap-3">
      <h2 id="pack-title" className="text-2xl font-bold">
        {t(lang, "pack.title")}
      </h2>
      <p>{t(lang, "pack.body")}</p>
      {state.status === "loading" && <p>{t(lang, "common.loading")}</p>}
      {state.status === "missing" && (
        <>
          {state.size !== null && <p>{t(lang, "pack.size", { size: megabytes(state.size) })}</p>}
          <Button onClick={onDownload}>{t(lang, "pack.download")}</Button>
        </>
      )}
      {state.status === "downloading" && (
        <>
          <progress
            className="w-full"
            max={1}
            value={state.progress}
            aria-label={t(lang, "pack.title")}
          />
          <p role="status">
            {t(lang, "pack.progress", { percent: Math.round(state.progress * 100) })}
          </p>
        </>
      )}
      {state.status === "error" && (
        <>
          <p role="alert">{t(lang, "pack.error")}</p>
          <Button onClick={onDownload}>{t(lang, "pack.retry")}</Button>
        </>
      )}
      <p className="text-base">{t(lang, "pack.storage")}</p>
    </section>
  );
}
