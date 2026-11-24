import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { chromium, expect, test, type Browser, type Page } from "@playwright/test";
import { distort, ean13, ean13Png, fakeKey, fakeQrUrl, qrPng, writeY4m, type Distort } from "./helpers.ts";

const BASE = "http://127.0.0.1:5181";

// Registra os fluxos da câmera para conferir que todas as trilhas foram liberadas.
const TRACK_SPY = () => {
  const w = window as unknown as { __streams: MediaStream[] };
  w.__streams = [];
  const md = navigator.mediaDevices;
  if (!md?.getUserMedia) return;
  const orig = md.getUserMedia.bind(md);
  md.getUserMedia = async (c) => { const s = await orig(c); w.__streams.push(s); return s; };
};
const liveTracks = (page: Page) => page.evaluate(() =>
  (window as unknown as { __streams: MediaStream[] }).__streams.flatMap((s) => s.getTracks()).filter((t) => t.readyState !== "ended").length);
const opened = (page: Page) => page.evaluate(() => (window as unknown as { __streams: MediaStream[] }).__streams.length);

// A tela Escanear pede uma nota guardada. Nota inventada: sem CPF, sem nome de consumidor.
const SEED_NOTE = (key: string) => {
  if (localStorage.getItem("gondola.notes.v1")) return;
  localStorage.setItem("gondola.notes.v1", JSON.stringify([{
    accessKey: key, savedAt: "2026-11-01T12:00:00Z", storeName: "MERCADO TESTE LTDA", storeCnpj: "11222333000181",
    storeAddress: "Rua de Teste, 1", issuedAt: "2026-11-01T11:00:00Z", number: "12345", series: "1",
    totalCents: 1000, discountCents: 0, payableCents: 1000, validated: true, parserVersion: "teste",
    items: [{ line: 1, description: "ARROZ TESTE 1KG", storeCode: "999", quantity: 1, unit: "UND", unitRaw: "UND", unitPriceCents: 1000, totalCents: 1000 }],
  }]));
};

async function sendPhoto(page: Page, label: string, file: { name: string; mimeType: string; buffer: Buffer }) {
  await page.getByLabel(label).setInputFiles(file);
}

// ---------- foto do QR ----------

const CASES: [string, "L" | "M", number, Distort][] = [
  ["L, alta resolução, limpo", "L", 10, { width: 1600, type: "png" }],
  ["M, alta resolução, borrão e ruído (foto)", "M", 10, { width: 1600, blur: 2, noise: 40, type: "jpeg" }],
  ["L, baixa resolução (QR com ~180 px)", "L", 4, { width: 400, fill: 0.45, type: "jpeg" }],
  ["M, baixa resolução com borrão leve", "M", 4, { width: 480, fill: 0.5, blur: 0.6, type: "jpeg" }],
  ["M, girado 17°", "M", 8, { width: 1200, rotate: 17, type: "jpeg" }],
  ["L, inclinado (perspectiva aproximada)", "L", 8, { width: 1200, skewX: 0.12, skewY: 0.05, rotate: -4, type: "jpeg" }],
  ["M, girado, inclinado, borrão e ruído", "M", 8, { width: 1659, fill: 0.55, rotate: 8, skewX: 0.08, blur: 1.5, noise: 30, type: "jpeg" }],
];

test.describe("QR da nota por foto", () => {
  for (const [name, ecc, scale, d] of CASES) {
    test(name, async ({ page }) => {
      await page.goto("/#importar");
      const img = await distort(page, await qrPng(fakeQrUrl(), ecc, scale), d);
      await sendPhoto(page, "Enviar foto do QR", { name: `qr.${d.type === "jpeg" ? "jpg" : "png"}`, mimeType: d.type === "jpeg" ? "image/jpeg" : "image/png", buffer: img });
      await expect(page.getByText("Chave válida do RJ")).toBeVisible({ timeout: 30_000 });
    });
  }

  // Fotos reais ficam só no computador (tests/fixtures/qr/*.private*, ignoradas pelo git).
  const dir = join(process.cwd(), "tests/fixtures/qr");
  const privates = existsSync(dir) ? readdirSync(dir).filter((f) => f.includes(".private")) : [];
  test("fotos reais (arquivos .private)", async ({ page }) => {
    test.skip(privates.length === 0, "nenhuma foto real em tests/fixtures/qr");
    for (const f of privates) {
      await page.goto("/#importar");
      await page.reload();
      await sendPhoto(page, "Enviar foto do QR", { name: "foto.jpg", mimeType: "image/png", buffer: readFileSync(join(dir, f)) });
      // não imprime a chave: só confere que foi aceita
      await expect(page.getByText("Chave válida do RJ"), `foto ${f}`).toBeVisible({ timeout: 45_000 });
    }
  });

  test("foto sem QR mostra a ajuda", async ({ page }) => {
    await page.goto("/#importar");
    const blank = await distort(page, await qrPng("x", "L", 1), { width: 600, fill: 0.001, type: "jpeg" });
    await sendPhoto(page, "Enviar foto do QR", { name: "vazio.jpg", mimeType: "image/jpeg", buffer: blank });
    await expect(page.getByText("Não encontrei o QR nessa foto")).toBeVisible({ timeout: 30_000 });
  });
});

