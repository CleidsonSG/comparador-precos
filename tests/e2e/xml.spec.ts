// Importar o XML da nota. XML FICTÍCIO (Supermarket Teste), sem CPF e sem nome.
import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";

const XML = readFileSync("tests/fixtures/nfce-xml/supermarket-marica-2026-11-22.xml", "utf8");
const notes = (page: import("@playwright/test").Page) => page.evaluate(() => JSON.parse(localStorage.getItem("gondola.notes.v1") || "[]"));

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("gondola.install.dismissed", "teste"));
});

test("enviar o XML guarda a nota sozinha e não grava o consumidor", async ({ page }) => {
  // bloco do consumidor montado só aqui (dados inventados), para provar que é descartado
  const cpf = ["123", "456", "789", "09"].join("");
  const xml = XML.replace("<det ", `<dest><CPF>${cpf}</CPF><xNome>FULANO DE TAL</xNome></dest>\n<det `);
  await page.goto("/#importar");
  await page.locator('#passo3 input[type="file"]').setInputFiles({ name: "nota.xml", mimeType: "text/xml", buffer: Buffer.from(xml) });
  await expect(page.getByRole("dialog", { name: "Nota importada" })).toBeVisible();
  await expect(page.getByRole("dialog")).toContainText("Supermarket Teste");
  const saved = await notes(page);
  expect(saved).toHaveLength(1);
  expect(saved[0].items).toHaveLength(15);
  expect(saved[0].payableCents).toBe(38418);
  expect(saved[0].parserVersion).toBe("nfce-xml-1");
  const raw = await page.evaluate(() => localStorage.getItem("gondola.notes.v1"));
  expect(raw).not.toContain(cpf);
  expect(raw).not.toContain("FULANO");
  await expect(page.locator("#texto")).toHaveValue("");
});

test("XML colado no campo de texto também é lido", async ({ page }) => {
  await page.goto("/#importar");
  await page.locator("#texto").fill(XML);
  await page.getByRole("button", { name: "Ler texto" }).click();
  await expect(page.getByRole("dialog", { name: "Nota importada" })).toBeVisible();
  expect(await notes(page)).toHaveLength(1);
});

test("arquivo XML que não é nota mostra erro", async ({ page }) => {
  await page.goto("/#importar");
  await page.locator('#passo3 input[type="file"]').setInputFiles({ name: "outro.xml", mimeType: "text/xml", buffer: Buffer.from("<?xml version=\"1.0\"?><lista><item>1</item></lista>") });
  await expect(page.getByRole("alert")).toContainText("não é o XML de uma nota fiscal");
  expect(await notes(page)).toHaveLength(0);
});
