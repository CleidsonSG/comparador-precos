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
