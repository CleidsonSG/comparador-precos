import { useCallback, useEffect, useRef, useState } from "react";
import { cameraErrorMessage, cameraUnavailable, listCameras, startCameraScan, type CameraScan, type CodeFormat } from "../lib/scan.ts";

export type { CodeFormat };

/**
 * Câmera para ler códigos. Só liga depois que o <video> está na tela.
 * Libera a câmera ao fechar, ao sair da tela e quando o app vai para segundo plano.
 */
export function useCameraReader(formats: CodeFormat[], onResult: (text: string) => void) {
  const video = useRef<HTMLVideoElement>(null);
  const done = useRef(onResult);
  done.current = onResult;
  const fmts = useRef(formats);
  const scan = useRef<CameraScan | null>(null);

  const [on, setOn] = useState(false);
  const [starting, setStarting] = useState(false);
  const [err, setErr] = useState("");
  const [slow, setSlow] = useState(false);
  const [cameras, setCameras] = useState<{ id: string; label: string }[]>([]);
  const [chosen, setChosen] = useState<string | undefined>(undefined); // escolha da pessoa (reinicia a câmera)
  const [current, setCurrent] = useState(""); // câmera em uso (só para mostrar)
  const [torchSupported, setTorchSupported] = useState(false);
  const [torch, setTorchOn] = useState(false);

  const stop = useCallback(() => setOn(false), []);
  const start = useCallback(() => {
    setErr("");
    const why = cameraUnavailable();
    if (why) { setErr(why); return; }
    setOn(true);
  }, []);

  useEffect(() => {
    const el = video.current;
    if (!on || !el) return;
    let cancelled = false;
    setStarting(true);
    setSlow(false);
    setTorchOn(false);
    setTorchSupported(false);

    startCameraScan(el, (text) => { scan.current = null; setOn(false); done.current(text); }, {
      formats: fmts.current,
      deviceId: chosen,
      onSlow: () => { if (!cancelled) setSlow(true); },
    }).then(async (s) => {
      if (cancelled) { s.stop(); return; }
      scan.current = s;
      setStarting(false);
      setCurrent(s.deviceId);
      setTorchSupported(s.torchSupported);
      const list = await listCameras();
      if (!cancelled) setCameras(list);
    }).catch((e) => {
      if (cancelled) return;
      setStarting(false);
      setOn(false);
      setErr(cameraErrorMessage(e));
    });

    // app em segundo plano ou aba escondida: desliga a câmera
    const onHide = () => { if (document.visibilityState === "hidden") setOn(false); };
    document.addEventListener("visibilitychange", onHide);

    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onHide);
      scan.current?.stop();
      scan.current = null;
      setStarting(false);
    };
  }, [on, chosen]);

  const chooseCamera = useCallback((id: string) => setChosen(id), []);
  const toggleTorch = useCallback(async () => {
    const s = scan.current;
    if (!s) return;
    if (await s.setTorch(!torch)) setTorchOn(!torch);
  }, [torch]);

  return { video, on, starting, err, setErr, slow, start, stop, cameras, current, chooseCamera, torchSupported, torch, toggleTorch };
}
