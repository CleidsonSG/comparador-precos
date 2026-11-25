// Leitor do XML da NFC-e (layout nacional 4.00, igual em todos os estados).
// Regras: o bloco do consumidor (<dest>), as observações (<infAdic>) e quem pode baixar o XML (<autXML>)
// são APAGADOS antes de qualquer leitura: CPF e nome nunca são lidos nem devolvidos. Tudo é conferido antes de aceitar.
import type { RjItem, RjParseResult } from "../uf/rj/parseConsultaText.ts";
import { isValidAccessKey } from "../../../lib/accessKey.ts";

export const XML_PARSER_VERSION = "nfce-xml-1";

/** O texto parece um XML de NF-e/NFC-e? */
export const looksLikeNfceXml = (s: string): boolean => /<(?:\w+:)?infNFe[\s>]/.test(s);

const ENT: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" };
const decode = (s: string) =>
  s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos);/gi, (_, e: string) =>
      e[0] === "#" ? String.fromCodePoint(e[1] === "x" || e[1] === "X" ? parseInt(e.slice(2), 16) : Number(e.slice(1))) : ENT[e.toLowerCase()]!)
    .trim();

// Tags com ou sem prefixo de namespace (<nfe:xProd>).
const block = (xml: string, tag: string): string | null => {
  const m = new RegExp(`<(?:\\w+:)?${tag}(?:\\s[^>]*)?>([\\s\\S]*?)</(?:\\w+:)?${tag}>`).exec(xml);
  return m ? m[1]! : null;
};
const blocks = (xml: string, tag: string): { attrs: string; body: string }[] =>
  [...xml.matchAll(new RegExp(`<(?:\\w+:)?${tag}(\\s[^>]*)?>([\\s\\S]*?)</(?:\\w+:)?${tag}>`, "g"))].map((m) => ({ attrs: m[1] ?? "", body: m[2]! }));
const val = (xml: string | null, tag: string): string | null => {
  if (xml === null) return null;
  const b = block(xml, tag);
  return b === null ? null : decode(b);
};
const stripBlock = (xml: string, tag: string) =>
  xml.replace(new RegExp(`<(?:\\w+:)?${tag}(?:\\s[^>]*)?>[\\s\\S]*?</(?:\\w+:)?${tag}>`, "g"), "").replace(new RegExp(`<(?:\\w+:)?${tag}\\s*/>`, "g"), "");

const cents = (s: string | null): number | null => {
  if (s === null || !/^-?\d+(\.\d+)?$/.test(s)) return null;
  return Math.round(Number(s) * 100);
};

export function parseNfceXml(input: string): RjParseResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const fail = (msg: string): RjParseResult => ({
    ok: false, validated: false, parserVersion: XML_PARSER_VERSION, errors: [msg], warnings: [], store: null, note: null, items: [],
    totals: { itemCount: null, totalCents: null, discountCents: null, payableCents: null },
  });

  if (!looksLikeNfceXml(input)) return fail("Este arquivo não é o XML de uma nota fiscal.");
  // primeiro de tudo: apaga dados pessoais
  let xml = input;
  for (const t of ["dest", "infAdic", "autXML", "Signature"]) xml = stripBlock(xml, t);

  const inf = /<(?:\w+:)?infNFe\s[^>]*Id="NFe(\d{44})"/.exec(xml);
  const keyFromProt = val(block(xml, "protNFe"), "chNFe");
  const accessKey = inf?.[1] ?? keyFromProt ?? null;
  if (!accessKey || !isValidAccessKey(accessKey)) errors.push("Chave de acesso ausente ou inválida no XML.");
  if (accessKey && keyFromProt && keyFromProt !== accessKey) errors.push("A chave do protocolo é diferente da chave da nota.");

  const ide = block(xml, "ide");
  const mod = val(ide, "mod");
  if (mod && mod !== "65") errors.push(mod === "55" ? "Este XML é de uma NF-e (modelo 55), não de um cupom NFC-e." : `Modelo de nota ${mod} não suportado.`);
  if (val(ide, "tpAmb") === "2") warnings.push("Nota de homologação (teste da Fazenda), sem valor fiscal.");

  const emit = block(xml, "emit");
  const cnpj = val(emit, "CNPJ");
  const name = val(emit, "xNome");
  const ender = block(emit ?? "", "enderEmit");
  const address = ender ? [val(ender, "xLgr"), val(ender, "nro"), val(ender, "xCpl") ?? "", val(ender, "xBairro"), val(ender, "xMun"), val(ender, "UF")].map((x) => x ?? "").join(" , ").replace(/ {2,}/g, " ") : "";
  if (!cnpj || !/^\d{14}$/.test(cnpj) || !name) errors.push("Mercado (nome e CNPJ) não encontrado no XML.");
  if (cnpj && accessKey && accessKey.slice(6, 20) !== cnpj) errors.push("CNPJ da chave diferente do CNPJ do mercado.");

  const items: RjItem[] = [];
  for (const d of blocks(xml, "det")) {
    const prod = block(d.body, "prod");
    const line = Number(/nItem="(\d+)"/.exec(d.attrs)?.[1] ?? items.length + 1);
    const description = val(prod, "xProd");
    const storeCode = val(prod, "cProd");
    const q = val(prod, "qCom");
    const uCom = val(prod, "uCom") ?? "";
    const unitPriceCents = cents(val(prod, "vUnCom"));
    const totalCents = cents(val(prod, "vProd"));
    if (!description || !storeCode || !q || !/^\d+(\.\d+)?$/.test(q) || unitPriceCents === null || totalCents === null) {
      errors.push(`Item ${line} incompleto no XML.`);
      continue;
    }
    if (!/^\d{1,20}$/.test(storeCode)) {
      // o servidor (save-receipt) só aceita código numérico, como o da página de consulta do RJ
      errors.push(`Item ${line}: o código do produto (${storeCode.slice(0, 20)}) tem letras; este tipo de XML ainda não é aceito.`);
      continue;
    }
    const unitRaw = uCom.toUpperCase();
    items.push({ line, description, storeCode, quantity: Number(q), unit: unitRaw.replace(/\d+$/, "") || unitRaw, unitRaw, unitPriceCents, totalCents });
  }
  if (items.length === 0 && errors.length === 0) errors.push("Nenhum item encontrado no XML.");

  const tot = block(xml, "ICMSTot");
  const totalCents = cents(val(tot, "vProd"));
  const discountCents = cents(val(tot, "vDesc")) ?? 0;
  const payableCents = cents(val(tot, "vNF"));
  const sum = items.reduce((s, i) => s + i.totalCents, 0);
  let validated = false;
  if (totalCents === null || payableCents === null) warnings.push("O XML não traz os totais; a soma não foi conferida.");
  else if (sum !== totalCents) errors.push(`A soma dos itens (${(sum / 100).toFixed(2)}) não bate com o total da nota (${(totalCents / 100).toFixed(2)}).`);
  else validated = true;

  const issuedAt = val(ide, "dhEmi");
  const ok = errors.length === 0;
  return {
    ok, validated: ok && validated, parserVersion: XML_PARSER_VERSION, errors, warnings,
    store: cnpj && name ? { name, cnpj, address } : null,
    note: { number: val(ide, "nNF") ?? "", series: val(ide, "serie") ?? "", issuedAt: issuedAt && /^\d{4}-\d{2}-\d{2}T/.test(issuedAt) ? issuedAt : null, accessKey },
    items,
    totals: { itemCount: items.length, totalCents, discountCents, payableCents },
  };
}
