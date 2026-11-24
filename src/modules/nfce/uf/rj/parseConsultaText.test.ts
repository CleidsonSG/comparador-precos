import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { parseRjConsultaText } from "./parseConsultaText.ts";

const dir = new URL("../../../../../tests/fixtures/nfce-rj/", import.meta.url);
const load = (n: string) => readFileSync(new URL(n, dir), "utf8");

// raw: texto do PDF; layout: copiado no computador; celular: copiado no Chrome do celular ("Vl. Total" no fim da linha da quantidade)
for (const layout of ["raw", "layout", "celular"]) {
  test(`lê a nota do RJ (${layout})`, () => {
    const r = parseRjConsultaText(load(`atacadao-marica-2026-11-13.${layout}.txt`));
    assert.deepEqual(r.errors, []);
    assert.equal(r.ok, true);
    assert.equal(r.items.length, 49);
    // o texto "raw" veio do PDF sem os valores dos totais: lê os itens, mas não consegue validar a soma
    assert.equal(r.validated, layout !== "raw");
    if (layout !== "raw") {
      assert.equal(r.totals.totalCents, 91464);
      assert.equal(r.totals.discountCents, 1095);
      assert.equal(r.totals.payableCents, 90369);
    }
    assert.equal(r.items.reduce((a, i) => a + i.totalCents, 0), 91464);
    assert.equal(r.store?.cnpj, "75315333031926");
    assert.equal(r.store?.name, "ATACADAO S.A.");
    assert.equal(r.note?.number, "131002");
    assert.equal(r.note?.series, "506");
    assert.equal(r.note?.issuedAt, "2026-11-13T19:08:16-03:00");
    const arroz = r.items.find((i) => i.storeCode === "69203");
    assert.equal(arroz?.description, "ARROZ OURO B.AGUL.");
    assert.equal(arroz?.unitPriceCents, 2050);
    const bacon = r.items.find((i) => i.storeCode === "3985");
    assert.equal(bacon?.quantity, 1.42);
    assert.equal(bacon?.unit, "KG");
    assert.equal(bacon?.totalCents, 5677);
    assert.equal(r.items.find((i) => i.storeCode === "14191")?.unitRaw, "UND7");
  });
}

test("detecta total adulterado", () => {
  const bad = load("atacadao-marica-2026-11-13.layout.txt").replace("914,64", "900,00");
  const r = parseRjConsultaText(bad);
  assert.equal(r.ok, false);
  assert.ok(r.errors.some((e) => e.includes("Soma dos itens")));
});

test("detecta item perdido", () => {
  const raw = load("atacadao-marica-2026-11-13.layout.txt").split("\n");
  const i = raw.findIndex((l) => l.startsWith("BISC.CAPRICCHE"));
  raw.splice(i, 2);
  const r = parseRjConsultaText(raw.join("\n"));
  assert.equal(r.ok, false);
});

test("nunca devolve CPF", () => {
  const withCpf = load("atacadao-marica-2026-11-13.layout.txt").replace("CPF: [removido]", "CPF: 123.456.789-09");
  const r = parseRjConsultaText(withCpf);
  assert.equal(JSON.stringify(r).includes("123.456.789-09"), false);
  assert.equal(r.ok, true);
});

test("texto sem nota retorna erro, não exceção", () => {
  const r = parseRjConsultaText("qualquer coisa");
  assert.equal(r.ok, false);
  assert.ok(r.errors.length > 0);
});
