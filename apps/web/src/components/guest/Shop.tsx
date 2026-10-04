import { type FarmPackManifest, t, type VisitorLang } from "@asknoor/core";
import { useEffect, useState } from "react";
import { Button } from "@/components/animate-ui/components/buttons/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/animate-ui/components/radix/sheet";
import { orderLine as noorOrderLine } from "@/lib/month.ts";
import { confirmOrder, orderTotal, productName, productsOf } from "@/lib/order.ts";
import { useServices } from "@/services/context.tsx";
import { DemoNotes } from "./Labels.tsx";

/**
 * A minimal shop. No payment is taken here. The order sheet is for Noor to read; the order is
 * stored only when Noor taps "confirms payment" (non-negotiable 6).
 */
export function Shop({ lang, manifest }: { lang: VisitorLang; manifest: FarmPackManifest }) {
  const { outbox } = useServices();
  const products = productsOf(manifest);
  const [qty, setQty] = useState<Record<string, number>>({});
  const [open, setOpen] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [code, setCode] = useState("");
  const [problem, setProblem] = useState<"wrong" | "missing" | null>(null);
  const [wrongTries, setWrongTries] = useState(0);
  const [lockedUntil, setLockedUntil] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  const secondsLeft = Math.max(0, Math.ceil((lockedUntil - now) / 1000));
  // While locked, tick once a second so the countdown (and the unlock) show.
  useEffect(() => {
    if (lockedUntil <= Date.now()) return;
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [lockedUntil]);
  const order = orderTotal(qty, products);
  const change = (id: string, by: number) =>
    setQty((q) => ({ ...q, [id]: Math.max(0, (q[id] ?? 0) + by) }));

  const confirm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (secondsLeft > 0) return;
    const result = await confirmOrder(outbox, manifest, qty, code);
    setCode("");
    if (result.ok) {
      setConfirmed(true);
      setQty({});
      setOpen(false);
      setProblem(null);
      setWrongTries(0);
    } else if (result.reason === "no-code") {
      setProblem("missing");
    } else if (result.reason === "wrong-code") {
      setProblem("wrong");
      const tries = wrongTries + 1;
      setWrongTries(tries);
      if (tries % 3 === 0) {
        setLockedUntil(Date.now() + 30_000);
        setNow(Date.now());
      }
    }
  };

  return (
    <section aria-labelledby="shop-title" className="flex flex-col gap-3">
      <h2 id="shop-title" className="text-2xl font-bold">
        {t(lang, "shop.title")}
      </h2>
      <p>{t(lang, "shop.noPayment")}</p>
      <DemoNotes lang={lang} manifest={manifest} drafts={false} />
      <ul className="flex flex-col gap-2">
        {products.map((p) => (
          <li
            key={p.id}
            className="flex items-center justify-between gap-2 rounded-2xl bg-card p-3"
          >
            <span className="text-lg">
              {productName(p, lang)}
              {p.price !== undefined && ` · ${p.price} ${p.currency}`}
            </span>
            <span className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                aria-label={`${t(lang, "shop.qty")} −`}
                onClick={() => change(p.id, -1)}
              >
                −
              </Button>
              <output
                aria-label={`${t(lang, "shop.qty")}: ${productName(p, lang)}`}
                className="min-w-6 text-center text-lg"
              >
                {qty[p.id] ?? 0}
              </output>
              <Button
                variant="outline"
                size="sm"
                aria-label={`${t(lang, "shop.qty")} +`}
                onClick={() => change(p.id, 1)}
              >
                +
              </Button>
            </span>
          </li>
        ))}
      </ul>
      {order.lines.length === 0 && <p>{t(lang, "shop.empty")}</p>}
      <Button disabled={order.lines.length === 0} onClick={() => setOpen(true)}>
        {t(lang, "shop.order")}
      </Button>
      {confirmed && <p role="status">{t(lang, "shop.confirmed")}</p>}

      <Sheet open={open} onOpenChange={setOpen}>
        {/* Fits its content and scrolls on a small phone, so the confirm button is always reachable. */}
        <SheetContent side="bottom" className="h-auto max-h-[90dvh] overflow-y-auto rounded-t-3xl">
          <SheetHeader>
            <SheetTitle>{t(lang, "shop.showNoor")}</SheetTitle>
            <SheetDescription>{t(lang, "shop.noPayment")}</SheetDescription>
          </SheetHeader>
          <ul className="flex flex-col gap-2 p-4 text-xl">
            {order.lines.map((l) => (
              <li key={l.product.id}>{`${l.qty} × ${productName(l.product, lang)}`}</li>
            ))}
          </ul>
          {order.complete && (
            <p className="px-4 text-2xl font-bold">
              {t(lang, "shop.total", { total: order.total, currency: order.currency })}
            </p>
          )}
          {manifest.mode === "demo" && manifest.noorText && (
            <div className="flex flex-col gap-1 px-4">
              <h3 className="text-xl font-bold">{t(lang, "shop.orderLineWolof")}</h3>
              <p lang="wo" className="text-xl">
                {noorOrderLine(manifest.noorText, "wo", {
                  items: order.lines.reduce((n, l) => n + l.qty, 0),
                  total: order.complete ? order.total : null,
                  currency: order.currency,
                })}
              </p>
              <p className="text-base font-bold">{t(lang, "labels.wolofDraft")}</p>
            </div>
          )}
          <form onSubmit={confirm} className="flex flex-col gap-2 p-4">
            <label htmlFor="farm-code" className="font-bold">
              {t(lang, "shop.codeLabel")}
            </label>
            <input
              id="farm-code"
              type="password"
              inputMode="numeric"
              autoComplete="off"
              maxLength={4}
              className="min-h-11 w-32 rounded-md border border-input bg-card px-3 text-lg"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
            />
            <p className="text-base font-bold">{t(lang, "labels.prototypeControl")}</p>
            {problem === "wrong" && secondsLeft === 0 && (
              <p role="alert">{t(lang, "shop.codeWrong")}</p>
            )}
            {problem === "missing" && <p role="alert">{t(lang, "shop.codeMissing")}</p>}
            {secondsLeft > 0 && (
              <p role="alert">{t(lang, "shop.codeLocked", { seconds: secondsLeft })}</p>
            )}
            <Button
              type="submit"
              className="w-full"
              disabled={code.length !== 4 || secondsLeft > 0}
            >
              {t(lang, "shop.noorConfirms")}
            </Button>
          </form>
        </SheetContent>
      </Sheet>
    </section>
  );
}
