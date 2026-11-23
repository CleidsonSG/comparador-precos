import { test } from "node:test";
import assert from "node:assert/strict";
import { coalesce, type Op } from "./outbox.ts";
import { firstLoginUploads, notesAfterPull, rowToNote, type ReceiptRow } from "./syncMerge.ts";
import type { SavedNote } from "./storage.ts";

const note = (k: string): SavedNote => ({
  accessKey: k, savedAt: "2026-11-01T00:00:00Z", storeName: "M", storeCnpj: "11222333000144", storeAddress: "", issuedAt: null,
  number: "1", series: "1", totalCents: 100, discountCents: 0, payableCents: 100, validated: true, parserVersion: "rj-text-1", items: [],
});

test("linha do banco vira nota do aparelho, itens em ordem", () => {
  const row: ReceiptRow = {
    access_key: "33261111222333000144650010000000011123456789", issued_at: "2026-11-01T10:00:00-03:00", total_cents: 300,
    discount_cents: 0, payable_cents: 300, number: "1", series: "1", validated: true, parser_version: "rj-text-1",
    saved_at: "2026-11-01T13:00:00Z", stores: { cnpj: "11222333000144", name: "MERCADO", address: "RUA A" },
    receipt_items: [
      { line: 2, description: "B", store_code: "2", quantity: 1, unit: "UND", unit_raw: "UND9", unit_price_cents: 200, total_cents: 200 },
      { line: 1, description: "A", store_code: "1", quantity: 1.5, unit: "KG", unit_raw: "KG9", unit_price_cents: 67, total_cents: 100 },
    ],
  };
  const n = rowToNote(row);
  assert.equal(n.storeCnpj, "11222333000144");
  assert.deepEqual(n.items.map((i) => i.description), ["A", "B"]);
  assert.equal(n.items[0].quantity, 1.5);
  assert.equal(n.items[0].storeCode, "1");
});

test("depois de sincronizar: vale a conta, mas guarda notas recusadas ou na fila", () => {
  const out = notesAfterPull([note("a"), note("b"), note("c")], [note("a"), note("d")], new Set(["c"]));
  assert.deepEqual(out.map((n) => n.accessKey).sort(), ["a", "c", "d"]); // b foi apagada em outro aparelho
});

test("primeiro login sobe só o que falta na conta", () => {
  const up = firstLoginUploads(
    {
      notes: [note("a"), note("b")],
      links: [{ barcode: "7891", name: "x", keys: ["k"], confirmedAt: "2026-11-02" }, { barcode: "7892", name: "y", keys: ["k"], confirmedAt: "2026-11-01" }],
      cart: [{ id: "c1", barcode: "7891", name: "x", qty: 1, shelfCents: 100, storeCnpj: "", storeName: "" }],
    },
    {
      noteKeys: new Set(["a"]),
      links: [{ barcode: "7892", name: "y2", keys: ["k"], confirmedAt: "2026-11-05" }],
      cart: [{ id: "c0", barcode: "7892", name: "y", qty: 2, shelfCents: 50, storeCnpj: "", storeName: "" }],
    },
  );
  assert.deepEqual(up.notes.map((n) => n.accessKey), ["b"]);
  assert.deepEqual(up.links.map((l) => l.barcode), ["7891"]); // o 7892 da conta é mais novo
  assert.deepEqual(up.cart?.map((c) => c.id), ["c0", "c1"]);
});

test("fila descarta operações substituídas", () => {
  let q: Op[] = [];
  q = coalesce(q, { t: "cart.replace", items: [] });
  q = coalesce(q, { t: "note.save", note: note("a") });
  q = coalesce(q, { t: "cart.replace", items: [] });
  q = coalesce(q, { t: "note.delete", accessKey: "a" });
  q = coalesce(q, { t: "link.save", link: { barcode: "1", name: "n", keys: ["k"], confirmedAt: "" } });
  q = coalesce(q, { t: "link.delete", barcode: "1" });
  assert.deepEqual(q.map((o) => o.t), ["cart.replace", "note.delete", "link.delete"]);
});
