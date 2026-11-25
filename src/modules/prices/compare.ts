// Comparação entre mercados usando SÓ produtos vinculados pelo usuário (vínculo confirmado, nunca automático).
import type { SavedNote } from "../../lib/storage.ts";
import type { ProductLink } from "../../lib/links.ts";
import { observations, type Observation } from "./analytics.ts";

export interface Market { cnpj: string; name: string }

export interface CompareRow {
  link: ProductLink;
  /** último preço do produto em cada mercado (CNPJ) */
  byMarket: Record<string, Observation>;
  /** CNPJ do mercado mais barato, só se houver preço em 2+ mercados e um único menor preço */
  cheapest: string | null;
}

export interface BasketTotal { cnpj: string; cents: number }

export interface Comparison {
  /** mercados com pelo menos um produto vinculado, em ordem fixa (nome); a cor segue o mercado */
  markets: Market[];
  rows: CompareRow[];
  /** cesta comum: produtos com preço em TODOS os mercados escolhidos */
  common: { count: number; totals: BasketTotal[]; bestMixCents: number };
}

const marketOf = (k: string) => k.slice(0, k.indexOf(":"));

/** Nome mais recente de cada mercado, em ordem alfabética (ordem estável para as cores). */
export function marketsOf(notes: SavedNote[]): Market[] {
  const m = new Map<string, { name: string; at: string }>();
  for (const n of notes) {
    const at = n.issuedAt ?? n.savedAt;
    const cur = m.get(n.storeCnpj);
    if (!cur || at > cur.at) m.set(n.storeCnpj, { name: n.storeName, at });
  }
  return [...m].map(([cnpj, v]) => ({ cnpj, name: v.name })).sort((a, b) => a.name.localeCompare(b.name) || a.cnpj.localeCompare(b.cnpj));
}

/** Compara os mercados escolhidos (padrão: todos com produto vinculado). */
export function compareMarkets(links: ProductLink[], notes: SavedNote[], only?: string[]): Comparison {
  const obs = observations(notes); // ordenado por data
  const latest = new Map<string, Observation>();
  for (const o of obs) latest.set(o.productKey, o);

  const rows: CompareRow[] = [];
  const used = new Set<string>();
  for (const link of links) {
    const byMarket: Record<string, Observation> = {};
    for (const k of link.keys) {
      const o = latest.get(k);
      if (!o || (only && !only.includes(o.cnpj))) continue;
      const cur = byMarket[o.cnpj];
      if (!cur || o.date > cur.date) byMarket[o.cnpj] = o; // dois códigos no mesmo mercado: vale o mais recente
    }
    const ms = Object.keys(byMarket);
    if (ms.length === 0) continue;
    ms.forEach((c) => used.add(c));
    let cheapest: string | null = null;
    if (ms.length > 1) {
      const sorted = ms.map((c) => byMarket[c]!).sort((a, b) => a.unitPriceCents - b.unitPriceCents);
      if (sorted[0]!.unitPriceCents < sorted[1]!.unitPriceCents) cheapest = sorted[0]!.cnpj;
    }
    rows.push({ link, byMarket, cheapest });
  }
  rows.sort((a, b) => a.link.name.localeCompare(b.link.name));

  const markets = marketsOf(notes).filter((m) => used.has(m.cnpj));
  const inAll = markets.length > 1 ? rows.filter((r) => markets.every((m) => r.byMarket[m.cnpj])) : [];
  const totals = markets.map((m) => ({ cnpj: m.cnpj, cents: inAll.reduce((s, r) => s + r.byMarket[m.cnpj]!.unitPriceCents, 0) }));
  const bestMixCents = inAll.reduce((s, r) => s + Math.min(...markets.map((m) => r.byMarket[m.cnpj]!.unitPriceCents)), 0);
  return { markets, rows, common: { count: inAll.length, totals, bestMixCents } };
}

export interface MonthSeries { market: Market; values: (number | null)[] }

/** Preço médio por mês de um produto vinculado, uma série por mercado (null = sem compra no mês). */
export function monthlyByMarket(link: ProductLink, notes: SavedNote[], markets: Market[]): { months: string[]; series: MonthSeries[] } {
  const keys = new Set(link.keys);
  const acc = new Map<string, { s: number; n: number }>(); // "cnpj|AAAA-MM"
  const months = new Set<string>();
  for (const o of observations(notes)) {
    if (!keys.has(o.productKey)) continue;
    const m = o.date.slice(0, 7);
    months.add(m);
    const id = `${o.cnpj}|${m}`;
    const cur = acc.get(id) ?? { s: 0, n: 0 };
    cur.s += o.unitPriceCents; cur.n += 1;
    acc.set(id, cur);
  }
  const ms = [...months].sort();
  const series = markets
    .map((market) => ({ market, values: ms.map((m) => { const a = acc.get(`${market.cnpj}|${m}`); return a ? Math.round(a.s / a.n) : null; }) }))
    .filter((s) => s.values.some((v) => v !== null));
  return { months: ms, series };
}