// ---------- código de barras por foto ----------

test("EAN-13 por foto na tela Escanear", async ({ page }) => {
  await page.addInitScript(SEED_NOTE, fakeKey());
  await page.goto("/#escanear");
  const code = ean13("789100010010");
  const img = await distort(page, await ean13Png(page, code, 4), { width: 1000, fill: 0.8, rotate: 3, blur: 0.8, aspect: 0.75, type: "jpeg" });
  await sendPhoto(page, "Enviar foto", { name: "ean.jpg", mimeType: "image/jpeg", buffer: img });
  await expect(page.getByText(code).first()).toBeVisible({ timeout: 30_000 });
});

// ---------- câmera (vídeo falso do Chrome) ----------

async function fakeCamera(video: string | null): Promise<Browser> {
  return chromium.launch({
    channel: "chrome",
    args: ["--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream", ...(video ? [`--use-file-for-fake-video-capture=${video}`] : [])],
  });
}

async function cameraPage(browser: Browser, hash: string): Promise<Page> {
  const ctx = await browser.newContext({ permissions: ["camera"], baseURL: BASE });
  await ctx.addInitScript(TRACK_SPY);
  await ctx.addInitScript(SEED_NOTE, fakeKey());
  const page = await ctx.newPage();
  await page.goto("/" + hash);
  return page;
}

test.describe("câmera", () => {
  test("QR da nota pela câmera e câmera liberada depois", async ({ page: helper }, info) => {
    await helper.goto("/");
    const file = info.outputPath("qr.y4m");
    await writeY4m(helper, await qrPng(fakeQrUrl(), "M", 8), file, 1280, 720, 0.5, 7, 0.8);
    const browser = await fakeCamera(file);
    try {
      const page = await cameraPage(browser, "#importar");
      const t0 = Date.now();
      await page.getByRole("button", { name: "Ler QR com a câmera" }).click();
      await expect(page.getByText("Chave válida do RJ")).toBeVisible({ timeout: 20_000 });
      console.log(`QR pela câmera: ${Date.now() - t0} ms`);
      expect(await opened(page)).toBeGreaterThan(0);
      expect(await liveTracks(page)).toBe(0);
    } finally {
      await browser.close();
    }
  });

  test("EAN-13 pela câmera na tela Escanear", async ({ page: helper }, info) => {
    await helper.goto("/");
    const code = ean13("789100010010");
    const file = info.outputPath("ean.y4m");
    await writeY4m(helper, await ean13Png(helper, code, 4), file, 1280, 720, 0.5, 2, 0.6);
    const browser = await fakeCamera(file);
    try {
      const page = await cameraPage(browser, "#escanear");
      await page.getByRole("button", { name: "Abrir câmera" }).click();
      await expect(page.getByText(code).first()).toBeVisible({ timeout: 20_000 });
      expect(await liveTracks(page)).toBe(0);
    } finally {
      await browser.close();
    }
  });

  test("sem QR: dica depois de 8 s; fechar e sair da tela liberam a câmera", async () => {
    const browser = await fakeCamera(null); // imagem padrão do Chrome, sem QR
    try {
      const page = await cameraPage(browser, "#importar");
      await page.getByRole("button", { name: "Ler QR com a câmera" }).click();
      await expect(page.locator("video")).toBeVisible();
      await expect(page.getByText("Aproxime até o QR ocupar mais da metade da tela")).toBeVisible({ timeout: 15_000 });
      expect(await liveTracks(page)).toBeGreaterThan(0);
      await page.getByRole("button", { name: "Fechar câmera" }).click();
      await expect.poll(() => liveTracks(page)).toBe(0);

      // abre de novo e sai da tela sem fechar
      await page.getByRole("button", { name: "Ler QR com a câmera" }).click();
      await expect.poll(() => liveTracks(page)).toBeGreaterThan(0);
      await page.evaluate(() => { location.hash = "#inicio"; });
      await expect.poll(() => liveTracks(page)).toBe(0);
    } finally {
      await browser.close();
    }
  });
});
