// Leitor de NFC-e do RJ a partir do TEXTO da página de consulta (texto colado ou extraído de PDF).
// Regras: nunca ler nem devolver CPF/nome do consumidor; validar tudo antes de aceitar.

export const PARSER_VERSION = "rj-text-1";

export interface RjItem {
  line: number;
  description: string;
  storeCode: string;       // código interno do mercado (a página do RJ não mostra GTIN)
  quantity: number;
  unit: string;            // ex.: UND, KG, PCT
  unitRaw: string;         // como veio na página (ex.: UND9); o dígito final ainda não é entendido
  unitPriceCents: number;
  totalCents: number;
}

export interface RjParseResult {
  ok: boolean;
  /** true quando a soma dos itens foi conferida com o valor total da nota; false se o texto veio sem totais */
  validated: boolean;
  parserVersion: string;
  errors: string[];
  warnings: string[];
  store: { name: string; cnpj: string; address: string } | null;
  note: { number: string; series: string; issuedAt: string | null; accessKey: string | null } | null;
  items: RjItem[];
  totals: { itemCount: number | null; totalCents: number | null; discountCents: number | null; payableCents: number | null };
}

const brNumber = (s: string): number => Number(s.replace(/\./g, "").replace(",", "."));
const cents = (s: string): number => Math.round(brNumber(s) * 100);

function accessKeyIsValid(key: string): boolean {
  if (!/^\d{44}$/.test(key)) return false;
  let sum = 0;
  let w = 2;
  for (let i = 42; i >= 0; i--) {
    sum += Number(key[i]) * w;
    w = w === 9 ? 2 : w + 1;
  }
  const r = sum % 11;
  const dv = r === 0 || r === 1 ? 0 : 11 - r;
  return dv === Number(key[43]);
}

