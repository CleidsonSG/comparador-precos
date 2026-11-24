/// <reference lib="webworker" />
// Service worker do Gôndola: o app abre e funciona sem internet depois da primeira visita.
// Guarda só os arquivos do próprio app e as fontes. Nunca guarda dados da conta (Supabase)
// nem páginas da Fazenda: essas requisições passam direto pela rede.
import { cleanupOutdatedCaches, createHandlerBoundToURL, precacheAndRoute } from "workbox-precaching";
import { NavigationRoute, registerRoute } from "workbox-routing";
import { CacheFirst, StaleWhileRevalidate } from "workbox-strategies";
import { ExpirationPlugin } from "workbox-expiration";
import { CacheableResponsePlugin } from "workbox-cacheable-response";
import { clientsClaim } from "workbox-core";
import { SHARE_CACHE, SHARE_FILE, SHARE_TEXT } from "./lib/shareKeys.ts";

declare const self: ServiceWorkerGlobalScope;

precacheAndRoute(self.__WB_MANIFEST);
cleanupOutdatedCaches();
// primeira instalação: já assume a página aberta (funciona sem internet sem precisar recarregar).
// Versões novas continuam esperando o toque em "Atualizar" (SKIP_WAITING).
clientsClaim();

const BASE = new URL(self.registration.scope);

// Compartilhar com o app (Android): o envio é atendido aqui, no aparelho, e nunca chega ao servidor.
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== "POST" || url.origin !== BASE.origin || url.pathname !== new URL("compartilhar", BASE).pathname) return;
  event.respondWith((async () => {
    try {
      const form = await event.request.formData();
      const parts = ["title", "text", "url"].map((k) => form.get(k)).filter((v): v is string => typeof v === "string" && !!v.trim());
      const file = form.getAll("nota").find((f): f is File => f instanceof File && f.size > 0);
      const cache = await caches.open(SHARE_CACHE);
      if (file) await cache.put(new URL(SHARE_FILE, BASE).href, new Response(file, { headers: { "content-type": file.type || "application/pdf", "x-name": encodeURIComponent(file.name) } }));
      if (parts.length) await cache.put(new URL(SHARE_TEXT, BASE).href, new Response(parts.join("\n")));
    } catch { /* envio inválido: só abre o app */ }
    return Response.redirect(new URL("#importar?compartilhado", BASE).href, 303);
  })());
});

// Telas: qualquer endereço do app abre o index.html guardado (o app usa #rotas).
registerRoute(new NavigationRoute(createHandlerBoundToURL("index.html")));

// Fontes do Google: CSS revalidado, arquivos de fonte guardados por um ano.
registerRoute(({ url }) => url.origin === "https://fonts.googleapis.com", new StaleWhileRevalidate({ cacheName: "fontes-css" }));
registerRoute(
  ({ url }) => url.origin === "https://fonts.gstatic.com",
  new CacheFirst({
    cacheName: "fontes",
    plugins: [new CacheableResponsePlugin({ statuses: [0, 200] }), new ExpirationPlugin({ maxEntries: 20, maxAgeSeconds: 365 * 24 * 3600 })],
  }),
);

// Versão nova: só troca quando a pessoa toca em "Atualizar" (não muda o app no meio do uso).
self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") void self.skipWaiting();
});
