/** "12,90", "12.90" ou "1.234,50" → centavos; null se inválido. */
export function parseMoney(s: string): number | null {
  const t = s.trim().replace(/^R\$\s*/i, "");
  if (!t) return null;
  const norm = /,/.test(t) ? t.replace(/\./g, "").replace(",", ".") : t;
  if (!/^\d+(\.\d{1,2})?$/.test(norm)) return null;
  const c = Math.round(Number(norm) * 100);
  return c > 0 ? c : null;
}
