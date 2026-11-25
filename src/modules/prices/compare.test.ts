import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { parseRjConsultaText } from "../nfce/uf/rj/parseConsultaText.ts";
import type { SavedNote } from "../../lib/storage.ts";
import type { ProductLink } from "../../lib/links.ts";
import { compareMarkets, monthlyByMarket, similarity, suggestLinks } from "./compare.ts";

// Notas de teste sem CPF e sem nome: Atacadão simulada (20/11) e Supermarket fictício (22/11)
const dir = new URL("../../../tests/fixtures/nfce-rj/", import.meta.url);
function note(file: string): SavedNote {
  const r = parseRjConsultaText(readFileSync(new URL(file, dir), "utf8"));
  assert.equal(r.ok, true);
  return {
    accessKey: r.note!.accessKey!, savedAt: "2026-11-24T00:00:00Z", storeName: r.store!.name, storeCnpj: r.store!.cnpj,
    storeAddress: r.store!.address, issuedAt: r.note!.issuedAt, number: r.note!.number, series: r.note!.series,
    totalCents: r.totals.totalCents!, discountCents: r.totals.discountCents!, payableCents: r.totals.payableCents!,
    validated: r.validated, parserVersion: r.parserVersion, items: r.items,
  };
}
const ATA = "75315333031926", SUP = "48273615000118";
const notes = [note("atacadao-marica-2026-11-20.simulada.celular.txt"), note("supermarket-marica-2026-11-22.celular.txt")];
const link = (name: string, keys: string[]): ProductLink => ({ barcode: "29" + String(keys.length).padStart(12, "0"), name, keys, confirmedAt: "2026-11-24T00:00:00Z" });

test("semelhança aceita abreviações da nota", () => {
  assert.ok(similarity("ARROZ OURO B.AGUL.", "ARROZ T1 OURO B.AGULHA 5KG") >= 0.6);
  assert.ok(similarity("AZEITE GALLO VDO", "AZEITE EV GALLO VD 500ML") >= 0.6);
  assert.ok(similarity("CAFE BOM DIA TRAD.", "CAFE MELITTA TRAD 500G") < 0.6); // marcas diferentes
});

test("sugere os 9 produtos em comum e nenhum outro", () => {
  const s = suggestLinks(notes, []);
  assert.equal(s.length, 9);
  for (const x of s) {
    assert.equal(x.to.kind, "product");
    if (x.to.kind === "product") assert.notEqual(x.from.cnpj, x.to.obs.cnpj);
  }
  const codes = s.flatMap((x) => [x.from.productKey, x.to.kind === "product" ? x.to.obs.productKey : ""]);
  for (const c of ["84331", "69203", "49829", "69657", "95627", "7081", "76907", "40211", "18833"]) assert.ok(codes.includes(`${ATA}:${c}`), c);
});

test("sugestão recusada não volta; produto já vinculado vira sugestão para o vínculo", () => {
  const all = suggestLinks(notes, []);
  const cafe = all.find((x) => x.from.description.includes("CAFE") || (x.to.kind === "product" && x.to.obs.description.includes("CAFE")))!;
  assert.equal(suggestLinks(notes, [], [cafe.id]).length, 8);
  const s = suggestLinks(notes, [link("Café Melitta", [`${ATA}:49829`])]);
  const toLink = s.filter((x) => x.to.kind === "link");
  assert.equal(toLink.length, 1);
  assert.equal(toLink[0]!.from.productKey, `${SUP}:100422`);
});

test("compara só vinculados: preço por mercado, mais barato e cesta comum", () => {
  const links = [
    link("Café Melitta", [`${ATA}:49829`, `${SUP}:100422`]), // 24,50 x 22,98
    link("Leite Ninho", [`${ATA}:95627`, `${SUP}:100771`]), // 49,90 x 52,90
    link("Bacon", [`${ATA}:3985`]), // só no Atacadão: fora da cesta comum
  ];
  const c = compareMarkets(links, notes);
  assert.deepEqual(c.markets.map((m) => m.cnpj), [ATA, SUP]);
  assert.equal(c.rows.length, 3);
  assert.equal(c.rows.find((r) => r.link.name === "Café Melitta")!.cheapest, SUP);
  assert.equal(c.rows.find((r) => r.link.name === "Leite Ninho")!.cheapest, ATA);
  assert.equal(c.rows.find((r) => r.link.name === "Bacon")!.cheapest, null);
  assert.equal(c.common.count, 2);
  assert.deepEqual(c.common.totals, [{ cnpj: ATA, cents: 2450 + 4990 }, { cnpj: SUP, cents: 2298 + 5290 }]);
  assert.equal(c.common.bestMixCents, 2298 + 4990);
});

test("sem vínculos não há comparação", () => {
  const c = compareMarkets([], notes);
  assert.equal(c.rows.length, 0);
  assert.equal(c.common.count, 0);
});

test("preço por mês, uma série por mercado", () => {
  const l = link("Café Melitta", [`${ATA}:49829`, `${SUP}:100422`]);
  const c = compareMarkets([l], notes);
  const m = monthlyByMarket(l, notes, c.markets);
  assert.deepEqual(m.months, ["2026-11"]);
  assert.deepEqual(m.series.map((s) => s.values), [[2450], [2298]]);
});
