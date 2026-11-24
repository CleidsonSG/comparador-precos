import { test } from "node:test";
import assert from "node:assert/strict";
import { accountSummary } from "./format.ts";

test("resumo da conta: vazia não diz que há algo guardado", () => {
  assert.equal(accountSummary(0, 0, 0), "Nenhuma nota, vínculo ou item de carrinho na conta.");
});

test("resumo da conta: singular e plural", () => {
  assert.equal(accountSummary(1, 0, 2), "Na conta: 1 nota, 0 produtos vinculados e 2 itens no carrinho.");
  assert.equal(accountSummary(3, 1, 1), "Na conta: 3 notas, 1 produto vinculado e 1 item no carrinho.");
});
