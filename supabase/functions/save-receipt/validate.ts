// Validação da nota enviada pelo app antes de gravar no banco.
// Sem dependências: roda no Deno (função do servidor) e no Node (testes).

export interface ReceiptItemIn {
  line: number;
  description: string;
  storeCode: string;
  quantity: number;
  unit: string;
  unitRaw: string;
  unitPriceCents: number;
  totalCents: number;
}

export interface ReceiptIn {
  accessKey: string;
  savedAt: string;
  storeName: string;
  storeCnpj: string;
  storeAddress: string;
  issuedAt: string | null;
  number: string;
  series: string;
  totalCents: number;
  discountCents: number;
  payableCents: number;
  validated: boolean;
  parserVersion: string;
  items: ReceiptItemIn[];
}

export type Valid = ReceiptIn & { uf: string };

const UF: Record<string, string> = {
  "11": "RO", "12": "AC", "13": "AM", "14": "RR", "15": "PA", "16": "AP", "17": "TO", "21": "MA", "22": "PI", "23": "CE",
  "24": "RN", "25": "PB", "26": "PE", "27": "AL", "28": "SE", "29": "BA", "31": "MG", "32": "ES", "33": "RJ", "35": "SP",
  "41": "PR", "42": "SC", "43": "RS", "50": "MS", "51": "MT", "52": "GO", "53": "DF",
};

export function accessKeyIsValid(key: string): boolean {
  if (!/^\d{44}$/.test(key)) return false;
  let sum = 0;
  let w = 2;
  for (let i = 42; i >= 0; i--) {
    sum += Number(key[i]) * w;
    w = w === 9 ? 2 : w + 1;
  }
  const r = sum % 11;
  return (r === 0 || r === 1 ? 0 : 11 - r) === Number(key[43]);
}

// CPF formatado, ou a palavra CPF / CONSUMIDOR seguida de dados: nunca entra no banco.
const PERSONAL = /\d{3}\.\d{3}\.\d{3}-\d{2}|\bCPF\b|\bCONSUMIDOR\b/i;

const str = (v: unknown, max: number): v is string => typeof v === "string" && v.length <= max;
const int = (v: unknown, min = 0, max = 100_000_000): v is number => Number.isInteger(v) && (v as number) >= min && (v as number) <= max;
const isoDate = (v: unknown) => typeof v === "string" && !Number.isNaN(Date.parse(v));

/** Devolve a nota pronta para gravar, ou a lista de problemas. */
export function validateReceipt(x: unknown): { ok: true; value: Valid } | { ok: false; errors: string[] } {
  const e: string[] = [];
  const r = x as ReceiptIn;
  if (!r || typeof r !== "object") return { ok: false, errors: ["Nota ausente."] };

  if (!accessKeyIsValid(String(r.accessKey))) e.push("Chave de acesso inválida.");
  if (!/^\d{14}$/.test(String(r.storeCnpj))) e.push("CNPJ do mercado inválido.");
  if (accessKeyIsValid(String(r.accessKey))) {
    if (r.accessKey.slice(6, 20) !== r.storeCnpj) e.push("CNPJ da chave diferente do CNPJ do mercado.");
    if (r.accessKey.slice(20, 22) !== "65") e.push("A chave não é de NFC-e (modelo 65).");
    if (!UF[r.accessKey.slice(0, 2)]) e.push("Estado da chave desconhecido.");
  }
  if (!str(r.storeName, 200) || !r.storeName.trim()) e.push("Nome do mercado inválido.");
  if (!str(r.storeAddress, 300)) e.push("Endereço do mercado inválido.");
  if (r.issuedAt !== null && !isoDate(r.issuedAt)) e.push("Data de emissão inválida.");
  if (!isoDate(r.savedAt)) e.push("Data de gravação inválida.");
  if (!str(r.number, 20) || !str(r.series, 10)) e.push("Número ou série inválidos.");
  if (!str(r.parserVersion, 40)) e.push("Versão do leitor inválida.");
  if (typeof r.validated !== "boolean") e.push("Campo de conferência inválido.");
  if (!int(r.totalCents) || !int(r.discountCents) || !int(r.payableCents)) e.push("Totais inválidos.");

  if (!Array.isArray(r.items) || r.items.length === 0 || r.items.length > 500) {
    e.push("A nota precisa ter de 1 a 500 itens.");
  } else {
    r.items.forEach((i, n) => {
      const ok = i && str(i.description, 200) && i.description.trim() && /^\d{1,20}$/.test(String(i.storeCode))
        && typeof i.quantity === "number" && i.quantity > 0 && i.quantity < 100_000
        && str(i.unit, 10) && str(i.unitRaw, 12) && int(i.unitPriceCents) && int(i.totalCents) && int(i.line, 1, 1000);
      if (!ok) e.push(`Item ${n + 1} inválido.`);
    });
    if (r.validated && e.length === 0) {
      const sum = r.items.reduce((s, i) => s + i.totalCents, 0);
      if (sum !== r.totalCents) e.push("Soma dos itens diferente do total da nota.");
    }
  }

  const texts = [r.storeName, r.storeAddress, ...(Array.isArray(r.items) ? r.items.map((i) => i?.description) : [])];
  if (texts.some((t) => typeof t === "string" && PERSONAL.test(t))) e.push("A nota contém dados pessoais (CPF ou consumidor).");

  if (e.length) return { ok: false, errors: e };
  return { ok: true, value: { ...r, uf: UF[r.accessKey.slice(0, 2)] } };
}
