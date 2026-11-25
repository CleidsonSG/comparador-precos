import { useCallback, useEffect, useRef, useState, type ComponentType } from "react";
import Home from "./pages/Home.tsx";
import Notes from "./pages/Notes.tsx";
import Import from "./pages/Import.tsx";
import Scan from "./pages/Scan.tsx";
import Cart from "./pages/Cart.tsx";
import Settings from "./pages/Settings.tsx";
import Compare from "./pages/Compare.tsx";
import { IconCart, IconDoc, IconGear, IconHome, IconMoon, IconScan } from "./components/Icons.tsx";
import { getStatus, startAutoSync, subscribe, type SyncStatus } from "./lib/sync.ts";
import { toggleTheme } from "./lib/theme.ts";
import { authErrorFromUrl } from "./lib/supabase.ts";
import { loadCart } from "./lib/cart.ts";
import ErrorBoundary from "./components/ErrorBoundary.tsx";
import { InstallSheet, StatusBars } from "./components/Pwa.tsx";

type View = "inicio" | "escanear" | "carrinho" | "importar" | "notas" | "ajustes" | "comparar" | "vinculos";
type Nav = "inicio" | "escanear" | "carrinho" | "notas";
const TITLES: Record<View, string> = { inicio: "Início", escanear: "Escanear produto", carrinho: "Carrinho", importar: "Importar nota", notas: "Notas fiscais", ajustes: "Configurações", comparar: "Comparar mercados", vinculos: "Comparar mercados" };
const LABELS: Record<Nav, string> = { inicio: "Início", escanear: "Escanear", carrinho: "Carrinho", notas: "Notas" };
const ICONS: Record<Nav, ComponentType> ={ inicio: IconHome, escanear: IconScan, carrinho: IconCart, notas: IconDoc };

function currentView(): View {
  const h = location.hash.slice(1).split("?")[0];
  if (h === "conta") return "ajustes"; // endereço antigo da conta
  return h === "escanear" || h === "carrinho" || h === "importar" || h === "notas" || h === "ajustes" || h === "comparar" || h === "vinculos" ? h : "inicio";
}

const settingsLabel = (s: SyncStatus): string =>
  s.state === "off" ? "Configurações" : s.state === "offline" ? "Configurações, sem internet" : s.state === "error" ? "Configurações, erro ao sincronizar"
    : s.pending ? "Configurações, alterações esperando envio" : "Configurações, conta sincronizada";

export default function App() {
  const [view, setView] = useState<View>(currentView());
  const [toastText, setToastText] = useState("");
  const [toastOn, setToastOn] = useState(false);
  const timer = useRef<number | undefined>(undefined);
  const [sync, setSync] = useState<SyncStatus>(getStatus);
  const [dataVersion, setDataVersion] = useState(0);
  const [cartCount, setCartCount] = useState(() => loadCart().length);

  useEffect(() => startAutoSync(), []);
  useEffect(() => subscribe(setSync), []);
  useEffect(() => {
    // dados chegaram da conta, ou mudaram no aparelho: atualiza a tela e o contador do carrinho
    const onData = () => { setDataVersion((v) => v + 1); setCartCount(loadCart().length); };
    const onChange = () => setCartCount(loadCart().length);
    window.addEventListener("gondola:data", onData);
    window.addEventListener("gondola:changed", onChange);
    window.addEventListener("storage", onChange);
    return () => {
      window.removeEventListener("gondola:data", onData);
      window.removeEventListener("gondola:changed", onChange);
      window.removeEventListener("storage", onChange);
    };
  }, []);

  useEffect(() => {
    const on = () => {
      setView(currentView());
      setCartCount(loadCart().length);
      window.scrollTo(0, 0);
    };
    window.addEventListener("hashchange", on);
    return () => window.removeEventListener("hashchange", on);
  }, []);

  const toast = useCallback((t: string) => {
    setToastText(t);
    setToastOn(true);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setToastOn(false), 2800);
  }, []);

  useEffect(() => {
    // volta do link do e-mail: erro (link vencido) ou login concluído
    const err = authErrorFromUrl();
    if (err) { history.replaceState(null, "", `${location.pathname}#ajustes`); setView("ajustes"); toast(err); }
    const ok = () => { toast("Conta conectada"); location.hash = "#ajustes"; };
    window.addEventListener("gondola:signedin", ok);
    return () => window.removeEventListener("gondola:signedin", ok);
  }, [toast]);

  const active: Nav | null = view === "importar" ? "notas" : view === "ajustes" ? null : view === "comparar" || view === "vinculos" ? "inicio" : view;
  const links = (["inicio", "escanear", "carrinho", "notas"] as Nav[]).map((v) => {
    const Icon = ICONS[v];
    return (
      <a key={v} className="nav" href={`#${v}`} aria-current={active === v ? "page" : undefined}>
        <Icon />
        <span>{LABELS[v]}</span>
        {v === "carrinho" && cartCount > 0 && <span className="dot num" aria-label={`${cartCount} ${cartCount === 1 ? "item" : "itens"}`}>{cartCount}</span>}
      </a>
    );
  });
  const syncDot = sync.state === "off" ? "" : ` ${sync.state}${sync.pending ? " pending" : ""}`;

  return (
    <div className="app">
      <aside className="side" aria-label="Navegação principal">
        <div className="brand cond"><i />Gôndola</div>
        {links}
        <a className="nav" href="#ajustes" aria-current={view === "ajustes" ? "page" : undefined}><IconGear /><span>Configurações</span></a>
      </aside>
      <main id="main">
        <div className="top">
          <h1>{TITLES[view]}</h1>
          <a className={`iconbtn sync${syncDot}`} href="#ajustes" aria-label={settingsLabel(sync)} title={settingsLabel(sync)} aria-current={view === "ajustes" ? "page" : undefined}>
            <IconGear size={20} />
          </a>
          <button className="iconbtn" onClick={toggleTheme} aria-label="Alternar tema claro e escuro"><IconMoon /></button>
        </div>
        <StatusBars pending={sync.pending} />
        <ErrorBoundary resetKey={view}>
        <div key={dataVersion} style={{ display: "contents" }}>
          {view === "inicio" && <Home />}
          {view === "escanear" && <Scan toast={toast} />}
          {view === "carrinho" && <Cart toast={toast} />}
          {view === "importar" && <Import toast={toast} />}
          {view === "notas" && <Notes toast={toast} />}
          {view === "ajustes" && <Settings toast={toast} />}
          {(view === "comparar" || view === "vinculos") && <Compare key={view} tab={view} toast={toast} />}
        </div>
        </ErrorBoundary>
      </main>
      <nav className="bottom" aria-label="Navegação principal">{links}</nav>
      <InstallSheet />
      <div className={`toast${toastOn ? " on" : ""}`} role="status" aria-live="polite">{toastText}</div>
    </div>
  );
}
