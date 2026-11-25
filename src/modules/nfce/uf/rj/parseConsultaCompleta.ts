// Leitor da "Consulta completa" da NF-e/NFC-e do RJ: a página salva pelo navegador (.mht/.mhtml no celular,
// .htm/.html no computador), inclusive a página de impressão do documento detalhado.
// Diferente da consulta resumida, ela traz o código de barras (GTIN, "Código EAN Comercial") de cada item.
// Regras: os blocos do destinatário (CPF/nome), do pagamento e das informações adicionais são APAGADOS antes
// de qualquer leitura; CPF nunca é lido nem devolvido. Tudo é conferido antes de aceitar.
import type { RjItem, RjParseResult } from "./parseConsultaText.ts";
import { isValidAccessKey } from "../../../../lib/accessKey.ts";

export const COMPLETA_PARSER_VERSION = "rj-completa-1";

// ---------- arquivo salvo (MHTML) ----------

const bytesToUtf8 = (bytes: number[]) => new TextDecoder("utf-8").decode(new Uint8Array(bytes));

function decodeQuotedPrintable(s: string): string {
  const flat = s.replace(/=\r?\n/g, "");
  const out: number[] = [];
  for (let i = 0; i < flat.length; i++) {
    const c = flat[i]!;
    if (c === "=" && /^[0-9A-Fa-f]{2}$/.test(flat.slice(i + 1, i + 3))) { out.push(parseInt(flat.slice(i + 1, i + 3), 16)); i += 2; }
    else out.push(c.charCodeAt(0) & 0xff);
  }
  return bytesToUtf8(out);
}

function decodeBase64(s: string): string {
  const bin = atob(s.replace(/\s+/g, ""));
  return bytesToUtf8(Array.from(bin, (c) => c.charCodeAt(0)));
}

/** Página salva: devolve o HTML principal. Aceita MHTML (multipart/related) ou HTML puro. */
export function extractHtml(input: string): string {
  const boundary = /boundary="?([^";\r\n]+)"?/i.exec(input.slice(0, 4000));
  if (!boundary || !/multipart\/related/i.test(input.slice(0, 4000))) return input;
  for (const part of input.split(`--${boundary[1]}`)) {
    const sep = /\r?\n\r?\n/.exec(part);
    if (!sep) continue;
    const head = part.slice(0, sep.index);
    if (!/Content-Type:\s*text\/html/i.test(head)) continue;
    const body = part.slice(sep.index + sep[0].length);
    if (/Content-Transfer-Encoding:\s*quoted-printable/i.test(head)) return decodeQuotedPrintable(body);
    if (/Content-Transfer-Encoding:\s*base64/i.test(head)) return decodeBase64(body);
    return body;
  }
  return input;
}

// ---------- recortes de HTML ----------

/** Fim do elemento que começa em `start` (conta aberturas e fechamentos da mesma tag). */
function elementEnd(html: string, start: number, tag: string): number {
  const re = new RegExp(`<(/?)${tag}\\b[^>]*>`, "gi");
  re.lastIndex = start;
  let depth = 0;
  for (let m = re.exec(html); m; m = re.exec(html)) {
    depth += m[1] ? -1 : 1;
    if (depth === 0) return m.index + m[0].length;
  }
  return html.length;
}

/** Remove todos os elementos `tag` cuja tag de abertura casa com `open`. */
function removeElements(html: string, tag: string, open: RegExp): string {
  let out = html;
  for (let guard = 0; guard < 50; guard++) {
    const m = new RegExp(open.source, "i").exec(out);
    if (!m) break;
    out = out.slice(0, m.index) + out.slice(elementEnd(out, m.index, tag));
  }
  return out;
}

/** Conteúdo do elemento `<div ... id="id">`, ou null. */
function blockById(html: string, id: string): string | null {
  const m = new RegExp(`<div\\b[^>]*\\bid="${id}"[^>]*>`, "i").exec(html);
  return m ? html.slice(m.index, elementEnd(html, m.index, "div")) : null;
}

const CPF_RE = /(?<!\d)\d{3}\.\d{3}\.\d{3}-\d{2}(?!\d)/g;

/**
 * Apaga dados pessoais e de pagamento: destinatário (CPF/nome/endereço), formas de pagamento,
 * informações adicionais (texto livre do mercado, pode citar o consumidor), transporte e nota avulsa.
 * Também tira scripts e mascara qualquer coisa com formato de CPF que tenha sobrado.
 */
export function stripPersonal(html: string): string {
  let h = html.replace(/<script\b[\s\S]*?<\/script>/gi, "").replace(/<style\b[\s\S]*?<\/style>/gi, "").replace(/<!--[\s\S]*?-->/g, "");
  for (const id of ["DestRem", "Cobranca", "Inf", "Transporte", "Avulsa"]) {
    h = removeElements(h, "div", new RegExp(`<div\\b[^>]*\\bid="${id}"[^>]*>`));
  }
  // quadro "Destinatário" dentro da aba NFe
  h = removeElements(h, "fieldset", /<fieldset\b[^>]*>\s*<legend\b[^>]*>\s*Destinat/);
  return h.replace(CPF_RE, "");
}

