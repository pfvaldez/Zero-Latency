import { t, VISITOR_LANGS, type VisitorLang } from "@asknoor/core";
import { Button } from "@/components/animate-ui/components/buttons/button";

/** Shown until the guest picks a language; every label is in its own language. */
export function LanguagePicker({
  current,
  onPick,
}: {
  current: VisitorLang | null;
  onPick: (lang: VisitorLang) => void;
}) {
  const shown = current ?? "en";
  return (
    <section aria-labelledby="lang-title" className="flex flex-col gap-3">
      <h2 id="lang-title" className="text-2xl font-bold">
        {t(shown, "lang.title")}
      </h2>
      <ul className="flex flex-col gap-2">
        {VISITOR_LANGS.map((lang) => (
          <li key={lang}>
            <Button
              className="w-full justify-start text-lg"
              variant={lang === current ? "default" : "outline"}
              lang={lang}
              aria-pressed={lang === current}
              onClick={() => onPick(lang)}
            >
              {t(lang, `lang.${lang}`)}
            </Button>
          </li>
        ))}
      </ul>
    </section>
  );
}
