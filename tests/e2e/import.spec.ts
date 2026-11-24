// Importar: chave pendente, próximo passo, colar ao voltar da Fazenda e guardar sozinho quando a soma confere.
// Usa só a nota de exemplo anonimizada (CPF e nome "[removido]") e chaves inventadas.
import { readFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";
import { distort, fakeKey, fakeQrUrl, qrPng } from "./helpers.ts";

const LAYOUT = readFileSync("tests/fixtures/nfce-rj/atacadao-marica-2026-11-13.layout.txt", "utf8"); // soma confere
const RAW = readFileSync("tests/fixtures/nfce-rj/atacadao-marica-2026-11-13.raw.txt", "utf8"); // soma não conferida
const FIXTURE_KEY = (/(\d{4}\s?){11}/.exec(LAYOUT.slice(LAYOUT.indexOf("Chave de acesso")))?.[0] ?? "").replace(/\D/g, "");

async function pasteInField(page: Page, text: string) {
  await page.locator("#texto").fill(text);
  await page.getByRole("button", { name: "Ler texto" }).click();
}

test.describe("importar nota", () => {
test.beforeEach(async ({ page }) => {
  // não abre o convite de instalação nestes testes
  await page.addInitScript(() => localStorage.setItem("gondola.install.dismissed", "teste"));
});

test("QR lido: chave fica pendente, próximo passo aparece e dá para continuar por Notas", async ({ page }) => {
  await page.goto("/#importar");
  const img = await distort(page, await qrPng(fakeQrUrl(), "M", 8), { width: 1000, type: "jpeg" });
  await page.getByLabel("Enviar foto do QR").setInputFiles({ name: "qr.jpg", mimeType: "image/jpeg", buffer: img });
  await expect(page.getByText("Chave válida do RJ")).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText("Próximo passo: toque em")).toBeVisible();
  await expect(page.getByText("Chave guardada em Notas como pendente")).toBeVisible();

  await page.goto("/#notas");
  await expect(page.getByRole("heading", { name: "Pendentes" })).toBeVisible();
  await expect(page.getByText("falta trazer os itens")).toBeVisible();
  await page.getByRole("link", { name: "Continuar" }).click();
  await expect(page.getByText("Chave válida do RJ")).toBeVisible();
  await expect(page.getByText(fakeKey().slice(0, 4))).toBeVisible();

  await page.goto("/#notas");
  await page.getByRole("button", { name: "Descartar" }).click();
  await expect(page.getByRole("heading", { name: "Pendentes" })).toHaveCount(0);
});

test("texto com soma conferida é guardado sozinho; Desfazer volta para a revisão", async ({ page }) => {
  await page.goto("/#importar");
  await pasteInField(page, LAYOUT);
  await expect(page.getByText("Nota guardada", { exact: true })).toBeVisible();
  await expect(page.getByText("A soma dos itens conferiu com o total")).toBeVisible();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("gondola.notes.v1") || "[]").length)).toBe(1);
  // nada de CPF ou nome guardado
  expect(await page.evaluate(() => localStorage.getItem("gondola.notes.v1"))).not.toMatch(/removido|CPF/i);

  await page.getByRole("button", { name: "Desfazer" }).click();
  await expect(page.getByRole("heading", { name: "Confira a nota" })).toBeVisible();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("gondola.notes.v1") || "[]").length)).toBe(0);
  await page.getByRole("button", { name: "Guardar nota" }).click();
  await expect(page.getByText("Nota guardada", { exact: true })).toBeVisible();
});

test("texto sem soma conferida mostra a revisão e não guarda sozinho", async ({ page }) => {
  await page.goto("/#importar");
  await pasteInField(page, RAW);
  await expect(page.getByRole("heading", { name: "Confira a nota" })).toBeVisible();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("gondola.notes.v1") || "[]").length)).toBe(0);
});

test("voltar da Fazenda oferece colar e guarda a nota", async ({ page, context }) => {
  expect(FIXTURE_KEY).toHaveLength(44);
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  // não acessa a Fazenda de verdade no teste
  await context.route(/fazenda\.rj\.gov\.br/, (r) => r.fulfill({ contentType: "text/html", body: "<p>consulta (teste)</p>" }));
  await page.goto("/#importar");
  await page.locator("#chave").fill(FIXTURE_KEY);
  await page.getByRole("button", { name: "Usar esta chave" }).click();
  const popupP = page.waitForEvent("popup");
  await page.getByRole("link", { name: "Abrir consulta da Fazenda" }).click();
  const popup = await popupP;
  await popup.close();
  await page.bringToFront();
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await expect(page.getByRole("heading", { name: "Trouxe a nota da Fazenda?" })).toBeVisible();
  await page.evaluate((t) => navigator.clipboard.writeText(t), LAYOUT);
  await page.getByRole("button", { name: "Colar agora" }).click();
  await expect(page.getByText("Nota guardada", { exact: true })).toBeVisible();
  await page.goto("/#notas");
  await expect(page.getByRole("heading", { name: "Pendentes" })).toHaveCount(0);
});

test("nota de outra chave é recusada", async ({ page }) => {
  await page.goto("/#importar");
  await page.locator("#chave").fill(fakeKey());
  await page.getByRole("button", { name: "Usar esta chave" }).click();
  await pasteInField(page, LAYOUT);
  await expect(page.getByText("Esta nota não é a da chave informada")).toBeVisible();
});

test("sem internet: faixa no topo e consulta da Fazenda desativada", async ({ page, context }) => {
  await page.goto("/#importar");
  await page.locator("#chave").fill(FIXTURE_KEY);
  await page.getByRole("button", { name: "Usar esta chave" }).click();
  await context.setOffline(true);
  await expect(page.getByText("Sem internet. Mostrando o que está guardado no aparelho")).toBeVisible();
  await expect(page.getByText("A consulta da Fazenda precisa de internet")).toBeVisible();
  await expect(page.getByRole("link", { name: "Abrir consulta da Fazenda" })).toHaveAttribute("aria-disabled", "true");
  await context.setOffline(false);
  await expect(page.getByText("Sem internet.")).toHaveCount(0);
});

});

test("convite de instalação: aparece na primeira visita, Instalar chama o Chrome e não volta", async ({ page }) => {
  await page.addInitScript(() => {
    (window as unknown as { __prompted: number }).__prompted = 0;
    // simula o aviso do Chrome (o Playwright não instala apps de verdade)
    window.addEventListener("load", () => {
      const e = new Event("beforeinstallprompt") as Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };
      e.prompt = async () => { (window as unknown as { __prompted: number }).__prompted++; };
      e.userChoice = Promise.resolve({ outcome: "accepted" });
      window.dispatchEvent(e);
    });
  });
  await page.goto("/#inicio");
  await expect(page.getByRole("dialog", { name: "Instalar o Gôndola como app" })).toBeVisible();
  await page.getByRole("button", { name: "Instalar", exact: true }).click();
  expect(await page.evaluate(() => (window as unknown as { __prompted: number }).__prompted)).toBe(1);
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.reload();
  await page.waitForTimeout(500);
  await expect(page.getByRole("dialog")).toHaveCount(0);
});
