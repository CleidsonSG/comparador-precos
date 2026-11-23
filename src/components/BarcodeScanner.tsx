import { BrowserMultiFormatReader } from "@zxing/browser";
import { useCameraReader } from "./useCameraReader.ts";

/** Lê código de barras (EAN/UPC) pela câmera ou por foto. Tudo roda no aparelho. */
export default function BarcodeScanner({ onCode }: { onCode: (code: string) => void }) {
  const cam = useCameraReader(() => new BrowserMultiFormatReader(), onCode);

  const fromPhoto = async (f: File | undefined) => {
    if (!f) return;
    cam.setErr("");
    const url = URL.createObjectURL(f);
    try {
      onCode((await new BrowserMultiFormatReader().decodeFromImageUrl(url)).getText());
    } catch {
      cam.setErr("Não encontrei um código de barras nessa foto. Aproxime, deixe o código reto e bem iluminado.");
    } finally {
      URL.revokeObjectURL(url);
    }
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
