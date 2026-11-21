const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
export const money = (cents: number): string => brl.format(cents / 100);
export const formatCnpj = (c: string): string => c.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5");
export function formatDateTime(iso: string | null): string {
  if (!iso) return "data não informada";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}
export const formatQty = (q: number): string => String(q).replace(".", ",");
