import { useEffect, useRef, useState } from "react";
import { BrowserMultiFormatReader, type IScannerControls } from "@zxing/browser";

/** Lê código de barras (EAN/UPC) pela câmera ou por foto. Tudo roda no aparelho. */
export default function BarcodeScanner({ onCode }: { onCode: (code: string) => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const controls = useRef<IScannerControls | null>(null);
  const [on, setOn] = useState(false);
  const [err, setErr] = useState("");

  const stop = () => {
    controls.current?.stop();
    controls.current = null;
    setOn(false);
  };
  useEffect(() => () => controls.current?.stop(), []);

  const start = async () => {
    setErr("");
    if (!navigator.mediaDevices?.getUserMedia) {
      setErr("Este navegador não permite usar a câmera aqui. Envie uma foto do código ou digite os números.");
      return;
    }
    setOn(true);
    try {
      controls.current = await new BrowserMultiFormatReader().decodeFromVideoDevice(undefined, video.current ?? undefined, (res) => {
        if (res) {
          stop();
          onCode(res.getText());
        }
      });
    } catch {
      setOn(false);
      setErr("Não consegui abrir a câmera. Permita o acesso nas configurações do navegador, ou envie uma foto.");
    }
  };

  const fromPhoto = async (f: File | undefined) => {
    if (!f) return;
    setErr("");
    const url = URL.createObjectURL(f);
    try {
      onCode((await new BrowserMultiFormatReader().decodeFromImageUrl(url)).getText());
    } catch {
      setErr("Não encontrei um código de barras nessa foto. Aproxime, deixe o código reto e bem iluminado.");
    } finally {
      URL.revokeObjectURL(url);
    }
  };

  return (
    <div>
      {on && <video ref={video} className="video" muted playsInline aria-label="Imagem da câmera para ler o código de barras" />}
      <div className="row">
        {on ? <button className="btn" onClick={stop}>Parar câmera</button> : <button className="btn tag" onClick={start}>Ler código com a câmera</button>}
        <label className="btn">
          Enviar foto
          <input type="file" accept="image/*" className="sr" onChange={(e) => { void fromPhoto(e.target.files?.[0]); e.target.value = ""; }} />
        </label>
      </div>
      {err && <div className="msg bad" role="alert">{err}</div>}
    </div>
  );
}
