import type { SavedNote } from "../../lib/storage.ts";

/** Um preço observado em uma compra. Produto = mercado (CNPJ) + código interno da nota. */
export interface Observation {
  productKey: string;
  description: string;
  storeName: string;
  cnpj: string;
  date: string; // ISO
  unitPriceCents: number;
  unit?: string; // UND, KG… (sem o dígito final da nota)
}

export interface PriceChange {
  productKey: string;
  description: string;
  storeName: string;
  firstCents: number;
  lastCents: number;
  pct: number; // 0.1 = +10%
  history: Observation[];
}

const dateOf = (n: SavedNote): string => n.issuedAt ?? n.savedAt;

export function observations(notes: SavedNote[]): Observation[] {
  const out: Observation[] = [];
  for (const n of notes) {
    const perNote = new Map<string, Observation>();
    for (const i of n.items) {
      if (i.unitPriceCents <= 0) continue;
      const productKey = `${n.storeCnpj}:${i.storeCode}`;
      perNote.set(productKey, {
        productKey, description: i.description, storeName: n.storeName, cnpj: n.storeCnpj,
        date: dateOf(n), unitPriceCents: i.unitPriceCents, unit: i.unit,
      });
    }
    out.push(...perNote.values());
  }
  return out.sort((a, b) => a.date.localeCompare(b.date));
}

/** Produtos comprados mais de uma vez no mesmo mercado, com a variação do primeiro ao último preço. */
export function priceChanges(notes: SavedNote[]): PriceChange[] {
  const by = new Map<string, Observation[]>();
  for (const o of observations(notes)) by.set(o.productKey, [...(by.get(o.productKey) ?? []), o]);
  const res: PriceChange[] = [];
  for (const [productKey, history] of by) {
    if (history.length < 2) continue;
    const first = history[0]!;
    const last = history[history.length - 1]!;
    res.push({
      productKey, description: last.description, storeName: last.storeName,
      firstCents: first.unitPriceCents, lastCents: last.unitPriceCents,
      pct: (last.unitPriceCents - first.unitPriceCents) / first.unitPriceCents, history,
    });
  }
  return res;
}

/** Variação média dos produtos repetidos (média simples, cada produto pesa igual). */
export function averageChange(changes: PriceChange[]): number | null {
  if (changes.length === 0) return null;
  return changes.reduce((s, c) => s + c.pct, 0) / changes.length;
}

export interface MonthSpend { month: string; cents: number }

export function spendByMonth(notes: SavedNote[]): MonthSpend[] {
  const m = new Map<string, number>();
  for (const n of notes) {
    const key = dateOf(n).slice(0, 7);
    m.set(key, (m.get(key) ?? 0) + n.payableCents);
  }
  return [...m].map(([month, cents]) => ({ month, cents })).sort((a, b) => a.month.localeCompare(b.month));
}

export interface StoreSpend { storeName: string; cnpj: string; cents: number; notes: number }

export function spendByStore(notes: SavedNote[]): StoreSpend[] {
  const m = new Map<string, StoreSpend>();
  for (const n of notes) {
    const cur = m.get(n.storeCnpj) ?? { storeName: n.storeName, cnpj: n.storeCnpj, cents: 0, notes: 0 };
    cur.cents += n.payableCents;
    cur.notes += 1;
    m.set(n.storeCnpj, cur);
  }
  return [...m.values()].sort((a, b) => b.cents - a.cents);
}

/** Último preço de cada produto (mercado + código), pela data da nota. */
export function latestPrices(notes: SavedNote[]): Map<string, Observation> {
  const m = new Map<string, Observation>();
  for (const o of observations(notes)) m.set(o.productKey, o); // já ordenado por data
  return m;
}

/** Últimos preços dos produtos vinculados, do mais barato ao mais caro. */
export function pricesForKeys(keys: string[], notes: SavedNote[]): Observation[] {
  const latest = latestPrices(notes);
  return keys.flatMap((k) => latest.get(k) ?? []).sort((a, b) => a.unitPriceCents - b.unitPriceCents);
}

export type Verdict =
  | { kind: "unknown" }
  | { kind: "best"; best: Observation; savingCents: number }
  | { kind: "worse"; best: Observation; extraCents: number; extraPct: number };

/** Compara o preço da etiqueta com o menor último preço que o usuário já pagou. */
export function verdict(shelfCents: number, known: Observation[]): Verdict {
  const best = known[0];
  if (!best) return { kind: "unknown" };
  if (shelfCents <= best.unitPriceCents) return { kind: "best", best, savingCents: best.unitPriceCents - shelfCents };
  const extra = shelfCents - best.unitPriceCents;
  return { kind: "worse", best, extraCents: extra, extraPct: extra / best.unitPriceCents };
}
