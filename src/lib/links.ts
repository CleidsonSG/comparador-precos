// Vínculo confirmado pelo usuário: código de barras → produtos das notas (mercado + código interno).
// Nunca é automático: sem GTIN na nota, só o usuário confirma que os itens são o mesmo produto.
import { enqueue } from "./outbox.ts";

export interface ProductLink {
  barcode: string;
  name: string;
  keys: string[]; // "cnpj:codigoInterno"
  confirmedAt: string;
}

const KEY = "gondola.links.v1";

export const isBarcode = (s: string): boolean => /^\d{8,14}$/.test(s);

// Vínculo feito sem código de barras (tela de vínculos): recebe um número interno de 14 dígitos começando
// por "29", faixa que não circula em produtos no Brasil (prefixo 789/790). Assim o banco não precisa mudar.
export const isManualId = (s: string): boolean => /^29\d{12}$/.test(s);
export function manualId(existing: string[]): string {
  for (;;) {
    const n = crypto.getRandomValues(new Uint32Array(2));
    const id = "29" + String(n[0]! % 1e6).padStart(6, "0") + String(n[1]! % 1e6).padStart(6, "0");
    if (!existing.includes(id)) return id;
  }
}

export function loadLinks(): ProductLink[] {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as ProductLink[]) : [];
  } catch {
    return [];
  }
}

export function findLink(barcode: string): ProductLink | undefined {
  return loadLinks().find((l) => l.barcode === barcode);
}

/** Grava a lista inteira sem enfileirar (usado pela sincronização). */
export function replaceLinks(all: ProductLink[]): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(all));
  } catch {
    throw new Error("Não foi possível guardar o vínculo (armazenamento cheio ou bloqueado).");
  }
}

export function saveLink(l: ProductLink): void {
  replaceLinks([...loadLinks().filter((x) => x.barcode !== l.barcode), l]);
  enqueue({ t: "link.save", link: l });
}

export function removeLink(barcode: string): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(loadLinks().filter((l) => l.barcode !== barcode)));
  } catch {
    /* ignora */
  }
  enqueue({ t: "link.delete", barcode });
}
