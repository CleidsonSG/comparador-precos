import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { looksLikeNfceXml, parseNfceXml } from "./parseNfceXml.ts";
import { parseRjConsultaText } from "../uf/rj/parseConsultaText.ts";

// XML FICTÍCIO (mesma nota de supermarket-marica-2026-11-22.celular.txt), sem CPF e sem nome.
const fx = new URL("../../../../tests/fixtures/", import.meta.url);
const XML = readFileSync(new URL("nfce-xml/supermarket-marica-2026-11-22.xml", fx), "utf8");
const TXT = readFileSync(new URL("nfce-rj/supermarket-marica-2026-11-22.celular.txt", fx), "utf8");

test("lê o XML e confere a soma", () => {
  const r = parseNfceXml(XML);
  assert.deepEqual(r.errors, []);
  assert.equal(r.ok, true);
  assert.equal(r.validated, true);
  assert.equal(r.items.length, 15);
  assert.deepEqual(r.totals, { itemCount: 15, totalCents: 38718, discountCents: 300, payableCents: 38418 });
  assert.equal(r.note?.accessKey, "33261148273615000118650020000452181839204714");
  assert.equal(r.note?.issuedAt, "2026-11-22T10:15:33-03:00");
});

test("XML e texto da consulta dão o mesmo resultado (mesmo produto = mesmo código)", () => {
  const x = parseNfceXml(XML), t = parseRjConsultaText(TXT);
  assert.deepEqual(x.store, t.store);
  assert.deepEqual({ ...x.note }, { ...t.note });
  assert.deepEqual(x.totals, t.totals);
  assert.deepEqual(x.items, t.items);
});

test("nunca lê CPF nem nome do consumidor", () => {
  // dados pessoais inventados, montados só aqui, nunca gravados em arquivo
  const cpf = ["123", "456", "789", "09"].join("");
  const nome = ["FULANO", "DE", "TAL"].join(" ");
  const withDest = XML.replace("<det ", `<dest><CPF>${cpf}</CPF><xNome>${nome}</xNome><indIEDest>9</indIEDest></dest>\n<det `)
    .replace("</infNFe>", `<infAdic><infCpl>CPF DO CONSUMIDOR: ${cpf} ${nome}</infCpl></infAdic><autXML><CPF>${cpf}</CPF></autXML></infNFe>`);
  const r = parseNfceXml(withDest);
  assert.equal(r.ok, true);
  const out = JSON.stringify(r);
  assert.ok(!out.includes(cpf));
  assert.ok(!out.includes("FULANO"));
});

test("detecta total adulterado", () => {
  const r = parseNfceXml(XML.replace("<vProd>387.18</vProd>", "<vProd>390.00</vProd>"));
  assert.equal(r.ok, false);
  assert.match(r.errors.join(" "), /soma dos itens/);
});

test("recusa NF-e (modelo 55), chave inválida e arquivo que não é nota", () => {
  assert.match(parseNfceXml(XML.replace("<mod>65</mod>", "<mod>55</mod>")).errors.join(" "), /modelo 55/);
  assert.match(parseNfceXml(XML.replaceAll("39204714", "39204715")).errors.join(" "), /Chave/);
  assert.equal(parseNfceXml("<html><body>oi</body></html>").ok, false);
  assert.equal(looksLikeNfceXml("texto da consulta"), false);
});

test("aceita prefixo de namespace e entidades", () => {
  const pref = XML.replace(/<(\/?)(\w+)([\s>])/g, (m, s: string, t: string, e: string) => (t === "nfeProc" ? m : `<${s}nfe:${t}${e}`))
    .replace("CHARQUE JERKED BEEF DT 500G", "CHARQUE &amp; BEEF &#x2F; DT");
  const r = parseNfceXml(pref);
  assert.deepEqual(r.errors, []);
  assert.equal(r.items[0]?.description, "CHARQUE & BEEF / DT");
});

test("código de produto com letras é recusado com aviso claro (o servidor só aceita números)", () => {
  const r = parseNfceXml(XML.replace("<cProd>100245</cProd>", "<cProd>AB-100245</cProd>"));
  assert.equal(r.ok, false);
  assert.match(r.errors.join(" "), /tem letras/);
});
