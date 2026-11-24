// Geradores de imagens de teste SEM dados pessoais: chave de nota inventada (CNPJ de exemplo),
// QR e código de barras feitos por código, distorcidos no próprio navegador (borrão, giro, inclinação, ruído).
import { writeFileSync } from "node:fs";
import type { Page } from "@playwright/test";
import QRCode from "qrcode";

function dv(key43: string): number {
  let sum = 0;
  let w = 2;
  for (let i = 42; i >= 0; i--) { sum += Number(key43[i]) * w; w = w === 9 ? 2 : w + 1; }
  const r = sum % 11;
  return r === 0 || r === 1 ? 0 : 11 - r;
}

/** Chave inventada do RJ (UF 33, modelo 65), com dígito verificador certo. */
export function fakeKey(n = 12345): string {
  const k43 = "33" + "2611" + "11222333000181" + "65" + "001" + String(n).padStart(9, "0") + "1" + "87654321";
  return k43 + dv(k43);
}

/** Link parecido com o do QR da NFC-e do RJ, com 143 caracteres. */
export function fakeQrUrl(key = fakeKey()): string {
  const url = `https://www.fazenda.rj.gov.br/consultaNFCe/QRCode?p=${key}|2|1|1|${"a1b2c3d4e5".repeat(4)}`;
  if (url.length !== 143) throw new Error(`URL de teste com ${url.length} caracteres`);
  return url;
}

export async function qrPng(text: string, ecc: "L" | "M", scale: number): Promise<Buffer> {
  return QRCode.toBuffer(text, { errorCorrectionLevel: ecc, scale, margin: 4, type: "png" });
}

export interface Distort {
  /** largura final da imagem (px) */ width: number;
  /** tamanho do código em relação à largura (0..1) */ fill?: number;
  blur?: number; rotate?: number; skewX?: number; skewY?: number; noise?: number;
  /** "jpeg" imita foto de celular */ type?: "png" | "jpeg";
  /** proporção altura/largura */ aspect?: number;
}

/** Desenha a imagem sobre um "papel" cinza claro com as distorções pedidas. Retorna PNG/JPEG. */
export async function distort(page: Page, img: Buffer, d: Distort): Promise<Buffer> {
  const b64 = await page.evaluate(async ({ src, d }) => {
    const im = new Image();
    im.src = src;
    await im.decode();
    const W = d.width, H = Math.round(d.width * (d.aspect ?? 1.33));
    const c = document.createElement("canvas");
    c.width = W; c.height = H;
    const ctx = c.getContext("2d")!;
    const g = ctx.createLinearGradient(0, 0, W, H); // papel com luz desigual
    g.addColorStop(0, "#f4f1ea"); g.addColorStop(1, "#cfcac0");
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    const size = W * (d.fill ?? 0.7);
    ctx.save();
    ctx.translate(W / 2, H / 2);
    ctx.rotate(((d.rotate ?? 0) * Math.PI) / 180);
    ctx.transform(1, d.skewY ?? 0, d.skewX ?? 0, 1, 0, 0);
    ctx.filter = d.blur ? `blur(${d.blur}px)` : "none";
    ctx.globalCompositeOperation = "multiply";
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(im, -size / 2, -size / 2, size, size);
    ctx.restore();
    if (d.noise) {
      const px = ctx.getImageData(0, 0, W, H);
      for (let i = 0; i < px.data.length; i += 4) {
        const n = (Math.random() - 0.5) * d.noise;
        px.data[i] += n; px.data[i + 1] += n; px.data[i + 2] += n;
      }
      ctx.putImageData(px, 0, 0);
    }
    return c.toDataURL(d.type === "jpeg" ? "image/jpeg" : "image/png", 0.85).split(",")[1];
  }, { src: "data:image/png;base64," + img.toString("base64"), d });
  return Buffer.from(b64, "base64");
}

