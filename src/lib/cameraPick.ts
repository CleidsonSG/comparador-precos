// Escolha da câmera. No Android o Chrome nomeia as câmeras "camera 0, facing back", "camera 2, facing back"...
// A camera 0 é a principal; pedir só "traseira" (facingMode) às vezes cai na ultra-angular ou na tele,
// que focam mal de perto. Então, havendo mais de uma traseira numerada, preferimos a de menor número.

export interface Cam { id: string; label: string }

interface Parsed { n: number | null; facing: "back" | "front" | null }

export function parseCameraLabel(label: string): Parsed {
  const l = label.toLowerCase();
  const m = /camera\s*(\d+)/.exec(l);
  const facing = /facing back|back|rear|traseira|environment/.test(l) ? "back" : /facing front|front|frontal|user|selfie/.test(l) ? "front" : null;
  return { n: m ? Number(m[1]) : null, facing };
}

/** Câmera traseira principal (menor número), quando os nomes permitem saber; senão null. */
export function preferredCamera(list: Cam[]): Cam | null {
  const backs = list
    .map((c) => ({ c, p: parseCameraLabel(c.label) }))
    .filter((x) => x.p.facing === "back" && x.p.n !== null)
    .sort((a, b) => (a.p.n as number) - (b.p.n as number));
  return backs[0]?.c ?? null;
}

/** Nome em português para o seletor. */
export function cameraName(c: Cam, list: Cam[]): string {
  const p = parseCameraLabel(c.label);
  if (p.n === null || !p.facing) return c.label;
  if (p.facing === "front") return `Frontal ${p.n}`;
  return preferredCamera(list)?.id === c.id ? `Traseira ${p.n} (principal)` : `Traseira ${p.n}`;
}

const KEY = "gondola.camera";
export function rememberedCamera(): string | undefined {
  try { return localStorage.getItem(KEY) || undefined; } catch { return undefined; }
}
export function rememberCamera(id: string | null): void {
  try { if (id) localStorage.setItem(KEY, id); else localStorage.removeItem(KEY); } catch { /* ignora */ }
}
