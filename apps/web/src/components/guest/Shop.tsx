import { type FarmPackManifest, t, type VisitorLang } from "@asknoor/core";
import { useState } from "react";
import { Button } from "@/components/animate-ui/components/buttons/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/animate-ui/components/radix/sheet";
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
  const order = orderTotal(qty, products);
  const change = (id: string, by: number) =>
    setQty((q) => ({ ...q, [id]: Math.max(0, (q[id] ?? 0) + by) }));

  const confirm = async () => {
    if (await confirmOrder(outbox, manifest, qty)) {
      setConfirmed(true);
      setQty({});
      setOpen(false);
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
            className="flex items-center justify-between gap-2 rounded-md border border-input bg-card p-3"
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
        <SheetContent side="bottom">
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
          <div className="p-4">
            <Button className="w-full" onClick={confirm}>
              {t(lang, "shop.noorConfirms")}
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </section>
  );
}