// ---------- EAN-13 ----------
const L = ["0001101", "0011001", "0010011", "0111101", "0100011", "0110001", "0101111", "0111011", "0110111", "0001011"];
const G = ["0100111", "0110011", "0011011", "0100001", "0011101", "0111001", "0000101", "0010001", "0001001", "0010111"];
const R = ["1110010", "1100110", "1101100", "1000010", "1011100", "1001110", "1010000", "1000100", "1001000", "1110100"];
const PARITY = ["LLLLLL", "LLGLGG", "LLGGLG", "LLGGGL", "LGLLGG", "LGGLLG", "LGGGLL", "LGLGLG", "LGLGGL", "LGGLGL"];

export function ean13(first12: string): string {
  const s = first12.split("").reduce((a, c, i) => a + Number(c) * (i % 2 ? 3 : 1), 0);
  return first12 + ((10 - (s % 10)) % 10);
}

/** Código de barras EAN-13 como PNG (só as barras, com margem branca). */
export async function ean13Png(page: Page, code: string, module = 4): Promise<Buffer> {
  const p = PARITY[Number(code[0])];
  let bits = "101";
  for (let i = 1; i <= 6; i++) bits += (p[i - 1] === "L" ? L : G)[Number(code[i])];
  bits += "01010";
  for (let i = 7; i <= 12; i++) bits += R[Number(code[i])];
  bits += "101";
  const b64 = await page.evaluate(({ bits, module }) => {
    const quiet = 11 * module;
    const c = document.createElement("canvas");
    c.width = bits.length * module + quiet * 2;
    c.height = Math.round(c.width * 0.55);
    const ctx = c.getContext("2d")!;
    ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, c.width, c.height);
    ctx.fillStyle = "#000";
    for (let i = 0; i < bits.length; i++) if (bits[i] === "1") ctx.fillRect(quiet + i * module, module * 4, module, c.height - module * 8);
    return c.toDataURL("image/png").split(",")[1];
  }, { bits, module });
  return Buffer.from(b64, "base64");
}

/** Converte uma imagem num vídeo .y4m para a câmera falsa do Chrome. */
export async function writeY4m(page: Page, img: Buffer, file: string, w = 1280, h = 720, fill = 0.45, rotate = 6, blur = 0.8): Promise<void> {
  const rgba = await page.evaluate(async ({ src, w, h, fill, rotate, blur }) => {
    const im = new Image();
    im.src = src;
    await im.decode();
    const c = document.createElement("canvas");
    c.width = w; c.height = h;
    const ctx = c.getContext("2d")!;
    ctx.fillStyle = "#d9d4ca"; ctx.fillRect(0, 0, w, h);
    // lado menor do código = fill × altura do vídeo (limitado a 90% da largura)
    const dw = Math.min(w * 0.9, (h * fill * im.width) / Math.min(im.width, im.height));
    const dh = (dw * im.height) / im.width;
    ctx.translate(w / 2, h / 2);
    ctx.rotate((rotate * Math.PI) / 180);
    ctx.filter = `blur(${blur}px)`;
    ctx.globalCompositeOperation = "multiply";
    ctx.drawImage(im, -dw / 2, -dh / 2, dw, dh);
    return Array.from(ctx.getImageData(0, 0, w, h).data);
  }, { src: "data:image/png;base64," + img.toString("base64"), w, h, fill, rotate, blur });

  const Y = Buffer.alloc(w * h), U = Buffer.alloc((w / 2) * (h / 2)), V = Buffer.alloc((w / 2) * (h / 2));
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = (y * w + x) * 4;
    Y[y * w + x] = Math.round(0.299 * rgba[i] + 0.587 * rgba[i + 1] + 0.114 * rgba[i + 2]);
  }
  U.fill(128); V.fill(128); // imagem em tons de cinza
  const frame = Buffer.concat([Buffer.from("FRAME\n"), Y, U, V]);
  const frames = Array.from({ length: 4 }, () => frame);
  writeFileSync(file, Buffer.concat([Buffer.from(`YUV4MPEG2 W${w} H${h} F15:1 Ip A1:1 C420jpeg\n`), ...frames]));
}
