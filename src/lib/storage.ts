import type { RjItem } from "../modules/nfce/uf/rj/parseConsultaText.ts";
import { enqueue } from "./outbox.ts";

export interface SavedNote {
  accessKey: string;
  savedAt: string;
  storeName: string;
  storeCnpj: string;
  storeAddress: string;
  issuedAt: string | null;
  number: string;
  series: string;
  totalCents: number;
  discountCents: number;
  payableCents: number;
  validated: boolean;
  parserVersion: string;
  items: RjItem[];
}

const KEY = "gondola.notes.v1";

export function loadNotes(): SavedNote[] {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as SavedNote[]) : [];
  } catch {
    return [];
  }
}

export function hasNote(accessKey: string): boolean {
  return loadNotes().some((n) => n.accessKey === accessKey);
}

/** Grava a lista inteira sem enfileirar (usado pela sincronização). */
export function replaceNotes(all: SavedNote[]): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(all));
  } catch {
    throw new Error("Não foi possível guardar no aparelho (armazenamento cheio ou bloqueado).");
  }
}

export function saveNote(n: SavedNote): void {
  replaceNotes([...loadNotes().filter((x) => x.accessKey !== n.accessKey), n]);
  enqueue({ t: "note.save", note: n });
}

export function removeNote(accessKey: string): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(loadNotes().filter((n) => n.accessKey !== accessKey)));
  } catch {
    /* ignora */
  }
  enqueue({ t: "note.delete", accessKey });
}