// ---------- leitura dos campos ----------

const ENT: Record<string, string> = { nbsp: " ", amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" };
const clean = (s: string) =>
  s.replace(/<[^>]*>/g, " ")
    .replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (all, e: string) =>
      e[0] === "#" ? String.fromCodePoint(e[1] === "x" || e[1] === "X" ? parseInt(e.slice(2), 16) : Number(e.slice(1))) : ENT[e.toLowerCase()] ?? all)
    .replace(/\s+/g, " ").trim();

/** Pares "rótulo → valor" (`<label>…</label><span>…</span>`); fica o primeiro de cada rótulo. */
function fields(html: string | null): Map<string, string> {
  const map = new Map<string, string>();
  if (!html) return map;
  for (const m of html.matchAll(/<label\b[^>]*>([\s\S]*?)<\/label>\s*<span\b[^>]*>([\s\S]*?)<\/span>/gi)) {
    const k = clean(m[1]!);
    if (!map.has(k)) map.set(k, clean(m[2]!));
  }
  return map;
}

const brNumber = (s: string) => Number(s.replace(/\./g, "").replace(",", "."));
const isBrNumber = (s: string | undefined): s is string => !!s && /^-?[\d.]*\d(,\d+)?$/.test(s);
const toCents = (s: string | undefined): number | null => (isBrNumber(s) ? Math.round(brNumber(s) * 100) : null);

/** GTIN-8/12/13/14 com dígito verificador correto; "SEM GTIN" e códigos inválidos viram null. */
export function normalizeGtin(raw: string | undefined): string | null {
  const d = (raw ?? "").replace(/\s/g, "");
  if (!/^(\d{8}|\d{12}|\d{13}|\d{14})$/.test(d) || /^0+$/.test(d)) return null;
  let sum = 0;
  for (let i = d.length - 2, w = 3; i >= 0; i--, w = w === 3 ? 1 : 3) sum += Number(d[i]) * w;
  return (10 - (sum % 10)) % 10 === Number(d[d.length - 1]) ? d : null;
}

// ---------- detecção ----------

/** Página da "Consulta completa" (ou da impressão do documento detalhado). */
export const looksLikeConsultaCompleta = (s: string): boolean => /class="GeralXslt"/.test(s) && /Dados dos Produtos e Servi/.test(s);

/** Uma página HTML/MHTML qualquer (para avisar quando não é a consulta completa). */
export const looksLikeSavedPage = (s: string): boolean =>
  /^\s*(From:|MIME-Version:|Snapshot-Content-Location:)/i.test(s.slice(0, 300)) || /<html[\s>]/i.test(s.slice(0, 5000));

export const RESUMIDA_MSG =
  "Este arquivo é da consulta resumida e não traz os itens com detalhes. Na página da Fazenda, toque em Consulta completa e baixe de novo.";

// ---------- leitor ----------

