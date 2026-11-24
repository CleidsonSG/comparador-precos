// Conteúdo compartilhado com o app pelo menu "Compartilhar" do Android (app instalado).
// O service worker recebe o envio, guarda aqui (no próprio aparelho) e abre #importar?compartilhado.
// Nada sai do aparelho: o envio é atendido pelo service worker, não pelo servidor.

import { SHARE_CACHE, SHARE_FILE, SHARE_TEXT } from "./shareKeys.ts";

export interface Shared { text?: string; file?: File }

/** Lê e apaga o que foi compartilhado (uma vez só). */
export async function takeShared(): Promise<Shared | null> {
  if (!("caches" in window)) return null;
  try {
    const cache = await caches.open(SHARE_CACHE);
    const base = new URL(import.meta.env.BASE_URL, location.origin);
    const tUrl = new URL(SHARE_TEXT, base).href;
    const fUrl = new URL(SHARE_FILE, base).href;
    const [t, f] = await Promise.all([cache.match(tUrl), cache.match(fUrl)]);
    const out: Shared = {};
    if (t) out.text = await t.text();
    if (f) {
      const blob = await f.blob();
      out.file = new File([blob], decodeURIComponent(f.headers.get("x-name") || "nota.pdf"), { type: blob.type || "application/pdf" });
    }
    await Promise.all([cache.delete(tUrl), cache.delete(fUrl)]);
    return out.text || out.file ? out : null;
  } catch {
    return null;
  }
}
