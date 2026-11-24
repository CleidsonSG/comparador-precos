// Build de produção em /comparador-precos/: service worker, abrir sem internet, compartilhar com o app e manifesto.
import { readFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";
import { distort, fakeQrUrl, qrPng } from "./helpers.ts";

const LAYOUT = readFileSync("tests/fixtures/nfce-rj/atacadao-marica-2026-11-13.layout.txt", "utf8");

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("gondola.install.dismissed", "teste"));
});

/** Espera o service worker assumir a página (primeira visita). */
async function swReady(page: Page) {
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
    if (!navigator.serviceWorker.controller) await new Promise((r) => navigator.serviceWorker.addEventListener("controllerchange", r, { once: true }));
  });
}

test("manifesto: ícones PNG, maskable, tela cheia e compartilhar", async ({ request, baseURL }) => {
  const m = await (await request.get(`${baseURL}manifest.webmanifest`)).json();
  expect(m.display).toBe("standalone");
  const sizes = m.icons.filter((i: { type: string }) => i.type === "image/png").map((i: { sizes: string; purpose: string }) => `${i.sizes}:${i.purpose}`);
  expect(sizes).toEqual(expect.arrayContaining(["192x192:any", "512x512:any", "512x512:maskable"]));
  for (const i of m.icons) expect((await request.get(`${baseURL}${i.src}`)).ok()).toBe(true);
  expect(m.share_target.action).toBe("./compartilhar");
  expect(m.share_target.method).toBe("POST");
});

test("depois da primeira visita, abre e lê QR sem internet", async ({ page, context }) => {
  await page.goto("./#inicio");
  await swReady(page);
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole("heading", { name: "Início", level: 1 })).toBeVisible();
  await expect(page.getByText("Sem internet.")).toBeVisible();

  await page.goto("./#importar");
  const img = await distort(page, await qrPng(fakeQrUrl(), "M", 8), { width: 1000, type: "jpeg" });
  await page.getByLabel("Enviar foto do QR").setInputFiles({ name: "qr.jpg", mimeType: "image/jpeg", buffer: img });
  await expect(page.getByText("Chave válida do RJ")).toBeVisible({ timeout: 30_000 });
  await context.setOffline(false);
});

test("compartilhar o texto da nota com o app guarda a nota (sem enviar ao servidor)", async ({ page }) => {
  await page.goto("./#inicio");
  await swReady(page);
  // simula o Android: envio POST multipart para ./compartilhar, como o menu Compartilhar faz
  await page.evaluate((text) => {
    const f = document.createElement("form");
    f.method = "POST"; f.enctype = "multipart/form-data"; f.action = "compartilhar";
    const t = document.createElement("textarea"); t.name = "text"; t.value = text; f.append(t);
    document.body.append(f); f.submit();
  }, LAYOUT);
  await expect(page.getByText("Nota guardada", { exact: true })).toBeVisible({ timeout: 15_000 });
  // o servidor de arquivos não aceita POST: se a nota foi guardada, quem atendeu foi o service worker, no aparelho
  expect(page.url()).toMatch(/#importar$/);
});