export function parseRjConsultaText(input: string): RjParseResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  // Higiene: o texto pode conter CPF; ele nunca é lido nem devolvido.
  const text = input.replace(/\r/g, "").replace(/\d{3}\.\d{3}\.\d{3}-\d{2}/g, "[cpf]");
  const lines = text.split("\n").map((l) => l.replace(/\s+/g, " ").trim()).filter((l) => l.length > 0);
  const flat = lines.join("\n");

  // ---- mercado (cabeçalho) ----
  let store: RjParseResult["store"] = null;
  const cnpjIdx = lines.findIndex((l) => /^CNPJ:\s*\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}$/.test(l));
  if (cnpjIdx > 0) {
    store = {
      name: lines[cnpjIdx - 1],
      cnpj: lines[cnpjIdx].replace(/\D/g, ""),
      address: lines[cnpjIdx + 1] ?? "",
    };
  } else {
    errors.push("Cabeçalho do mercado (nome e CNPJ) não encontrado.");
  }

  // ---- itens ----
  const items: RjItem[] = [];
  const head = /^(.*?)\s*\(Código:\s*(\d+)\s*\)\s*(?:Vl\. Total)?$/;
  const body = /^Qtde\.:\s*([\d.,]+)\s+UN:\s*([A-Za-z]+)(\d?)\s+Vl\. Unit\.:\s*([\d.,]+)(?:\s+([\d.]*,\d{2}))?$/;
  const money = /^[\d.]*,\d{2}$/;
  let pending: { description: string; storeCode: string } | null = null;
  let waitingTotal: Omit<RjItem, "totalCents"> | null = null;
  for (const l of lines) {
    if (waitingTotal) {
      if (l === "Vl. Total") continue;
      if (money.test(l)) {
        items.push({ ...waitingTotal, totalCents: cents(l) });
        waitingTotal = null;
        continue;
      }
      errors.push(`Valor total não encontrado para o item ${waitingTotal.line} (${waitingTotal.description}).`);
      waitingTotal = null;
    }
    const h = head.exec(l);
    if (h) {
      pending = { description: h[1], storeCode: h[2] };
      continue;
    }
    const b = body.exec(l);
    if (b && pending) {
      const base = {
        line: items.length + 1,
        description: pending.description,
        storeCode: pending.storeCode,
        quantity: brNumber(b[1]),
        unit: b[2].toUpperCase(),
        unitRaw: b[2] + b[3],
        unitPriceCents: cents(b[4]),
      };
      pending = null;
      if (b[5]) items.push({ ...base, totalCents: cents(b[5]) });
      else waitingTotal = base;
    }
  }
  if (waitingTotal) errors.push(`Valor total não encontrado para o item ${waitingTotal.line}.`);
  if (items.length === 0) errors.push("Nenhum item encontrado.");

  // ---- totais ----
  const pick = (re: RegExp) => {
    const m = re.exec(flat);
    return m ? m[1] : null;
  };
  const itemCountS = pick(/Qtd\. total de itens:\s*(\d+)/);
  const totalS = pick(/Valor total R\$:\s*([\d.]*,\d{2})/);
  const discS = pick(/Descontos R\$:\s*([\d.]*,\d{2})/);
  const payS = pick(/Valor a pagar R\$:\s*([\d.]*,\d{2})/);
  const totals = {
    itemCount: itemCountS ? Number(itemCountS) : null,
    totalCents: totalS ? cents(totalS) : null,
    discountCents: discS ? cents(discS) : null,
    payableCents: payS ? cents(payS) : null,
  };

  // ---- nota ----
  let note: RjParseResult["note"] = null;
  const nm = /Número:\s*(\d+)\s+Série:\s*(\d+)\s+Emissão:\s*(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}:\d{2}:\d{2})(-\d{2}:\d{2})?/.exec(flat);
  const km = /Chave de acesso:\s*((?:\d{4}\s*){11})/.exec(flat);
  const accessKey = km ? km[1].replace(/\s/g, "") : null;
  if (nm) {
    note = {
      number: nm[1],
      series: nm[2],
      issuedAt: `${nm[5]}-${nm[4]}-${nm[3]}T${nm[6]}${nm[7] ?? "-03:00"}`,
      accessKey,
    };
  } else {
    errors.push("Dados gerais da nota (número, série, emissão) não encontrados.");
  }

  // ---- validações ----
  if (items.length) {
    const sum = items.reduce((a, i) => a + i.totalCents, 0);
    if (totals.totalCents === null) warnings.push("Totais da nota não encontrados no texto: a soma dos itens não pôde ser conferida. Peça confirmação ao usuário.");
    else if (sum !== totals.totalCents) errors.push(`Soma dos itens (${sum}) diferente do valor total (${totals.totalCents}).`);
    if (totals.itemCount !== null && totals.itemCount !== items.length) errors.push(`Quantidade de itens lida (${items.length}) diferente da informada (${totals.itemCount}).`);
    if (totals.totalCents !== null && totals.discountCents !== null && totals.payableCents !== null && totals.totalCents - totals.discountCents !== totals.payableCents) {
      errors.push("Valor a pagar não confere com total menos descontos.");
    }
    for (const i of items) {
      const expected = i.quantity * (i.unitPriceCents / 100) * 100;
      if (Math.abs(expected - i.totalCents) > 2) warnings.push(`Item ${i.line}: quantidade × preço unitário não bate com o total.`);
    }
  }
  if (accessKey) {
    if (!accessKeyIsValid(accessKey)) errors.push("Chave de acesso inválida (dígito verificador).");
    else {
      if (accessKey.slice(0, 2) !== "33") warnings.push("A chave não é do RJ (UF 33).");
      if (accessKey.slice(20, 22) !== "65") warnings.push("A chave não é de NFC-e (modelo 65).");
      if (store && accessKey.slice(6, 20) !== store.cnpj) errors.push("CNPJ da chave diferente do CNPJ do cabeçalho.");
      if (note && accessKey.slice(25, 34) !== note.number.padStart(9, "0")) errors.push("Número da nota diferente do número da chave.");
    }
  } else {
    warnings.push("Chave de acesso não encontrada no texto.");
  }

  const validated = totals.totalCents !== null && items.length > 0 && !errors.some((e) => e.startsWith("Soma dos itens"));
  return { ok: errors.length === 0, validated, parserVersion: PARSER_VERSION, errors, warnings, store, note, items, totals };
}
