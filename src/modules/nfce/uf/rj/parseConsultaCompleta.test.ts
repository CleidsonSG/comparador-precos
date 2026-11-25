import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { extractHtml, looksLikeConsultaCompleta, normalizeGtin, parseConsultaCompleta, RESUMIDA_MSG } from "./parseConsultaCompleta.ts";
import { parseRjConsultaText } from "./parseConsultaText.ts";

// Página da "Consulta completa" salva no Chrome do celular (.mht), já sem destinatário, pagamento e informações adicionais.
const dir = new URL("../../../../../tests/fixtures/nfce-rj/", import.meta.url);
const MHT = readFileSync(new URL("atacadao-marica-2026-11-13.completa.mht", dir), "utf8");
const TXT = readFileSync(new URL("atacadao-marica-2026-11-13.celular.txt", dir), "utf8");
const KEY = "33261175315333031926655060001310021048579170";

test("lê a consulta completa salva no celular (.mht) e confere a soma", () => {
  const r = parseConsultaCompleta(MHT);
  assert.deepEqual(r.errors, []);
  assert.equal(r.ok, true);
  assert.equal(r.validated, true);
  assert.equal(r.items.length, 49);
  assert.deepEqual(r.totals, { itemCount: 49, totalCents: 91464, discountCents: 1095, payableCents: 90369 });
  assert.equal(r.note?.accessKey, KEY);
  assert.equal(r.note?.issuedAt, "2026-11-13T19:08:16-03:00");
});

test("traz o código de barras (GTIN); itens a granel ficam sem", () => {
  const r = parseConsultaCompleta(MHT);
  assert.equal(r.items.filter((i) => i.gtin).length, 45);
  assert.equal(r.items.filter((i) => i.gtin === null).length, 4);
  assert.equal(r.items.find((i) => i.storeCode === "84331")?.gtin, "7898542029886"); // JERKED BEEF DT
  assert.equal(r.items.find((i) => i.storeCode === "3985")?.gtin, null); // BACON, por kg
});

test("dá o mesmo resultado que o texto da consulta resumida (mesmo produto = mesmo código)", () => {
  const c = parseConsultaCompleta(MHT), t = parseRjConsultaText(TXT);
  assert.deepEqual(c.store, t.store);
  assert.deepEqual(c.note, t.note);
  assert.deepEqual(c.items.map(({ gtin: _g, ...i }) => i), t.items);
  assert.deepEqual({ ...c.totals, itemCount: null }, { ...t.totals, itemCount: null });
});

test("nunca lê CPF, nome nem dados de pagamento", () => {
  // dados pessoais inventados, montados só aqui, nunca gravados em arquivo
  const cpf = ["123", "456", "789", "09"].join(".").replace(/\.(\d{2})$/, "-$1");
  const nome = ["FULANO", "DE", "TAL"].join(" ");
  const span = (l: string, v: string) => `<td><label>${l}</label><span>${v}</span></td>`;
  const dest = `<fieldset><legend>Destinatário</legend><table class="box"><tbody><tr>${span("CPF", cpf)}${span("Nome / Razão Social", nome)}</tr></tbody></table></fieldset>`;
  const destRem = `<div class="nft" id="aba_nft_2"><div class="GeralXslt" op="1" id="DestRem"><fieldset><legend class="titulo-aba">Dados do Destinatário</legend><table class="box"><tbody><tr>${span("Nome / Razão Social", nome)}${span("CPF", cpf)}${span("Endereço", "RUA DO FULANO, 10")}</tr></tbody></table></fieldset></div></div>`;
  const pag = `<div class="nft" id="aba_nft_6"><div class="GeralXslt" id="Cobranca"><div><table><tbody><tr>${span("Número de autorização", "885205")}</tr></tbody></table></div></div></div>`;
  const inf = `<div class="nft" id="aba_nft_7"><div class="GeralXslt" id="Inf"><div>${span("Descrição", `CPF NA NOTA ${cpf} ${nome}`)}</div></div></div>`;
  const withPersonal = MHT.replace(/(<fieldset><legend>Emissão<\/legend>)/, `${dest}$1`).replace(/(<div class="nft" id="aba_nft_3">)/, `${destRem}${pag}${inf}$1`)
    .replace("JERKED BEEF DT", `JERKED BEEF DT ${cpf}`); // CPF solto em qualquer lugar também some
  assert.ok(withPersonal.includes(cpf) && withPersonal.includes("Dados do Destinatário"));
  const r = parseConsultaCompleta(withPersonal);
  assert.equal(r.ok, true);
  const out = JSON.stringify(r);
  for (const s of [cpf, cpf.replace(/\D/g, ""), "FULANO", "885205", "RUA DO FULANO"]) assert.ok(!out.includes(s), s);
});

