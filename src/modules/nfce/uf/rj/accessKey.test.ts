import { test } from "node:test";
import assert from "node:assert/strict";
import { extractAccessKey, isValidAccessKey, describeKey, officialConsultaUrl, RJ_CONSULTA_URL } from "../../../../lib/accessKey.ts";

const KEY = "33261175315333031926655060001310021048579170";

test("valida o dígito verificador", () => {
  assert.equal(isValidAccessKey(KEY), true);
  assert.equal(isValidAccessKey(KEY.slice(0, 43) + "1"), false);
  assert.equal(isValidAccessKey("123"), false);
});

test("extrai a chave de link de QR, texto com espaços, XML e dígitos soltos", () => {
  assert.equal(extractAccessKey(`https://consultadfe.fazenda.rj.gov.br/consultaNFCe/QRCode?p=${KEY}%7C2%7C1%7C1%7CABCDEF`), KEY);
  assert.equal(extractAccessKey(`http://www4.fazenda.rj.gov.br/consultaNFCe/QRCode?p=${KEY}|2|1|1|ABCDEF`), KEY);
  assert.equal(extractAccessKey("3326 1175 3153 3303 1926 6550 6000 1310 0210 4857 9170"), KEY);
  assert.equal(extractAccessKey(`<infNFe Id="NFe${KEY}" versao="4.00">`), KEY);
  assert.equal(extractAccessKey(`Chave de acesso:\n3326 1175 3153 3303 1926 6550 6000 1310 0210 4857 9170\n`), KEY);
  assert.equal(extractAccessKey("nada aqui"), null);
});

test("descreve a chave", () => {
  const d = describeKey(KEY);
  assert.equal(d.uf, "33");
  assert.equal(d.model, "65");
  assert.equal(d.number, "000131002");
});

test("só abre links da Fazenda do RJ", () => {
  assert.equal(officialConsultaUrl("https://malicioso.example.com/x"), RJ_CONSULTA_URL);
  assert.equal(officialConsultaUrl("javascript:alert(1)"), RJ_CONSULTA_URL);
  assert.equal(officialConsultaUrl(null), RJ_CONSULTA_URL);
  assert.match(officialConsultaUrl(`http://www4.fazenda.rj.gov.br/consultaNFCe/QRCode?p=${KEY}`), /^https:\/\/www4\.fazenda\.rj\.gov\.br\//);
  assert.equal(officialConsultaUrl("https://fazenda.rj.gov.br.evil.com/x"), RJ_CONSULTA_URL);
});
