import type { Addon, FarmPackManifest, OutboxItem, VisitorLang } from "@asknoor/core";
import type { Outbox } from "@/services/types.ts";

export type Product = Extract<Addon, { kind: "product" }>;

export const productsOf = (manifest: FarmPackManifest): Product[] =>
  manifest.addons.filter((a): a is Product => a.kind === "product");

export const productName = (p: Product, lang: VisitorLang): string =>
  p.text[lang] ?? p.text.en ?? p.id;

/** Total of the chosen quantities. `complete` is false when a chosen product has no price yet. */
export function orderTotal(
  quantities: Record<string, number>,
  products: readonly Product[],
): {
  total: number;
  complete: boolean;
  currency: string;
  lines: { product: Product; qty: number }[];
} {
  const lines = products
    .map((product) => ({ product, qty: quantities[product.id] ?? 0 }))
    .filter((l) => l.qty > 0);
  const complete = lines.every((l) => l.product.price !== undefined);
  const total = lines.reduce((sum, l) => sum + (l.product.price ?? 0) * l.qty, 0);
  return { total, complete, currency: products[0]?.currency ?? "", lines };
}

/** Stored only after Noor confirms payment (non-negotiable 6). */
export async function confirmOrder(
  outbox: Outbox,
  manifest: FarmPackManifest,
  quantities: Record<string, number>,
): Promise<OutboxItem | null> {
  const { total, currency, lines } = orderTotal(quantities, productsOf(manifest));
  if (lines.length === 0) return null;
  const item: OutboxItem = {
    type: "order",
    id: crypto.randomUUID(),
    farmId: manifest.farmId,
    items: lines.map((l) => ({ productId: l.product.id, qty: l.qty })),
    total,
    currency,
    confirmedByNoor: true,
    createdAt: new Date().toISOString(),
  };
  await outbox.add(item);
  return item;
}
