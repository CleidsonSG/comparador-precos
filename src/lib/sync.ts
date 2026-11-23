// Sincronização: o aparelho é o cache (funciona sem internet); a conta guarda tudo.
// Ordem: envia a fila de alterações, depois baixa o estado da conta.
import { FunctionsHttpError } from "@supabase/supabase-js";
import { loadCart, replaceCart } from "./cart.ts";
import { loadLinks, replaceLinks } from "./links.ts";
import { activeUser, dataOwner, enqueue, loadOutbox, saveOutbox, setActiveUser, setDataOwner, type Op } from "./outbox.ts";
import { loadNotes, replaceNotes } from "./storage.ts";
import { supabase } from "./supabase.ts";
import {
  SELECT_RECEIPTS, cartToRow, firstLoginUploads, linkToRow, notesAfterPull, rowToCart, rowToLink, rowToNote,
  type CartRow, type LinkRow, type ReceiptRow,
} from "./syncMerge.ts";

export type SyncState = "off" | "idle" | "syncing" | "offline" | "error";
export interface SyncStatus { state: SyncState; message?: string; lastAt?: string; pending: number; rejected: Rejected[] }
export interface Rejected { accessKey: string; reason: string }

const REJECTED = "gondola.sync.rejected.v1";
const LAST = "gondola.sync.last.v1";

function readRejected(): Rejected[] {
  try { return JSON.parse(localStorage.getItem(REJECTED) ?? "[]") as Rejected[]; } catch { return []; }
}
function writeRejected(r: Rejected[]): void {
  try { if (r.length) localStorage.setItem(REJECTED, JSON.stringify(r)); else localStorage.removeItem(REJECTED); } catch { /* ignora */ }
}

function readLast(): string | undefined {
  try { return localStorage.getItem(LAST) ?? undefined; } catch { return undefined; }
}
let status: SyncStatus = { state: "off", pending: loadOutbox().length, rejected: readRejected(), lastAt: readLast() };
const subs = new Set<(s: SyncStatus) => void>();
function setStatus(p: Partial<SyncStatus>): void {
  status = { ...status, pending: loadOutbox().length, rejected: readRejected(), ...p };
  subs.forEach((f) => f(status));
}
export const getStatus = (): SyncStatus => status;
export function subscribe(f: (s: SyncStatus) => void): () => void {
  subs.add(f);
  return () => subs.delete(f);
}

/** Erro que não adianta repetir (nota recusada, dado inválido): sai da fila. */
class Permanent extends Error {}

async function apply(op: Op): Promise<void> {
  const sb = supabase!;
  if (op.t === "note.save") {
    const { error } = await sb.functions.invoke("save-receipt", { body: { note: op.note } });
    if (error) {
      if (error instanceof FunctionsHttpError) {
        const res = error.context as Response;
        const body = await res.json().catch(() => ({})) as { error?: string; details?: string[] };
        if (res.status === 422 || res.status === 413 || res.status === 400) {
          throw new Permanent([body.error, ...(body.details ?? [])].filter(Boolean).join(" "));
        }
      }
      throw error;
    }
    writeRejected(readRejected().filter((r) => r.accessKey !== op.note.accessKey));
    return;
  }
  let res: { error: { code?: string; message: string } | null };
  if (op.t === "note.delete") res = await sb.from("receipts").delete().eq("access_key", op.accessKey);
  else if (op.t === "link.save") res = await sb.from("product_links").upsert(linkToRow(op.link));
  else if (op.t === "link.delete") res = await sb.from("product_links").delete().eq("barcode", op.barcode);
  else {
    const rows = op.items.map(cartToRow);
    if (rows.length) {
      const up = await sb.from("cart_items").upsert(rows);
      if (up.error) throw up.error;
      res = await sb.from("cart_items").delete().not("id", "in", `(${rows.map((r) => r.id).join(",")})`);
    } else {
      res = await sb.from("cart_items").delete().not("id", "is", null);
    }
  }
  // 23xxx = dado inválido (constraint); 42501 = sem permissão: não adianta repetir
  if (res.error) throw res.error.code?.startsWith("23") || res.error.code === "42501" ? new Permanent(res.error.message) : res.error;
}

async function flush(): Promise<void> {
  for (;;) {
    const ops = loadOutbox();
    if (!ops.length) return;
    const op = ops[0];
    try {
      await apply(op);
    } catch (e) {
      if (!(e instanceof Permanent)) throw e;
      if (op.t === "note.save") {
        writeRejected([...readRejected().filter((r) => r.accessKey !== op.note.accessKey), { accessKey: op.note.accessKey, reason: e.message }]);
      }
    }
    // tira da fila só a operação tratada (a fila pode ter mudado enquanto enviava)
    const done = JSON.stringify(op);
    saveOutbox(loadOutbox().filter((o) => JSON.stringify(o) !== done));
  }
}

async function fetchRemote() {
  const sb = supabase!;
  const [r, l, c] = await Promise.all([
    sb.from("receipts").select(SELECT_RECEIPTS).order("issued_at", { ascending: true }),
    sb.from("product_links").select("barcode, name, keys, confirmed_at"),
    sb.from("cart_items").select("id, barcode, name, qty, shelf_cents, store_cnpj, store_name").order("created_at"),
  ]);
  if (r.error) throw r.error;
  if (l.error) throw l.error;
  if (c.error) throw c.error;
  return {
    notes: (r.data as unknown as ReceiptRow[]).map(rowToNote),
    links: (l.data as LinkRow[]).map(rowToLink),
    cart: (c.data as CartRow[]).map(rowToCart),
  };
}

