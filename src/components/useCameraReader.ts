import { useCallback, useEffect, useRef, useState } from "react";
import type { BrowserCodeReader, IScannerControls } from "@zxing/browser";

function cameraError(e: unknown): string {
  const name = e instanceof Error ? e.name : "";
  if (name === "NotAllowedError" || name === "SecurityError")
    return "O acesso à câmera foi negado. Toque no cadeado ao lado do endereço do site, permita a câmera e tente de novo, ou envie uma foto.";
  if (name === "NotFoundError" || name === "OverconstrainedError") return "Não encontrei uma câmera neste aparelho. Envie uma foto.";
  if (name === "NotReadableError" || name === "AbortError") return "A câmera está sendo usada por outro app. Feche o outro app e tente de novo.";
  return "Não consegui abrir a câmera. Tente de novo, ou envie uma foto.";
}

/**
 * Liga a câmera traseira e lê códigos com o ZXing. Tudo roda no aparelho.
 * A câmera só é ligada depois que o <video> está na tela: antes, a imagem ia para
 * um elemento invisível e o usuário via só a área preta.
 */
export function useCameraReader(makeReader: () => BrowserCodeReader, onResult: (text: string) => void) {
  const video = useRef<HTMLVideoElement>(null);
  const controls = useRef<IScannerControls | null>(null);
  const done = useRef(onResult);
  done.current = onResult;
  const make = useRef(makeReader);
  const [on, setOn] = useState(false);
  const [err, setErr] = useState("");

  const stop = useCallback(() => {
    controls.current?.stop();
    controls.current = null;
    setOn(false);
  }, []);

  const start = useCallback(() => {
    setErr("");
    if (!navigator.mediaDevices?.getUserMedia) {
      setErr(window.isSecureContext
        ? "Este navegador não permite usar a câmera aqui. Envie uma foto."
        : "A câmera só funciona em endereço seguro (https). Envie uma foto.");
      return;
    }
    setOn(true);
  }, []);

  useEffect(() => {
    if (!on || !video.current) return;
    let finished = false;
    make.current()
      .decodeFromConstraints({ audio: false, video: { facingMode: { ideal: "environment" } } }, video.current, (res) => {
        if (!res || finished) return;
        finished = true;
        controls.current?.stop();
        controls.current = null;
        setOn(false);
        done.current(res.getText());
      })
      .then((c) => {
        if (finished) c.stop();
        else controls.current = c;
      })
      .catch((e: unknown) => {
        if (finished) return;
        setOn(false);
        setErr(cameraError(e));
      });
    return () => {
      finished = true;
      controls.current?.stop();
      controls.current = null;
    };
  }, [on]);

  return { video, on, err, setErr, start, stop };
}
