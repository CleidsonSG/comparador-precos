// Leitura de QR e código de barras, tudo no aparelho.
// 1º leitor nativo do navegador (BarcodeDetector, no Chrome do Android): rápido e bom com QR pequeno.
// 2º zxing-cpp em WebAssembly (iPhone e computador): bem mais robusto que o ZXing em JavaScript
//    com papel térmico e imagem com ruído. O arquivo .wasm é servido pelo próprio app (sem CDN).

export type CodeFormat = "qr_code" | "ean_13" | "ean_8" | "upc_a" | "upc_e" | "code_128";
type Source = ImageData | Blob;
export type Read = (src: Source) => Promise<string | null>;

const ZX: Record<CodeFormat, string> = { qr_code: "QRCode", ean_13: "EAN13", ean_8: "EAN8", upc_a: "UPCA", upc_e: "UPCE", code_128: "Code128" };

interface Detector { detect(src: ImageBitmapSource): Promise<{ rawValue: string }[]> }
interface DetectorCtor { new (o: { formats: string[] }): Detector; getSupportedFormats(): Promise<string[]> }

async function nativeRead(formats: CodeFormat[]): Promise<Read | null> {
  const BD = (window as unknown as { BarcodeDetector?: DetectorCtor }).BarcodeDetector;
  if (!BD) return null;
  try {
    const ok = (await BD.getSupportedFormats()).filter((f) => (formats as string[]).includes(f));
    if (ok.length !== formats.length) return null;
    const det = new BD({ formats: ok });
    return async (src) => {
      const img = src instanceof Blob ? await createImageBitmap(src) : src;
      try {
        return (await det.detect(img))[0]?.rawValue || null;
      } finally {
        if (img instanceof ImageBitmap) img.close();
      }
    };
  } catch {
    return null;
  }
}

let wasm: Promise<typeof import("zxing-wasm/reader")> | null = null;
function loadWasm() {
  wasm ??= (async () => {
    const [mod, url] = await Promise.all([import("zxing-wasm/reader"), import("zxing-wasm/reader/zxing_reader.wasm?url")]);
    mod.prepareZXingModule({ overrides: { locateFile: (path: string, prefix: string) => (path.endsWith(".wasm") ? url.default : prefix + path) }, fireImmediately: true });
    return mod;
  })();
  wasm.catch(() => { wasm = null; }); // sem internet na primeira vez: tenta de novo depois
  return wasm;
}

async function wasmRead(formats: CodeFormat[]): Promise<Read> {
  const mod = await loadWasm();
  const opts = { formats: formats.map((f) => ZX[f]) as never, tryHarder: true, tryInvert: true, tryRotate: true, maxNumberOfSymbols: 1 };
  return async (src) => {
    const res = await mod.readBarcodes(src, opts);
    return res.find((r) => r.isValid)?.text || null;
  };
}

/** Leitor preparado para os formatos pedidos (nativo, se o aparelho tiver; senão zxing-cpp). */
export async function makeReader(formats: CodeFormat[]): Promise<{ read: Read; engine: "nativo" | "zxing-cpp" }> {
  const n = await nativeRead(formats);
  if (n) return { read: n, engine: "nativo" };
  return { read: await wasmRead(formats), engine: "zxing-cpp" };
}

/** Lê uma foto: tenta o nativo e, se não achar, o zxing-cpp (que insiste mais). */
export async function readImageFile(file: Blob, formats: CodeFormat[]): Promise<string | null> {
  const n = await nativeRead(formats);
  if (n) {
    const t = await n(file).catch(() => null);
    if (t) return t;
  }
  return (await wasmRead(formats))(file);
}
