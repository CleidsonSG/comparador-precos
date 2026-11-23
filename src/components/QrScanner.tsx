import { BrowserQRCodeReader } from "@zxing/browser";
import { useCameraReader } from "./useCameraReader.ts";

interface Props {
  onText: (text: string) => void;
}

/** Lê o QR do cupom pela câmera ou por foto. Tudo roda no aparelho; nada é enviado. */
export default function QrScanner({ onText }: Props) {
  const cam = useCameraReader(() => new BrowserQRCodeReader(), onText);

  const fromPhoto = async (f: File | undefined) => {
    if (!f) return;
    cam.setErr("");
    const url = URL.createObjectURL(f);
    try {
      const res = await new BrowserQRCodeReader().decodeFromImageUrl(url);
      onText(res.getText());
    } catch {
      cam.setErr("Não encontrei um QR nessa foto. Aproxime, deixe o QR reto e bem iluminado, e tente de novo.");
    } finally {
      URL.revokeObjectURL(url);
    }
  };

  return (
    <div>
      {cam.on && (
        <div className="scanner live">
          <video ref={cam.video} muted playsInline autoPlay aria-label="Imagem da câmera para ler o QR do cupom" />
          <span className="corner c1" aria-hidden="true" /><span className="corner c2" aria-hidden="true" />
          <span className="corner c3" aria-hidden="true" /><span className="corner c4" aria-hidden="true" />
          <span className="line" aria-hidden="true" />
        </div>
      )}
      <div className="row" style={{ marginTop: cam.on ? 12 : 0 }}>
        {cam.on ? (
          <button className="btn" onClick={cam.stop}>Fechar câmera</button>
        ) : (
          <button className="btn tag" onClick={cam.start}>Ler QR com a câmera</button>
        )}
        <label className="btn">
          Enviar foto do QR
          <input type="file" accept="image/*" className="sr" onChange={(e) => { void fromPhoto(e.target.files?.[0]); e.target.value = ""; }} />
        </label>
      </div>
      {cam.err && <div className="msg bad" role="alert">{cam.err}</div>}
    </div>
  );
}
