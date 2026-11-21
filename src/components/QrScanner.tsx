import { useEffect, useRef, useState } from "react";
import { BrowserQRCodeReader, type IScannerControls } from "@zxing/browser";

interface Props {
  onText: (text: string) => void;
}

/** Lê QR pela câmera ou por foto. Tudo roda no aparelho; nada é enviado. */
export default function QrScanner({ onText }: Props) {
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
      setErr("Este navegador não permite usar a câmera aqui. Envie uma foto do QR ou digite a chave.");
      return;
    }
    setOn(true);
    try {
      const reader = new BrowserQRCodeReader();
      controls.current = await reader.decodeFromVideoDevice(undefined, video.current ?? undefined, (res) => {
        if (res) {
          stop();
          onText(res.getText());
        }
      });
    } catch {
      setOn(false);
      setErr("Não consegui abrir a câmera. Permita o acesso nas configurações do navegador, ou envie uma foto do QR.");
    }
  };

  const fromPhoto = async (f: File | undefined) => {
    if (!f) return;
    setErr("");
    const url = URL.createObjectURL(f);
    try {
      const res = await new BrowserQRCodeReader().decodeFromImageUrl(url);
      onText(res.getText());
    } catch {
      setErr("Não encontrei um QR nessa foto. Aproxime, deixe o QR reto e bem iluminado, e tente de novo.");
    } finally {
      URL.revokeObjectURL(url);
    }
  };

  return (
    <div>
      {on && <video ref={video} className="video" muted playsInline aria-label="Imagem da câmera para ler o QR" />}
      <div className="row">
        {on ? (
          <button className="btn" onClick={stop}>Parar câmera</button>
        ) : (
          <button className="btn tag" onClick={start}>Ler QR com a câmera</button>
        )}
        <label className="btn">
          Enviar foto do QR
          <input type="file" accept="image/*" className="sr" onChange={(e) => { void fromPhoto(e.target.files?.[0]); e.target.value = ""; }} />
        </label>
      </div>
      {err && <div className="msg bad" role="alert">{err}</div>}
    </div>
  );
}