// ---------- Sugestões de vínculo (o usuário sempre confirma) ----------

const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
export const tokens = (s: string): string[] => norm(s).split(/[^a-z0-9]+/).filter(Boolean);

/** "agul" ~ "agulha", "gr" ~ "grandes": uma palavra é o começo da outra. Números só se iguais. */
function same(a: string, b: string): boolean {
  if (a === b) return true;
  if (/\d/.test(a) || /\d/.test(b)) return false;
  const [s, l] = a.length <= b.length ? [a, b] : [b, a];
  return s.length >= 2 && l.startsWith(s);
}

/** Semelhança entre descrições (0 a 1), coeficiente de Dice com palavras abreviadas. */
export function similarity(a: string, b: string): number {
  const A = tokens(a), B = [...tokens(b)];
  if (!A.length || !B.length) return 0;
  let m = 0;
  for (const t of A) {
    const i = B.findIndex((u) => same(t, u));
    if (i >= 0) { m++; B.splice(i, 1); }
  }
  return (2 * m) / (A.length + tokens(b).length);
}

export interface Suggestion {
  id: string; // chave estável para "não é o mesmo"
  from: Observation; // produto ainda sem vínculo
  /** outro produto sem vínculo (cria vínculo novo) ou um vínculo existente (acrescenta o produto) */
  to: { kind: "product"; obs: Observation } | { kind: "link"; link: ProductLink };
  score: number;
}

export const SUGGEST_MIN = 0.6;

/** Pares de produtos parecidos em mercados diferentes que ainda não foram vinculados. */
export function suggestLinks(notes: SavedNote[], links: ProductLink[], dismissed: string[] = []): Suggestion[] {
  const latest = new Map<string, Observation>();
  for (const o of observations(notes)) latest.set(o.productKey, o);
  const linked = new Set(links.flatMap((l) => l.keys));
  const free = [...latest.values()].filter((o) => !linked.has(o.productKey));
  const out: Suggestion[] = [];
  const taken = new Set<string>();

  // 1) produto sem vínculo que parece um vínculo existente de outro mercado
  for (const o of free) {
    let best: { link: ProductLink; score: number } | null = null;
    for (const l of links) {
      if (l.keys.some((k) => marketOf(k) === o.cnpj)) continue;
      const names = [l.name, ...l.keys.flatMap((k) => latest.get(k)?.description ?? [])];
      const score = Math.max(...names.map((n) => similarity(o.description, n)));
      if (score >= SUGGEST_MIN && (!best || score > best.score)) best = { link: l, score };
    }
    const id = best ? `${o.productKey}>${best.link.barcode}` : "";
    if (best && !dismissed.includes(id)) { out.push({ id, from: o, to: { kind: "link", link: best.link }, score: best.score }); taken.add(o.productKey); }
  }

  // 2) dois produtos sem vínculo, de mercados diferentes (cada um entra em uma sugestão só)
  const pairs: Suggestion[] = [];
  for (let i = 0; i < free.length; i++)
    for (let j = i + 1; j < free.length; j++) {
      const a = free[i]!, b = free[j]!;
      if (a.cnpj === b.cnpj || taken.has(a.productKey) || taken.has(b.productKey)) continue;
      const score = similarity(a.description, b.description);
      const [x, y] = a.productKey < b.productKey ? [a, b] : [b, a];
      const id = `${x.productKey}=${y.productKey}`;
      if (score >= SUGGEST_MIN && !dismissed.includes(id)) pairs.push({ id, from: x, to: { kind: "product", obs: y }, score });
    }
  pairs.sort((p, q) => q.score - p.score);
  for (const p of pairs) {
    const b = p.to.kind === "product" ? p.to.obs.productKey : "";
    if (taken.has(p.from.productKey) || taken.has(b)) continue;
    taken.add(p.from.productKey); taken.add(b);
    out.push(p);
  }
  return out.sort((p, q) => p.from.description.localeCompare(q.from.description));
}
