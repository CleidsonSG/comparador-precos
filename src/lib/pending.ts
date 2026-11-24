// Notas pendentes: chave lida (QR, foto ou digitada) cujos itens ainda não foram trazidos da consulta.
// Ficam só no aparelho. A chave não tem dado pessoal (UF, data, CNPJ do mercado, número da nota).
import { hasNote } from "./storage.ts";

export interface PendingNote {
  accessKey: string;
  /** link do QR, quando a chave veio dele (abre a consulta já na nota) */
  qrText: string | null;
  readAt: string;
}

const KEY = "gondola.pending.v1";

function read(): PendingNote[] {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as PendingNote[]) : [];
  } catch {
    return [];
  }
}

function write(all: PendingNote[]): void {
  try { localStorage.setItem(KEY, JSON.stringify(all)); } catch { /* sem armazenamento: segue sem pendentes */ }
}

/** Pendentes ainda sem nota guardada, mais recentes primeiro. */
export function loadPending(): PendingNote[] {
  const all = read();
  const open = all.filter((p) => !hasNote(p.accessKey));
  if (open.length !== all.length) write(open);
  return open.sort((a, b) => b.readAt.localeCompare(a.readAt));
}

export function addPending(accessKey: string, qrText: string | null): void {
  if (hasNote(accessKey)) return;
  const old = read().find((p) => p.accessKey === accessKey);
  write([...read().filter((p) => p.accessKey !== accessKey), { accessKey, qrText: qrText ?? old?.qrText ?? null, readAt: new Date().toISOString() }]);
}

export function getPending(accessKey: string): PendingNote | undefined {
  return read().find((p) => p.accessKey === accessKey);
}

export function removePending(accessKey: string): void {
  write(read().filter((p) => p.accessKey !== accessKey));
}
