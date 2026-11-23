import { test } from "node:test";
import assert from "node:assert/strict";
import { accessKeyIsValid, validateReceipt, type ReceiptIn } from "./validate.ts";

// Gera uma chave válida (DV correto) para o CNPJ e número dados. Dados sintéticos.
function key(cnpj: string, number = "000000123"): string {
  const base = `33` + `2611` + cnpj + `65` + `001` + number + `1` + `12345678`;
  let sum = 0, w = 2;
  for (let i = 42; i >= 0; i--) { sum += Number(base[i]) * w; w = w === 9 ? 2 : w + 1; }
  const r = sum % 11;
  return base + String(r === 0 || r === 1 ? 0 : 11 - r);
}

const CNPJ = "11222333000144";
const good = (): ReceiptIn => ({
  accessKey: key(CNPJ), savedAt: "2026-11-20T10:00:00Z", storeName: "MERCADO TESTE LTDA", storeCnpj: CNPJ,
  storeAddress: "RUA A , 1 , , CENTRO , RIO DE JANEIRO , RJ", issuedAt: "2026-11-20T09:00:00-03:00",
  number: "123", series: "1", totalCents: 3500, discountCents: 0, payableCents: 3500, validated: true, parserVersion: "rj-text-1",
  items: [
    { line: 1, description: "ARROZ 5KG", storeCode: "10", quantity: 1, unit: "UND", unitRaw: "UND9", unitPriceCents: 2500, totalCents: 2500 },
    { line: 2, description: "CAFE 500G", storeCode: "20", quantity: 1, unit: "UND", unitRaw: "UND9", unitPriceCents: 1000, totalCents: 1000 },
  ],
});

test("chave sintética tem DV válido", () => assert.equal(accessKeyIsValid(key(CNPJ)), true));

test("aceita nota válida e informa o estado", () => {
  const r = validateReceipt(good());
  assert.equal(r.ok, true);
  if (r.ok) assert.equal(r.value.uf, "RJ");
});

test("recusa CNPJ diferente da chave", () => {
  const r = validateReceipt({ ...good(), storeCnpj: "99888777000166" });
  assert.equal(r.ok, false);
});

test("recusa soma errada quando a nota foi conferida", () => {
  const n = good();
  n.totalCents = 9999;
  assert.equal(validateReceipt(n).ok, false);
  n.validated = false;
  assert.equal(validateReceipt(n).ok, true);
});

test("recusa CPF ou consumidor em qualquer texto", () => {
  const n = good();
  n.items[0].description = "CONSUMIDOR CPF 123.456.789-09";
  const r = validateReceipt(n);
  assert.equal(r.ok, false);
  if (!r.ok) assert.ok(r.errors.some((e) => e.includes("dados pessoais")));
});

test("recusa itens malformados e lixo", () => {
  assert.equal(validateReceipt(null).ok, false);
  assert.equal(validateReceipt({ ...good(), items: [] }).ok, false);
  const n = good();
  (n.items[0] as unknown as { unitPriceCents: number }).unitPriceCents = -5;
  assert.equal(validateReceipt(n).ok, false);
});
