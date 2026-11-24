import type { useCameraReader } from "./useCameraReader.ts";

type Cam = ReturnType<typeof useCameraReader>;

/** Seletor de câmera (quando há mais de uma) e lanterna (quando o aparelho permite). */
export default function CameraControls({ cam }: { cam: Cam }) {
  if (!cam.on || (cam.cameras.length < 2 && !cam.torchSupported)) return null;
  return (
    <div className="row cam-ctl">
      {cam.cameras.length > 1 && (
        <label className="cam-pick">
          <span className="sr">Câmera</span>
          <select className="inline-select" value={cam.current} onChange={(e) => cam.chooseCamera(e.target.value)} aria-label="Escolher câmera">
            {!cam.cameras.some((c) => c.id === cam.current) && <option value={cam.current}>Câmera atual</option>}
            {cam.cameras.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
          </select>
        </label>
      )}
      {cam.torchSupported && (
        <button className="btn" aria-pressed={cam.torch} onClick={() => void cam.toggleTorch()}>
          {cam.torch ? "Apagar lanterna" : "Acender lanterna"}
        </button>
      )}
    </div>
  );
}
