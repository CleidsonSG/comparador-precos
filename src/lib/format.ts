const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
export const money = (cents: number): string => brl.format(cents / 100);
export const formatCnpj = (c: string): string => c.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5");
export function formatDateTime(iso: string | null): string {
  if (!iso) return "data não informada";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}
export const formatQty = (q: number): string => String(q).replace(".", ",");

/** Nomes da nota vêm em MAIÚSCULAS: "ARROZ OURO B.AGUL. 5KG" -> "Arroz ouro b.agul. 5kg" (só para exibir). */
export function sentenceCase(s: string): string {
  const t = s.trim().toLocaleLowerCase("pt-BR");
  return t.charAt(0).toLocaleUpperCase("pt-BR") + t.slice(1);
}
/** "SUPERMERCADO BOM PRECO LTDA" -> "Supermercado Bom Preco" (só para exibir). */
export function storeLabel(s: string): string {
  const base = s.replace(/\s+(S\.?\s?\/?A\.?|LTDA\.?|EIRELI|ME|EPP)\s*$/i, "").trim() || s.trim();
  return base.toLocaleLowerCase("pt-BR").replace(/(^|[\s(/-])(\p{L})/gu, (_, a: string, b: string) => a + b.toLocaleUpperCase("pt-BR"));
}

const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`;

/** O que há na conta (igual ao aparelho depois de sincronizar). */
export function accountSummary(notes: number, links: number, cart: number): string {
  if (notes === 0 && links === 0 && cart === 0) return "Nenhuma nota, vínculo ou item de carrinho na conta.";
  return `Na conta: ${plural(notes, "nota", "notas")}, ${plural(links, "produto vinculado", "produtos vinculados")} e ${plural(cart, "item", "itens")} no carrinho.`;
}
