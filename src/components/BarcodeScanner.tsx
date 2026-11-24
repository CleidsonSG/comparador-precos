import { useState } from "react";
import { decodeImageFile, PRODUCT_FORMATS } from "../lib/scan.ts";
import { useCameraReader } from "./useCameraReader.ts";
import CameraControls from "./CameraControls.tsx";

/** Lê código de barras (EAN/UPC) pela câmera ou por foto. Tudo roda no aparelho. */
export default function BarcodeScanner({ onCode }: { onCode: (code: string) => void }) {
  const cam = useCameraReader(PRODUCT_FORMATS, onCode);
  const [busy, setBusy] = useState(false);

  const fromPhoto = async (f: File | undefined) => {
    if (!f) return;
    cam.setErr("");
    setBusy(true);
    const text = await decodeImageFile(f, PRODUCT_FORMATS).catch(() => null);
    setBusy(false);
    if (text) onCode(text);
    else cam.setErr("Não encontrei um código de barras nessa foto. Aproxime, deixe o código reto e bem iluminado.");
  };

  return (
    <div>
      <div className={`scanner${cam.on ? " live" : ""}`}>
        {cam.on && <video ref={cam.video} muted playsInline autoPlay aria-label="Imagem da câmera para ler o código de barras" />}
        <span className="corner c1" aria-hidden="true" /><span className="corner c2" aria-hidden="true" />
        <span className="corner c3" aria-hidden="true" /><span className="corner c4" aria-hidden="true" />
        {cam.on && !cam.starting && <span className="line" aria-hidden="true" />}
        {cam.on && cam.starting && <p className="cam-wait">Abrindo a câmera…</p>}
        {!cam.on && <p>Aponte a câmera para o código de barras do produto</p>}
      </div>
      <CameraControls cam={cam} />
      {cam.on && (cam.slow
        ? <div className="msg warn" role="status">Aproxime até o código ocupar boa parte da tela, na horizontal e sem reflexo. Se não ler, envie uma foto ou digite o código.</div>
        : <p className="note" style={{ margin: "8px 0 0" }}>Deixe o código na horizontal, dentro dos cantos, com boa luz.</p>)}
      <div className="row" style={{ marginTop: 12 }}>
        {cam.on ? <button className="btn" onClick={cam.stop}>Fechar câmera</button> : <button className="btn tag" onClick={cam.start}>Abrir câmera</button>}
        <label className={`btn${busy ? " off" : ""}`} aria-disabled={busy || undefined}>
          {busy ? "Lendo a foto…" : "Enviar foto"}
          <input type="file" accept="image/*" className="sr" disabled={busy} onChange={(e) => { void fromPhoto(e.target.files?.[0]); e.target.value = ""; }} />
        </label>
      </div>
      {cam.err && <div className="msg bad" role="alert">{cam.err}</div>}
    </div>
  );
}
