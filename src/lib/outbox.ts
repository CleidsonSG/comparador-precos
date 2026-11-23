// Fila de alterações a enviar para a conta. Só enfileira quando há alguém logado neste aparelho;
// sem login o app continua funcionando só no aparelho.
import type { CartItem } from "./cart.ts";
import type { ProductLink } from "./links.ts";
import type { SavedNote } from "./storage.ts";

export type Op =
  | { t: "note.save"; note: SavedNote }
  | { t: "note.delete"; accessKey: string }
  | { t: "link.save"; link: ProductLink }
  | { t: "link.delete"; barcode: string }
  | { t: "cart.replace"; items: CartItem[] };

const QUEUE = "gondola.outbox.v1";
const ACTIVE = "gondola.sync.active.v1"; // usuário logado agora (enfileira)
const OWNER = "gondola.sync.owner.v1"; // de quem são os dados guardados no aparelho

function get(k: string): string | null {
  try { return localStorage.getItem(k); } catch { return null; }
}
function set(k: string, v: string | null): void {
  try { if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch { /* ignora */ }
}

export const activeUser = (): string | null => get(ACTIVE);
export const setActiveUser = (id: string | null): void => set(ACTIVE, id);
export const dataOwner = (): string | null => get(OWNER);
export const setDataOwner = (id: string | null): void => set(OWNER, id);

export function loadOutbox(): Op[] {
  try { return JSON.parse(get(QUEUE) ?? "[]") as Op[]; } catch { return []; }
}
export function saveOutbox(ops: Op[]): void {
  set(QUEUE, ops.length ? JSON.stringify(ops) : null);
  window.dispatchEvent(new Event("gondola:outbox"));
}

/** Junta a operação à fila, descartando as que ela torna inúteis. */
export function coalesce(ops: Op[], op: Op): Op[] {
  const same = (o: Op): boolean => {
    if (op.t === "cart.replace") return o.t === "cart.replace";
    if (op.t === "link.save" || op.t === "link.delete") {
      const b = op.t === "link.save" ? op.link.barcode : op.barcode;
      return (o.t === "link.save" && o.link.barcode === b) || (o.t === "link.delete" && o.barcode === b);
    }
    const k = op.t === "note.save" ? op.note.accessKey : op.accessKey;
    return (o.t === "note.save" && o.note.accessKey === k) || (o.t === "note.delete" && o.accessKey === k);
  };
  return [...ops.filter((o) => !same(o)), op];
}

export function enqueue(op: Op): void {
  if (activeUser()) saveOutbox(coalesce(loadOutbox(), op));
  window.dispatchEvent(new Event("gondola:changed")); // dados mudaram no aparelho (e pede sincronização, se houver conta)
}
