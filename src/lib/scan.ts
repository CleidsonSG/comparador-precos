// Leitura de QR (nota) e código de barras (produto), tudo no aparelho. Nada é enviado.
// 1º leitor nativo do navegador (BarcodeDetector, Chrome do Android), quando existe.
// 2º zxing-cpp em WebAssembly num worker, com três jeitos de tratar a imagem (ver scanWorker.ts).
//    É carregado só quando a câmera abre ou uma foto é enviada (import dinâmico do worker).
import type { ScanReply, ScanRequest } from "./scanWorker.ts";

export type CodeFormat = "qr_code" | "ean_13" | "ean_8" | "upc_a" | "upc_e";
export const QR_FORMATS: CodeFormat[] = ["qr_code"];
export const PRODUCT_FORMATS: CodeFormat[] = ["ean_13", "ean_8", "upc_a", "upc_e"];

const ZX: Record<CodeFormat, string> = { qr_code: "QRCode", ean_13: "EAN13", ean_8: "EAN8", upc_a: "UPCA", upc_e: "UPCE" };
const ZX_VARIANTS = 3;

// ---------- zxing-cpp (worker) ----------

let worker: Worker | null = null;
let seq = 0;
const pending = new Map<number, { ok: (t: string | null) => void; fail: (e: Error) => void }>();

function resetWorker(reason: string) {
  worker?.terminate();
  worker = null;
  for (const p of pending.values()) p.fail(new Error(reason));
  pending.clear();
}

function getWorker(): Worker {
  if (worker) return worker;
  const w = new Worker(new URL("./scanWorker.ts", import.meta.url), { type: "module" });
  w.onmessage = (e: MessageEvent<ScanReply>) => {
    const p = pending.get(e.data.id);
    if (!p) return;
    pending.delete(e.data.id);
    // erro do motor (ex.: sem internet na primeira vez, sem o .wasm): recria o worker na próxima tentativa
    if (e.data.error) { p.fail(new Error(e.data.error)); resetWorker(e.data.error); }
    else p.ok(e.data.text);
  };
  w.onerror = () => resetWorker("Não consegui carregar o leitor.");
  worker = w;
  return w;
}

function zxingRead(image: ImageData, formats: CodeFormat[], variant: number): Promise<string | null> {
  return new Promise((ok, fail) => {
    const id = ++seq;
    pending.set(id, { ok, fail });
    const msg: ScanRequest = { id, image, formats: formats.map((f) => ZX[f]), variant };
    getWorker().postMessage(msg, [image.data.buffer]);
  });
}

// ---------- leitor nativo ----------

interface NativeDetector { detect(src: ImageBitmapSource): Promise<{ rawValue: string }[]> }
interface NativeCtor { new (o: { formats: string[] }): NativeDetector; getSupportedFormats(): Promise<string[]> }

async function nativeDetector(formats: CodeFormat[]): Promise<NativeDetector | null> {
  const BD = (window as unknown as { BarcodeDetector?: NativeCtor }).BarcodeDetector;
  if (!BD) return null;
  try {
    const supported = await BD.getSupportedFormats();
    if (!formats.every((f) => supported.includes(f))) return null;
    return new BD({ formats });
  } catch {
    return null;
  }
}

// ---------- detector ----------

export interface Detector {
  engine: "nativo" | "zxing-cpp";
  /** Leitor nativo, quando o aparelho tem. Aceita o próprio <video>. */
  native: ((src: ImageBitmapSource) => Promise<string | null>) | null;
  /** zxing-cpp. `variant` escolhe o tratamento da imagem (0, 1, 2...). A imagem é transferida (não reutilize). */
  zxing: (image: ImageData, variant: number) => Promise<string | null>;
  variants: number;
}

export async function createDetector(formats: CodeFormat[]): Promise<Detector> {
  const nat = await nativeDetector(formats);
  if (!nat) getWorker(); // já começa a baixar o motor
  return {
    engine: nat ? "nativo" : "zxing-cpp",
    native: nat ? async (src) => (await nat.detect(src))[0]?.rawValue || null : null,
    zxing: (image, variant) => zxingRead(image, formats, variant),
    variants: ZX_VARIANTS,
  };
}

function toImageData(src: CanvasImageSource, w: number, h: number, outW = w, outH = h): ImageData {
  const c = document.createElement("canvas");
  c.width = outW;
  c.height = outH;
  const ctx = c.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("Sem canvas");
  ctx.drawImage(src, 0, 0, w, h, 0, 0, outW, outH);
  return ctx.getImageData(0, 0, outW, outH);
}

// ---------- foto enviada ----------

/** Lê uma foto: respeita a rotação da câmera; tenta inteira e depois reduzida (1600 e 1000 px). */
export async function decodeImageFile(file: Blob, formats: CodeFormat[]): Promise<string | null> {
  const det = await createDetector(formats);
  const bmp = await createImageBitmap(file, { imageOrientation: "from-image" }).catch(() => createImageBitmap(file));
  try {
    const big = Math.max(bmp.width, bmp.height);
    const sizes = [big, 1600, 1000].filter((s, i, a) => s <= big && a.indexOf(s) === i);
    for (const size of sizes) {
      const k = size / big;
      const w = Math.max(1, Math.round(bmp.width * k));
      const h = Math.max(1, Math.round(bmp.height * k));
      if (det.native) {
        const t = await det.native(toImageData(bmp, bmp.width, bmp.height, w, h)).catch(() => null);
        if (t) return t;
      }
      for (let v = 0; v < det.variants; v++) {
        const t = await det.zxing(toImageData(bmp, bmp.width, bmp.height, w, h), v);
        if (t) return t;
      }
    }
    return null;
  } finally {
    bmp.close();
  }
}

