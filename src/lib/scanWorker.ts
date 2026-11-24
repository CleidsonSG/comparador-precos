// Leitor zxing-cpp (WebAssembly) rodando fora da tela, para a imagem da câmera não travar.
// O arquivo .wasm vem do próprio app (sem CDN): funciona offline depois do primeiro carregamento.
import { prepareZXingModule, readBarcodes, type ReaderOptions } from "zxing-wasm/reader";
import wasmUrl from "zxing-wasm/reader/zxing_reader.wasm?url";

prepareZXingModule({
  overrides: { locateFile: (path: string, prefix: string) => (path.endsWith(".wasm") ? wasmUrl : prefix + path) },
  fireImmediately: true,
});

// Cada tentativa usa um jeito diferente de separar preto e branco. Medido com fotos reais de cupom:
// o padrão lê a maioria; papel térmico com vinco ou sombra só lê com redução de ruído ou histograma global.
const VARIANTS: Partial<ReaderOptions>[] = [{}, { tryDenoise: true }, { binarizer: "GlobalHistogram" }];

export interface ScanRequest { id: number; image: ImageData; formats: string[]; variant: number }
export interface ScanReply { id: number; text: string | null; error?: string }

self.onmessage = async (e: MessageEvent<ScanRequest>) => {
  const { id, image, formats, variant } = e.data;
  try {
    const res = await readBarcodes(image, {
      formats: formats as ReaderOptions["formats"],
      tryHarder: true, tryInvert: true, tryRotate: true, maxNumberOfSymbols: 1,
      ...VARIANTS[variant % VARIANTS.length],
    });
    self.postMessage({ id, text: res.find((r) => r.isValid)?.text || null } satisfies ScanReply);
  } catch (err) {
    self.postMessage({ id, text: null, error: String(err) } satisfies ScanReply);
  }
};
