import test from "node:test";
import assert from "node:assert/strict";
import { averageChange, priceChanges, spendByMonth, spendByStore } from "./analytics.ts";
import type { SavedNote } from "../../lib/storage.ts";

const item = (code: string, price: number, line = 1) => ({ line, description: `P${code}`, storeCode: code, quantity: 1, unit: "UN", unitRaw: "UN", unitPriceCents: price, totalCents: price });
const note = (key: string, cnpj: string, date: string, pay: number, items: ReturnType<typeof item>[]): SavedNote => ({
  accessKey: key, savedAt: date, storeName: `Loja ${cnpj}`, storeCnpj: cnpj, storeAddress: "", issuedAt: date, number: "1", series: "1",
  totalCents: pay, discountCents: 0, payableCents: pay, validated: true, parserVersion: "t", items,
});

const notes = [
  note("a", "111", "2026-10-05T10:00:00", 10000, [item("1", 1000), item("2", 500)]),
  note("b", "111", "2026-11-10T10:00:00", 12000, [item("1", 1100), item("2", 500), item("3", 900)]),
  note("c", "222", "2026-11-12T10:00:00", 3000, [item("1", 700)]),
];

test("variação só para produto repetido no mesmo mercado", () => {
  const ch = priceChanges(notes);
  assert.equal(ch.length, 2);
  const p1 = ch.find((c) => c.productKey === "111:1")!;
  assert.equal(Math.round(p1.pct * 1000), 100);
  assert.equal(ch.find((c) => c.productKey === "111:2")!.pct, 0);
  assert.equal(averageChange(ch), 0.05);
});

test("mesmo código em outro mercado não se mistura", () => {
  assert.equal(priceChanges(notes).some((c) => c.productKey === "222:1"), false);
});

test("gasto por mês e por mercado", () => {
  assert.deepEqual(spendByMonth(notes), [{ month: "2026-10", cents: 10000 }, { month: "2026-11", cents: 15000 }]);
  const s = spendByStore(notes);
  assert.equal(s[0]!.cnpj, "111");
  assert.equal(s[0]!.cents, 22000);
  assert.equal(s[0]!.notes, 2);
});

test("sem repetição não há média", () => {
  assert.equal(averageChange(priceChanges([notes[0]!])), null);
});
