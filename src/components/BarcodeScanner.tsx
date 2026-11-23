import { readImageFile, type CodeFormat } from "../lib/codeReader.ts";
import { useCameraReader } from "./useCameraReader.ts";

const FORMATS: CodeFormat[] = ["ean_13", "ean_8", "upc_a", "upc_e", "code_128"];

/** Lê código de barras (EAN/UPC) pela câmera ou por foto. Tudo roda no aparelho. */
export default function BarcodeScanner({ onCode }: { onCode: (code: string) => void }) {
  const cam = useCameraReader(FORMATS, onCode);

  const fromPhoto = async (f: File | undefined) => {
    if (!f) return;
    cam.setErr("");
    const text = await readImageFile(f, FORMATS).catch(() => null);
    if (text) onCode(text);
    else cam.setErr("Não encontrei um código de barras nessa foto. Aproxime, deixe o código reto e bem iluminado.");
  };

  return (
    <div>
      <div className={`scanner${cam.on ? " live" : ""}`}>
        {cam.on && <video ref={cam.video} muted playsInline autoPlay aria-label="Imagem da câmera para ler o código de barras" />}
        <span className="corner c1" aria-hidden="true" /><span className="corner c2" aria-hidden="true" />
        <span className="corner c3" aria-hidden="true" /><span className="corner c4" aria-hidden="true" />
        {cam.on && <span className="line" aria-hidden="true" />}
        {!cam.on && <p>Aponte a câmera para o código de barras do produto</p>}
      </div>
      {cam.on && <p className="note" style={{ margin: "8px 0 0" }}>Deixe o código na horizontal, dentro dos cantos, com boa luz.</p>}
      <div className="row" style={{ marginTop: 12 }}>
        {cam.on ? <button className="btn" onClick={cam.stop}>Fechar câmera</button> : <button className="btn tag" onClick={cam.start}>Abrir câmera</button>}
        <label className="btn">
          Enviar foto
          <input type="file" accept="image/*" className="sr" onChange={(e) => { void fromPhoto(e.target.files?.[0]); e.target.value = ""; }} />
        </label>
      </div>
      {cam.err && <div className="msg bad" role="alert">{cam.err}</div>}
    </div>
  );
}
