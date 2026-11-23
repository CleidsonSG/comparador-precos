import { readImageFile } from "../lib/codeReader.ts";
import { useCameraReader } from "./useCameraReader.ts";

interface Props {
  onText: (text: string) => void;
}

/** Lê o QR do cupom pela câmera ou por foto. Tudo roda no aparelho; nada é enviado. */
export default function QrScanner({ onText }: Props) {
  const cam = useCameraReader(["qr_code"], onText);

  const fromPhoto = async (f: File | undefined) => {
    if (!f) return;
    cam.setErr("");
    const text = await readImageFile(f, ["qr_code"]).catch(() => null);
    if (text) onText(text);
    else cam.setErr("Não encontrei o QR nessa foto. Tire a foto de perto, com o QR ocupando boa parte da imagem, reto e bem iluminado.");
  };

  return (
    <div>
      {cam.on && (
        <>
          <div className="scanner live">
            <video ref={cam.video} muted playsInline autoPlay aria-label="Imagem da câmera para ler o QR do cupom" />
            <span className="corner c1" aria-hidden="true" /><span className="corner c2" aria-hidden="true" />
            <span className="corner c3" aria-hidden="true" /><span className="corner c4" aria-hidden="true" />
            <span className="line" aria-hidden="true" />
          </div>
          <p className="note" style={{ margin: "8px 0 0" }}>Deixe o QR dentro dos cantos, a uns 15 cm, com boa luz e sem reflexo. Espere a imagem focar.</p>
        </>
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
