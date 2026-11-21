// Chave de acesso da NFC-e: extração (QR, texto, XML), validação e consulta oficial.

export interface KeyInfo {
  uf: string;
  yearMonth: string;
  cnpj: string;
  model: string;
  series: string;
  number: string;
}

export function isValidAccessKey(key: string): boolean {
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

export function describeKey(key: string): KeyInfo {
  return {
    uf: key.slice(0, 2),
    yearMonth: key.slice(2, 6),
    cnpj: key.slice(6, 20),
    model: key.slice(20, 22),
    series: key.slice(22, 25),
    number: key.slice(25, 34),
  };
}

/** Procura uma chave de 44 dígitos em um link de QR, texto digitado/colado ou XML. */
export function extractAccessKey(input: string): string | null {
  const text = input.trim();
  if (!text) return null;
  const fromParam = /[?&]p=(\d{44})/i.exec(safeDecode(text));
  if (fromParam) return fromParam[1];
  const fromXml = /(?:Id="NFe|<chNFe>)(\d{44})/.exec(text);
  if (fromXml) return fromXml[1];
  const onlyDigits = text.replace(/[\s.\-]/g, "");
  if (/^\d{44}$/.test(onlyDigits)) return onlyDigits;
  const spaced = /(?:\d{4}\s+){10}\d{4}/.exec(text);
  if (spaced) return spaced[0].replace(/\s+/g, "");
  const plain = /\d{44}/.exec(text);
  return plain ? plain[0] : null;
}

function safeDecode(s: string): string {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
}

export const RJ_CONSULTA_URL = "https://consultadfe.fazenda.rj.gov.br/consultaDFe/paginas/consultaChaveAcesso.faces";

/** Link do QR só é aberto se for da Fazenda do RJ (um QR pode apontar para qualquer endereço). */
export function officialConsultaUrl(qrText?: string | null): string {
  if (qrText) {
    try {
      const u = new URL(qrText.trim());
      if ((u.protocol === "https:" || u.protocol === "http:") && /(^|\.)fazenda\.rj\.gov\.br$/.test(u.hostname)) {
        u.protocol = "https:";
        return u.toString();
      }
    } catch {
      /* não é um link */
    }
  }
  return RJ_CONSULTA_URL;
}

export function formatKey(key: string): string {
  return key.replace(/(\d{4})(?=\d)/g, "$1 ");
}