export function parseConsultaCompleta(input: string): RjParseResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const empty = { itemCount: null, totalCents: null, discountCents: null, payableCents: null };
  const fail = (msg: string): RjParseResult => ({
    ok: false, validated: false, parserVersion: COMPLETA_PARSER_VERSION, errors: [msg], warnings: [], store: null, note: null, items: [], totals: empty,
  });

  // primeiro de tudo: apaga dados pessoais
  const html = stripPersonal(extractHtml(input));
  if (!looksLikeConsultaCompleta(html)) return fail(RESUMIDA_MSG);

  const nfe = blockById(html, "NFe");
  const emit = blockById(html, "Emitente");
  const prod = blockById(html, "Prod");
  const tot = blockById(html, "Totais");
  const fNfe = fields(nfe), fEmit = fields(emit), fTot = fields(tot), fAll = fields(html);

  // chave: "Dados Gerais" (consulta) ou cabeçalho da impressão
  const keyText = fAll.get("Chave de Acesso") ?? /(?:\d{4}\s+){10}\d{4}/.exec(clean(html))?.[0] ?? "";
  const accessKey = keyText.replace(/\D/g, "");
  if (!isValidAccessKey(accessKey)) errors.push("Chave de acesso ausente ou inválida na página.");

  const model = fNfe.get("Modelo");
  if (model && model !== "65") errors.push(model === "55" ? "Esta é uma NF-e (modelo 55), não um cupom NFC-e." : `Modelo de nota ${model} não suportado.`);
  const situ = /Situa[çc][ãa]o Atual:\s*([A-ZÇÃÉÊÍÓÚ ]+?)\s*\(/i.exec(clean(nfe ?? ""))?.[1]?.toUpperCase();
  if (situ && situ !== "AUTORIZADA") errors.push(`A nota está ${situ.toLowerCase()} na Fazenda e não pode ser usada.`);
  if (/homologa/i.test(clean(nfe ?? ""))) warnings.push("Nota de homologação (teste da Fazenda), sem valor fiscal.");

  // mercado
  const cnpj = (fEmit.get("CNPJ") ?? fNfe.get("CNPJ") ?? "").replace(/\D/g, "");
  const name = fEmit.get("Nome / Razão Social") ?? fNfe.get("Nome / Razão Social") ?? "";
  if (!/^\d{14}$/.test(cnpj) || !name) errors.push("Mercado (nome e CNPJ) não encontrado na página.");
  if (/^\d{14}$/.test(cnpj) && accessKey.length === 44 && accessKey.slice(6, 20) !== cnpj) errors.push("CNPJ da chave diferente do CNPJ do mercado.");
  const [lgr = "", ...rest] = (fEmit.get("Endereço") ?? "").split(",");
  const address = fEmit.size
    ? [lgr.trim(), rest.join(",").trim(), "", fEmit.get("Bairro / Distrito") ?? "", (fEmit.get("Município") ?? "").replace(/^\d+\s*-\s*/, ""), fEmit.get("UF") ?? ""].join(" , ").replace(/\s+/g, " ")
    : "";

  // itens: cada um começa numa tabela "toggle" (linha resumida) seguida dos detalhes
  const items: RjItem[] = [];
  const chunks = (prod ?? "").split(/<table\b[^>]*class="toggle box"[^>]*>/i).slice(1);
  for (const chunk of chunks) {
    const col = (c: string) => clean(new RegExp(`fixo-prod-serv-${c}"[^>]*>\\s*<span\\b[^>]*>([\\s\\S]*?)</span>`, "i").exec(chunk)?.[1] ?? "");
    const f = fields(chunk);
    const line = Number(col("numero")) || items.length + 1;
    const description = col("descricao");
    const storeCode = f.get("Código do Produto") ?? "";
    const qty = f.get("Quantidade Comercial") ?? col("qtd");
    const unitRaw = (f.get("Unidade Comercial") ?? col("uc")).toUpperCase();
    const unitPriceCents = toCents(f.get("Valor unitário de comercialização"));
    const totalCents = toCents(col("vb"));
    if (!description || !/^\d{1,20}$/.test(storeCode) || !isBrNumber(qty) || unitPriceCents === null || totalCents === null) {
      errors.push(`Item ${line} incompleto na página.`);
      continue;
    }
    const eanRaw = f.get("Código EAN Comercial");
    const gtin = normalizeGtin(eanRaw);
    if (!gtin && eanRaw && /\d{8,}/.test(eanRaw)) warnings.push(`Item ${line}: código de barras ${eanRaw} inválido, ignorado.`);
    items.push({ line, description, storeCode, quantity: brNumber(qty), unit: unitRaw.replace(/\d+$/, "") || unitRaw, unitRaw, unitPriceCents, totalCents, gtin });
  }
  if (items.length === 0 && errors.length === 0) errors.push("Nenhum item encontrado na página.");

  // totais
  const totalCents = toCents(fTot.get("Valor Total dos Produtos"));
  const discountCents = toCents(fTot.get("Valor Total dos Descontos")) ?? 0;
  const payableCents = toCents(fTot.get("Valor Total da NFe") ?? fNfe.get("Valor Total da Nota Fiscal"));
  const sum = items.reduce((s, i) => s + i.totalCents, 0);
  let validated = false;
  if (totalCents === null || payableCents === null) warnings.push("A página não traz os totais; a soma não foi conferida.");
  else if (sum !== totalCents) errors.push(`A soma dos itens (${(sum / 100).toFixed(2)}) não bate com o total da nota (${(totalCents / 100).toFixed(2)}).`);
  else validated = true;
  if (totalCents !== null && payableCents !== null && totalCents - discountCents !== payableCents) {
    warnings.push("Valor pago diferente de total menos descontos (pode haver frete ou outras despesas).");
  }

  // nota
  const number = fNfe.get("Número") ?? "";
  const series = fNfe.get("Série") ?? "";
  const em = /^(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}:\d{2}:\d{2})([+-]\d{2}:\d{2})?/.exec(fNfe.get("Data de Emissão") ?? "");
  const issuedAt = em ? `${em[3]}-${em[2]}-${em[1]}T${em[4]}${em[5] ?? "-03:00"}` : null;
  if (!number || !em) errors.push("Dados gerais da nota (número, série, emissão) não encontrados.");
  else if (accessKey.length === 44 && accessKey.slice(25, 34) !== number.padStart(9, "0")) errors.push("Número da nota diferente do número da chave.");

  const ok = errors.length === 0;
  return {
    ok, validated: ok && validated, parserVersion: COMPLETA_PARSER_VERSION, errors, warnings,
    store: /^\d{14}$/.test(cnpj) && name ? { name, cnpj, address } : null,
    note: { number, series, issuedAt, accessKey: accessKey || null },
    items,
    totals: { itemCount: items.length, totalCents, discountCents, payableCents },
  };
}
