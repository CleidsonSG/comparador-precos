// Conversão banco <-> aparelho e junção dos dados, sem acesso a rede (testável no Node).
import type { CartItem } from "./cart.ts";
import type { ProductLink } from "./links.ts";
import type { SavedNote } from "./storage.ts";

export interface ReceiptRow {
  access_key: string;
  issued_at: string | null;
  total_cents: number | null;
  discount_cents: number;
  payable_cents: number | null;
  number: string | null;
  series: string | null;
  validated: boolean;
  parser_version: string | null;
  saved_at: string;
  stores: { cnpj: string; name: string; address: string | null } | null;
  receipt_items: {
    line: number | null; description: string; store_code: string | null; quantity: number; unit: string | null;
    unit_raw: string | null; unit_price_cents: number; total_cents: number;
  }[];
}
export interface LinkRow { barcode: string; name: string; keys: string[]; confirmed_at: string }
export interface CartRow {
  id: string; barcode: string; name: string; qty: number; shelf_cents: number; store_cnpj: string; store_name: string;
}

export const SELECT_RECEIPTS =
  "access_key, issued_at, total_cents, discount_cents, payable_cents, number, series, validated, parser_version, saved_at, " +
  "stores(cnpj, name, address), receipt_items(line, description, store_code, quantity, unit, unit_raw, unit_price_cents, total_cents)";

export function rowToNote(r: ReceiptRow): SavedNote {
  const items = [...r.receipt_items].sort((a, b) => (a.line ?? 0) - (b.line ?? 0));
  return {
    accessKey: r.access_key.trim(),
    savedAt: r.saved_at,
    storeName: r.stores?.name ?? "",
    storeCnpj: r.stores?.cnpj.trim() ?? r.access_key.slice(6, 20),
    storeAddress: r.stores?.address ?? "",
    issuedAt: r.issued_at,
    number: r.number ?? "",
    series: r.series ?? "",
    totalCents: r.total_cents ?? 0,
    discountCents: r.discount_cents,
    payableCents: r.payable_cents ?? r.total_cents ?? 0,
    validated: r.validated,
    parserVersion: r.parser_version ?? "",
    items: items.map((i, n) => ({
      line: i.line ?? n + 1,
      description: i.description,
      storeCode: i.store_code ?? "",
      quantity: Number(i.quantity),
      unit: i.unit ?? "",
      unitRaw: i.unit_raw ?? i.unit ?? "",
      unitPriceCents: i.unit_price_cents,
      totalCents: i.total_cents,
    })),
  };
}

export const rowToLink = (r: LinkRow): ProductLink => ({ barcode: r.barcode, name: r.name, keys: r.keys, confirmedAt: r.confirmed_at });
export const linkToRow = (l: ProductLink): LinkRow => ({ barcode: l.barcode, name: l.name, keys: l.keys, confirmed_at: l.confirmedAt });
export const rowToCart = (r: CartRow): CartItem => ({
  id: r.id, barcode: r.barcode, name: r.name, qty: r.qty, shelfCents: r.shelf_cents, storeCnpj: r.store_cnpj, storeName: r.store_name,
});
export const cartToRow = (c: CartItem): CartRow => ({
  id: c.id, barcode: c.barcode, name: c.name, qty: c.qty, shelf_cents: c.shelfCents, store_cnpj: c.storeCnpj, store_name: c.storeName,
});

/** Depois de enviar a fila: a conta manda, exceto notas ainda na fila ou recusadas (ficam no aparelho). */
export function notesAfterPull(local: SavedNote[], remote: SavedNote[], keep: Set<string>): SavedNote[] {
  const byKey = new Map(remote.map((n) => [n.accessKey, n]));
  for (const n of local) if (!byKey.has(n.accessKey) && keep.has(n.accessKey)) byKey.set(n.accessKey, n);
  return [...byKey.values()];
}

/** Primeiro login neste aparelho: o que do aparelho precisa subir para a conta. */
export function firstLoginUploads(
  local: { notes: SavedNote[]; links: ProductLink[]; cart: CartItem[] },
  remote: { noteKeys: Set<string>; links: ProductLink[]; cart: CartItem[] },
): { notes: SavedNote[]; links: ProductLink[]; cart: CartItem[] | null } {
  const remoteLinks = new Map(remote.links.map((l) => [l.barcode, l]));
  const links = local.links.filter((l) => {
    const r = remoteLinks.get(l.barcode);
    return !r || l.confirmedAt > r.confirmedAt;
  });
  const remoteIds = new Set(remote.cart.map((c) => c.id));
  const extra = local.cart.filter((c) => !remoteIds.has(c.id));
  return {
    notes: local.notes.filter((n) => !remote.noteKeys.has(n.accessKey)),
    links,
    cart: extra.length ? [...remote.cart, ...extra] : null,
  };
}
