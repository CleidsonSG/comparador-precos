import { useCallback, useEffect, useRef, useState } from "react";
import { makeReader, type CodeFormat } from "../lib/codeReader.ts";

export type { CodeFormat };

// Câmera traseira, resolução alta: o QR da NFC-e é pequeno e denso; em 640x480 os módulos somem.
const CONSTRAINTS: MediaStreamConstraints = {
  audio: false,
  video: { facingMode: { ideal: "environment" }, width: { ideal: 1920 }, height: { ideal: 1080 } },
};

function cameraError(e: unknown): string {
  const name = e instanceof Error ? e.name : "";
  if (name === "NotAllowedError" || name === "SecurityError")
    return "O acesso à câmera foi negado. Toque no cadeado ao lado do endereço do site, permita a câmera e tente de novo, ou envie uma foto.";
  if (name === "NotFoundError" || name === "OverconstrainedError") return "Não encontrei uma câmera neste aparelho. Envie uma foto.";
  if (name === "NotReadableError" || name === "AbortError") return "A câmera está sendo usada por outro app. Feche o outro app e tente de novo.";
  return "Não consegui abrir a câmera. Tente de novo, ou envie uma foto.";
}

/** Foco contínuo quando o aparelho permite (sem ele o QR do cupom fica borrado de perto). */
function continuousFocus(stream: MediaStream): void {
  const track = stream.getVideoTracks()[0];
  const caps = (track?.getCapabilities?.() ?? {}) as { focusMode?: string[] };
  if (caps.focusMode?.includes("continuous")) {
    void track.applyConstraints({ advanced: [{ focusMode: "continuous" } as MediaTrackConstraintSet] }).catch(() => undefined);
  }
}

/**
 * Liga a câmera traseira e lê códigos quadro a quadro. Tudo roda no aparelho.
 * A câmera só é ligada depois que o <video> está na tela (antes, a imagem ia para um elemento invisível).
 */
export function useCameraReader(formats: CodeFormat[], onResult: (text: string) => void) {
  const video = useRef<HTMLVideoElement>(null);
  const done = useRef(onResult);
  done.current = onResult;
  const fmts = useRef(formats);
  const [on, setOn] = useState(false);
  const [err, setErr] = useState("");

  const stop = useCallback(() => setOn(false), []);
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
    const el = video.current;
    if (!on || !el) return;
    let finished = false;
    let timer = 0;
    let stream: MediaStream | null = null;
    const release = () => { window.clearTimeout(timer); stream?.getTracks().forEach((t) => t.stop()); stream = null; };
    const end = (fn: () => void) => { if (finished) return; finished = true; release(); setOn(false); fn(); };

    void (async () => {
      try {
        // câmera e leitor em paralelo (o leitor pode precisar baixar o motor na primeira vez)
        const [s, reader] = await Promise.all([navigator.mediaDevices.getUserMedia(CONSTRAINTS), makeReader(fmts.current)]);
        stream = s;
        if (finished) { release(); return; }
        el.srcObject = s;
        continuousFocus(s);
        await el.play().catch(() => undefined);
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        const tick = async () => {
          if (finished || !ctx) return;
          try {
            if (el.readyState >= 2 && el.videoWidth) {
              canvas.width = el.videoWidth;
              canvas.height = el.videoHeight;
              ctx.drawImage(el, 0, 0);
              const text = await reader.read(ctx.getImageData(0, 0, canvas.width, canvas.height));
              if (text) { end(() => done.current(text)); return; }
            }
          } catch { /* quadro ruim: tenta o próximo */ }
          timer = window.setTimeout(() => void tick(), 100);
        };
        void tick();
      } catch (e) {
        end(() => setErr(cameraError(e)));
      }
    })();

    return () => { finished = true; release(); };
  }, [on]);

  return { video, on, err, setErr, start, stop };
}