test("aceita a página em HTML (computador), em quoted-printable e a impressão do documento detalhado", () => {
  const html = extractHtml(MHT);
  assert.equal(parseConsultaCompleta(html).ok, true);

  const qp = html.replace(/[=\u0080-￿]/g, (c) => [...new TextEncoder().encode(c)].map((b) => "=" + b.toString(16).toUpperCase().padStart(2, "0")).join(""))
    .replace(/(.{70})/g, "$1=\r\n");
  const mhtQp = `From: <Saved by Blink>\r\nMIME-Version: 1.0\r\nContent-Type: multipart/related;\r\n\ttype="text/html";\r\n\tboundary="--b--"\r\n\r\n----b--\r\nContent-Type: text/html\r\nContent-Transfer-Encoding: quoted-printable\r\n\r\n${qp}\r\n----b----\r\n`;
  const r = parseConsultaCompleta(mhtQp);
  assert.deepEqual(r.errors, []);
  assert.equal(r.items.find((i) => i.storeCode === "69203")?.description, "ARROZ OURO B.AGUL.");

  // a impressão mostra a chave num cabeçalho próprio, fora de "Dados Gerais"
  const print = html.replace(/<label>Chave de Acesso<\/label><span>([^<]*)<\/span>/, "<b>Chave&nbsp;de&nbsp;Acesso:</b></td><td>$1");
  assert.equal(parseConsultaCompleta(print).note?.accessKey, KEY);
});

test("recusa a consulta resumida e páginas que não são a nota", () => {
  const resumida = "<html><body><h1>Consulta DF-e</h1><span>Chave de Acesso</span> 3326 1175 3153 3303 1926 6550 6000 1310 0210 4857 9170 <a>Consulta completa</a></body></html>";
  assert.deepEqual(parseConsultaCompleta(resumida).errors, [RESUMIDA_MSG]);
  assert.equal(looksLikeConsultaCompleta(resumida), false);
  assert.equal(parseConsultaCompleta("texto qualquer").ok, false);
});

test("detecta total adulterado, nota cancelada e NF-e modelo 55", () => {
  const adult = MHT.replace(/(Valor Total dos Produtos\s*<\/label><span>)914,640/, "$1920,000");
  assert.ok(adult !== MHT, "total não foi alterado");
  assert.match(parseConsultaCompleta(adult).errors.join(" "), /soma dos itens/);
  assert.match(parseConsultaCompleta(MHT.replace(/(Situação Atual:\s*)AUTORIZADA/, "$1CANCELADA")).errors.join(" "), /cancelada/);
  assert.match(parseConsultaCompleta(MHT.replace("<label>Modelo</label><span>65</span>", "<label>Modelo</label><span>55</span>")).errors.join(" "), /modelo 55/);
});

test("GTIN: confere o dígito verificador", () => {
  assert.equal(normalizeGtin("7898542029886"), "7898542029886");
  assert.equal(normalizeGtin("7898542029887"), null);
  assert.equal(normalizeGtin("SEM GTIN"), null);
  assert.equal(normalizeGtin("96385074"), "96385074"); // GTIN-8
  assert.equal(normalizeGtin("00000000"), null);
  assert.equal(normalizeGtin(undefined), null);
});
