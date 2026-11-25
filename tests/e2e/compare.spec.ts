import { readFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";
import { parseRjConsultaText } from "../../src/modules/nfce/uf/rj/parseConsultaText.ts";

// Notas de teste sem CPF e sem nome: Atacadão simulada (20/11) e Supermarket fictício (22/11), 9 produtos em comum.
function note(file: string) {
  const r = parseRjConsultaText(readFileSync(`tests/fixtures/nfce-rj/${file}`, "utf8"));
  return {
    accessKey: r.note!.accessKey!, savedAt: "2026-11-24T12:00:00Z", storeName: r.store!.name, storeCnpj: r.store!.cnpj,
    storeAddress: r.store!.address, issuedAt: r.note!.issuedAt, number: r.note!.number, series: r.note!.series,
    totalCents: r.totals.totalCents!, discountCents: r.totals.discountCents!, payableCents: r.totals.payableCents!,
    validated: r.validated, parserVersion: r.parserVersion, items: r.items,
  };
}
const NOTES = [note("atacadao-marica-2026-11-20.simulada.celular.txt"), note("supermarket-marica-2026-11-22.celular.txt")];

async function seed(page: Page) {
  await page.addInitScript((notes) => {
    if (!localStorage.getItem("gondola.notes.v1")) localStorage.setItem("gondola.notes.v1", JSON.stringify(notes));
  }, NOTES);
}

test("sugere vínculos, compara a cesta comum e desfaz um vínculo", async ({ page }) => {
  await seed(page);
  await page.goto("/#comparar");
  await expect(page.getByRole("heading", { name: "Vincule os produtos iguais" })).toBeVisible();
  await page.getByRole("link", { name: "Ver sugestões de vínculo" }).click();

  const accept = page.getByRole("button", { name: "É o mesmo, vincular" });
  await expect(accept).toHaveCount(9);
  // recusa uma (biscoito não está entre elas: só os 9 em comum) e aceita as outras
  await page.getByRole("button", { name: "Não é" }).first().click();
  await expect(accept).toHaveCount(8);
  await page.getByRole("button", { name: /Mostrar de novo/ }).click();
  await expect(accept).toHaveCount(9);
  for (let i = 0; i < 9; i++) await accept.first().click();
  await expect(accept).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Vínculos (9)" })).toBeVisible();

  await page.getByRole("link", { name: "Comparação" }).click();
  const cesta = page.locator("section", { has: page.getByRole("heading", { name: "Cesta comum" }) });
  await expect(cesta).toContainText("9 produtos vinculados");
  await expect(cesta).toContainText("R$ 287,29"); // Atacadão
  await expect(cesta).toContainText("R$ 294,43"); // Supermarket
  await expect(cesta).toContainText("R$ 279,75"); // cada produto onde é mais barato
  await expect(cesta.locator(".pill.good")).toHaveText("mais barato");
  await expect(page.locator("table.cmp tbody tr")).toHaveCount(9);
  await expect(page.locator("table.cmp td.best")).toHaveCount(9);

  // gráfico por mês: tabela acessível com os dois mercados
  await page.getByRole("button", { name: "Ver tabela" }).click();
  await expect(page.getByRole("table", { name: /Preço por mês/ })).toContainText("R$");

  // desfaz um vínculo
  await page.getByRole("link", { name: "Revisar vínculos" }).click();
  await page.getByRole("button", { name: "Revisar" }).first().click();
  await page.getByRole("button", { name: "Desfazer vínculo" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Desfazer vínculo" }).click();
  await expect(page.getByRole("link", { name: "Vínculos (8)" })).toBeVisible();
  // o par desfeito volta como sugestão
  await expect(page.getByRole("button", { name: "É o mesmo, vincular" })).toHaveCount(1);
});

test("vincula à mão, tira um item e guarda o código de barras", async ({ page }) => {
  await seed(page);
  await page.goto("/#vinculos");
  await page.getByRole("button", { name: "Abrir" }).click();
  await page.getByLabel("Buscar nas suas notas").fill("arroz");
  const items = page.getByRole("group", { name: "Itens ainda sem vínculo" }).getByRole("checkbox");
  await expect(items).toHaveCount(2);
  await items.nth(0).check();
  await items.nth(1).check();
  await page.getByLabel("Nome do produto").fill("Arroz Ouro 5 kg");
  await page.getByRole("button", { name: "Confirmar que é o mesmo produto" }).click();

  const item = page.locator(".noteitem", { hasText: "Arroz Ouro 5 kg" });
  await expect(item).toContainText("sem código de barras, 2 itens");
  await item.getByRole("button", { name: "Revisar" }).click();
  await item.getByLabel(/Código de barras/).fill("7896006716112");
  await item.getByRole("button", { name: "Guardar código" }).click();
  await expect(item).toContainText("código 7896006716112");
  await item.getByRole("button", { name: "Revisar" }).click();
  await item.getByRole("button", { name: /^Tirar/ }).first().click();
  await expect(item).toContainText("1 item");

  // o código guardado funciona em Escanear
  await page.goto("/#escanear");
  await page.getByLabel("Ou digite o código de barras").fill("7896006716112");
  await page.getByRole("button", { name: "Usar código" }).click();
  await expect(page.getByRole("heading", { name: "Arroz Ouro 5 kg" })).toBeVisible();
});

test("sem notas de dois mercados mostra o que falta", async ({ page }) => {
  await page.addInitScript((n) => { if (!localStorage.getItem("gondola.notes.v1")) localStorage.setItem("gondola.notes.v1", JSON.stringify([n])); }, NOTES[0]);
  await page.goto("/#comparar");
  await expect(page.getByRole("heading", { name: "Falta a nota de outro mercado" })).toBeVisible();
});
