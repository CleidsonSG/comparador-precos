// Instalação como app (WebAPK no Android) e atualização do service worker.
// O navegador só instala depois de um toque da pessoa: guardamos o pedido do Chrome
// (beforeinstallprompt) e mostramos o nosso botão "Instalar".
import { useEffect, useState } from "react";
import { registerSW } from "virtual:pwa-register";

interface InstallEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

type Listener = () => void;
const listeners = new Set<Listener>();
const emit = () => listeners.forEach((l) => l());

let deferred: InstallEvent | null = null;
let installed = false;
let needRefresh = false;
let updateSW: ((reload?: boolean) => Promise<void>) | null = null;

export function isStandalone(): boolean {
  return matchMedia("(display-mode: standalone)").matches || (navigator as unknown as { standalone?: boolean }).standalone === true;
}

export function isIOS(): boolean {
  const ua = navigator.userAgent;
  return /iPhone|iPad|iPod/.test(ua) || (ua.includes("Macintosh") && navigator.maxTouchPoints > 1);
}

/** Chamar o quanto antes (main.tsx), para não perder o aviso do Chrome. */
export function initPwa(): void {
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault(); // usa o nosso botão em vez da faixa do Chrome
    deferred = e as InstallEvent;
    emit();
  });
  window.addEventListener("appinstalled", () => {
    installed = true;
    deferred = null;
    emit();
  });
  if (import.meta.env.PROD && "serviceWorker" in navigator) {
    updateSW = registerSW({
      immediate: true,
      onNeedRefresh() { needRefresh = true; emit(); },
      onRegisteredSW(_url, reg) {
        // procura versão nova a cada hora e quando o app volta para a frente
        if (!reg) return;
        const check = () => { if (navigator.onLine) void reg.update().catch(() => undefined); };
        setInterval(check, 60 * 60 * 1000);
        document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") check(); });
      },
    });
  }
}

export interface PwaState {
  /** o Chrome deixou instalar agora (Android, computador) */
  canInstall: boolean;
  /** já está aberto como app instalado */
  standalone: boolean;
  installed: boolean;
  ios: boolean;
  needRefresh: boolean;
}

function snapshot(): PwaState {
  return { canInstall: !!deferred, standalone: isStandalone(), installed, ios: isIOS(), needRefresh };
}

export function usePwa(): PwaState {
  const [s, setS] = useState<PwaState>(snapshot);
  useEffect(() => {
    const l = () => setS(snapshot());
    listeners.add(l);
    l();
    return () => { listeners.delete(l); };
  }, []);
  return s;
}

/** Abre a janela de instalação do Chrome. Precisa ser chamado num toque. */
export async function install(): Promise<"accepted" | "dismissed" | "unavailable"> {
  const ev = deferred;
  if (!ev) return "unavailable";
  deferred = null;
  emit();
  await ev.prompt();
  const { outcome } = await ev.userChoice;
  if (outcome === "accepted") installed = true;
  emit();
  return outcome;
}

/** Troca para a versão nova e recarrega. */
export async function applyUpdate(): Promise<void> {
  needRefresh = false;
  emit();
  if (updateSW) await updateSW(true);
  else location.reload();
}

const DISMISS_KEY = "gondola.install.dismissed";
export function installDismissed(): boolean {
  try { return !!localStorage.getItem(DISMISS_KEY); } catch { return false; }
}
export function dismissInstall(): void {
  try { localStorage.setItem(DISMISS_KEY, new Date().toISOString()); } catch { /* ignora */ }
}