async function pull(): Promise<void> {
  const remote = await fetchRemote();
  if (loadOutbox().length) return; // houve alteração enquanto baixava: a próxima rodada resolve
  const keep = new Set(readRejected().map((r) => r.accessKey));
  const before = JSON.stringify([loadNotes(), loadLinks(), loadCart()]);
  replaceNotes(notesAfterPull(loadNotes(), remote.notes, keep));
  replaceLinks(remote.links);
  replaceCart(remote.cart);
  if (JSON.stringify([loadNotes(), loadLinks(), loadCart()]) !== before) window.dispatchEvent(new Event("gondola:data"));
}

const isNetwork = (e: unknown) =>
  !navigator.onLine || (e instanceof Error && /fetch|network|Failed to send|Load failed/i.test(e.message));

let running: Promise<void> | null = null;
let again = false;
/** Envia a fila e baixa a conta. Chamadas simultâneas viram uma só (com mais uma rodada se preciso). */
export function syncNow(): Promise<void> {
  if (running) { again = true; return running; }
  running = (async () => {
    do {
      again = false;
      if (!supabase || !activeUser()) { setStatus({ state: "off" }); return; }
      if (!navigator.onLine) { setStatus({ state: "offline" }); return; }
      setStatus({ state: "syncing", message: undefined });
      try {
        await flush();
        await pull();
        const at = new Date().toISOString();
        try { localStorage.setItem(LAST, at); } catch { /* ignora */ }
        setStatus({ state: "idle", lastAt: at });
      } catch (e) {
        setStatus(isNetwork(e) ? { state: "offline" } : { state: "error", message: e instanceof Error ? e.message : "Erro ao sincronizar." });
        return;
      }
    } while (again);
  })().finally(() => { running = null; });
  return running;
}

function clearLocal(): void {
  replaceNotes([]);
  replaceLinks([]);
  replaceCart([]);
  saveOutbox([]);
  writeRejected([]);
  try { localStorage.removeItem(LAST); } catch { /* ignora */ }
  window.dispatchEvent(new Event("gondola:data"));
}

/** Depois do login: decide o que fazer com os dados já guardados no aparelho. */
export async function afterSignIn(userId: string): Promise<void> {
  const owner = dataOwner();
  if (owner && owner !== userId) clearLocal(); // dados de outra conta não vão para esta
  setActiveUser(userId);
  setDataOwner(userId);
  if (activeUser() !== userId) return;
  try {
    const remote = await fetchRemote();
    const up = firstLoginUploads(
      { notes: loadNotes(), links: loadLinks(), cart: loadCart() },
      { noteKeys: new Set(remote.notes.map((n) => n.accessKey)), links: remote.links, cart: remote.cart },
    );
    up.notes.forEach((note) => enqueue({ t: "note.save", note }));
    up.links.forEach((link) => enqueue({ t: "link.save", link }));
    if (up.cart) enqueue({ t: "cart.replace", items: up.cart });
  } catch {
    // sem rede agora: sobe tudo o que está no aparelho; a conta ignora notas repetidas
    loadNotes().forEach((note) => enqueue({ t: "note.save", note }));
    loadLinks().forEach((link) => enqueue({ t: "link.save", link }));
  }
  await syncNow();
}

export async function signOut(keepOnDevice: boolean): Promise<void> {
  if (navigator.onLine) await syncNow().catch(() => undefined);
  await supabase?.auth.signOut();
  setActiveUser(null);
  if (!keepOnDevice) { clearLocal(); setDataOwner(null); }
  setStatus({ state: "off" });
}

/** Liga a sincronização automática: ao abrir, ao voltar a internet, ao mudar algo e ao voltar para o app. */
export function startAutoSync(): () => void {
  if (!supabase) return () => undefined;
  let t: number | undefined;
  const soon = () => { window.clearTimeout(t); t = window.setTimeout(() => void syncNow(), 800); };
  const onVis = () => { if (document.visibilityState === "visible") soon(); };
  const onOffline = () => setStatus({ state: activeUser() ? "offline" : "off" });
  const onQueue = () => setStatus({});
  const { data } = supabase.auth.onAuthStateChange((event, session) => {
    // sem await aqui: chamadas ao Supabase dentro deste callback podem travar
    if (event === "INITIAL_SESSION" || event === "SIGNED_IN") {
      if (session && activeUser() === session.user.id) soon();
      else if (session) {
        // entrou pelo link do e-mail (ou a sessão existe sem o aparelho saber): prepara os dados desta conta
        const id = session.user.id;
        window.setTimeout(() => {
          if (activeUser() === id) return; // o login por código já tratou
          void afterSignIn(id).then(() => window.dispatchEvent(new Event("gondola:signedin")));
        }, 0);
      } else if (event === "INITIAL_SESSION" && activeUser()) { setActiveUser(null); setStatus({ state: "off" }); }
    }
    if (event === "SIGNED_OUT") { setActiveUser(null); setStatus({ state: "off" }); }
  });
  window.addEventListener("online", soon);
  window.addEventListener("offline", onOffline);
  window.addEventListener("gondola:changed", soon);
  window.addEventListener("gondola:outbox", onQueue);
  document.addEventListener("visibilitychange", onVis);
  return () => {
    data.subscription.unsubscribe();
    window.removeEventListener("online", soon);
    window.removeEventListener("offline", onOffline);
    window.removeEventListener("gondola:changed", soon);
    window.removeEventListener("gondola:outbox", onQueue);
    document.removeEventListener("visibilitychange", onVis);
  };
}
