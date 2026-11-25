// Importar a página da "Consulta completa" baixada no celular (.mht). Nota de teste já sem destinatário,
// pagamento e informações adicionais; o CPF usado aqui é inventado e montado só no teste.
import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";

const MHT = readFileSync("tests/fixtures/nfce-rj/atacadao-marica-2026-11-13.completa.mht", "utf8");
const notes = (page: import("@playwright/test").Page) => page.evaluate(() => JSON.parse(localStorage.getItem("gondola.notes.v1") || "[]"));

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("gondola.install.dismissed", "teste"));
});

test("página baixada da consulta completa guarda a nota com o código de barras e sem o consumidor", async ({ page }) => {
  const cpf = ["123", "456", "789"].join(".") + "-09";
  const dest = `<div class="nft" id="aba_nft_2"><div class="GeralXslt" op="1" id="DestRem"><fieldset><legend class="titulo-aba">Dados do Destinatário</legend><table><tbody><tr><td><label>CPF</label><span>${cpf}</span></td><td><label>Nome / Razão Social</label><span>FULANO DE TAL</span></td></tr></tbody></table></fieldset></div></div>`;
  const mht = MHT.replace('<div class="nft" id="aba_nft_3">', `${dest}<div class="nft" id="aba_nft_3">`);
  expect(mht).toContain(cpf);
  await page.goto("/#importar");
  // o Android costuma entregar o .mht sem tipo
  await page.locator('#passo3 input[type="file"]').setInputFiles({ name: "Consulta documento fiscal eletrônico.mht", mimeType: "", buffer: Buffer.from(mht) });
  const dialog = page.getByRole("dialog", { name: "Nota importada" });
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText("49 itens");
  await expect(dialog).toContainText("45 de 49 com código de barras");
  const saved = await notes(page);
  expect(saved).toHaveLength(1);
  expect(saved[0].parserVersion).toBe("rj-completa-1");
  expect(saved[0].payableCents).toBe(90369);
  expect(saved[0].items.find((i: { storeCode: string }) => i.storeCode === "84331").gtin).toBe("7898542029886");
  const raw = await page.evaluate(() => localStorage.getItem("gondola.notes.v1"));
  expect(raw).not.toContain(cpf);
  expect(raw).not.toContain("12345678909");
  expect(raw).not.toContain("FULANO");
  await expect(page.locator("#texto")).toHaveValue("");
});

test("caixa Nota importada espera o toque no botão (não fecha com Esc nem com toque fora)", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 780 });
  await page.goto("/#importar");
  await page.locator('#passo3 input[type="file"]').setInputFiles({ name: "nota.mht", mimeType: "", buffer: Buffer.from(MHT) });
  const dialog = page.getByRole("dialog", { name: "Nota importada" });
  await expect(dialog).toBeVisible();
  await page.keyboard.press("Escape");
  await page.mouse.click(8, 8); // fora da caixa
  await page.mouse.click(350, 770);
  await page.waitForTimeout(800);
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "OK" }).click();
  await expect(dialog).toBeHidden();
});

test("página da consulta resumida pede a consulta completa", async ({ page }) => {
  const resumida = "From: <Saved by Blink>\r\nMIME-Version: 1.0\r\nContent-Type: multipart/related;\r\n\ttype=\"text/html\";\r\n\tboundary=\"--b--\"\r\n\r\n----b--\r\nContent-Type: text/html\r\nContent-Transfer-Encoding: binary\r\n\r\n<html><body><h1>Consulta DF-e</h1><a>Consulta completa</a></body></html>\r\n----b----\r\n";
  await page.goto("/#importar");
  await page.locator('#passo3 input[type="file"]').setInputFiles({ name: "Consulta DF-e.mht", mimeType: "multipart/related", buffer: Buffer.from(resumida) });
  await expect(page.getByRole("alert")).toContainText("toque em Consulta completa");
  expect(await notes(page)).toHaveLength(0);
});