// ---------- câmera ao vivo ----------

export interface CameraScanOptions {
  formats: CodeFormat[];
  /** Câmera escolhida pela pessoa; sem ela, pede a traseira. */
  deviceId?: string;
  /** Intervalo entre leituras (padrão 150 ms). */
  intervalMs?: number;
  /** Chamado uma vez se passar `slowAfterMs` (padrão 8 s) sem ler. */
  onSlow?: () => void;
  slowAfterMs?: number;
}

export interface CameraScan {
  stop(): void;
  engine: Detector["engine"];
  deviceId: string;
  torchSupported: boolean;
  setTorch(on: boolean): Promise<boolean>;
}

function constraints(deviceId?: string): MediaStreamConstraints {
  // Resolução alta: o QR da NFC-e é denso (143 caracteres); em 640x480 os módulos somem.
  const size = { width: { ideal: 1920 }, height: { ideal: 1080 } };
  return { audio: false, video: deviceId ? { deviceId: { exact: deviceId }, ...size } : { facingMode: { ideal: "environment" }, ...size } };
}

/**
 * Liga a câmera no <video> e tenta ler a cada ~150 ms. Para sozinho ao ler.
 * Sempre chame stop() ao sair da tela: ele libera todas as trilhas da câmera.
 * Erros de getUserMedia são repassados (use cameraErrorMessage para o texto).
 */
export async function startCameraScan(video: HTMLVideoElement, onResult: (text: string) => void, opts: CameraScanOptions): Promise<CameraScan> {
  const [stream, det] = await Promise.all([navigator.mediaDevices.getUserMedia(constraints(opts.deviceId)), createDetector(opts.formats)]);
  const track = stream.getVideoTracks()[0];
  let stopped = false;
  let timer = 0;
  const stop = () => {
    stopped = true;
    window.clearTimeout(timer);
    stream.getTracks().forEach((t) => t.stop());
    if (video.srcObject === stream) video.srcObject = null;
  };

  const caps = (track?.getCapabilities?.() ?? {}) as { focusMode?: string[]; torch?: boolean };
  if (caps.focusMode?.includes("continuous")) {
    try { await track.applyConstraints({ advanced: [{ focusMode: "continuous" } as MediaTrackConstraintSet] }); } catch { /* sem foco contínuo */ }
  }

  video.srcObject = stream;
  await video.play().catch(() => undefined);

  const interval = opts.intervalMs ?? 150;
  const slowAfter = opts.slowAfterMs ?? 8000;
  const t0 = performance.now();
  let n = 0;
  let zx = 0;
  let slowSent = false;

  const tick = async () => {
    if (stopped) return;
    const started = performance.now();
    try {
      if (video.readyState >= 2 && video.videoWidth) {
        // nativo primeiro; se não ler em 2 s, alterna com o zxing-cpp (que lê papel com ruído)
        const useZx = !det.native || (started - t0 > 2000 && n % 2 === 1);
        n++;
        const text = useZx
          ? await det.zxing(toImageData(video, video.videoWidth, video.videoHeight), zx++)
          : await det.native!(video);
        if (text && !stopped) { stop(); onResult(text); return; }
      }
    } catch { /* quadro ruim ou motor ainda carregando: tenta o próximo */ }
    if (stopped) return;
    if (!slowSent && performance.now() - t0 > slowAfter) { slowSent = true; opts.onSlow?.(); }
    timer = window.setTimeout(() => void tick(), Math.max(30, interval - (performance.now() - started)));
  };
  void tick();

  return {
    stop,
    engine: det.engine,
    deviceId: track?.getSettings?.().deviceId ?? "",
    torchSupported: !!caps.torch,
    setTorch: async (on) => {
      try { await track.applyConstraints({ advanced: [{ torch: on } as MediaTrackConstraintSet] }); return true; } catch { return false; }
    },
  };
}

/** Câmeras do aparelho (os nomes só aparecem depois da permissão). */
export async function listCameras(): Promise<{ id: string; label: string }[]> {
  try {
    const all = await navigator.mediaDevices.enumerateDevices();
    return all.filter((d) => d.kind === "videoinput" && d.deviceId).map((d, i) => ({ id: d.deviceId, label: d.label || `Câmera ${i + 1}` }));
  } catch {
    return [];
  }
}

export function cameraErrorMessage(e: unknown): string {
  const name = e instanceof Error ? e.name : "";
  if (name === "NotAllowedError" || name === "SecurityError")
    return "O acesso à câmera foi negado. Toque no cadeado ao lado do endereço do site, permita a câmera e tente de novo, ou envie uma foto.";
  if (name === "NotFoundError" || name === "OverconstrainedError") return "Não encontrei uma câmera neste aparelho. Envie uma foto.";
  if (name === "NotReadableError" || name === "AbortError") return "A câmera está sendo usada por outro app. Feche o outro app e tente de novo.";
  return "Não consegui abrir a câmera. Tente de novo, ou envie uma foto.";
}

/** Motivo para não abrir a câmera, ou "" se dá para tentar. */
export function cameraUnavailable(): string {
  if (typeof navigator.mediaDevices?.getUserMedia === "function") return "";
  return window.isSecureContext
    ? "Este navegador não permite usar a câmera aqui. Envie uma foto ou digite o código."
    : "A câmera só funciona em endereço seguro (https). Envie uma foto ou digite o código.";
}
