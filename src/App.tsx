import { useCallback, useEffect, useRef, useState } from "react";
import Home from "./pages/Home.tsx";
import Notes from "./pages/Notes.tsx";
import Import from "./pages/Import.tsx";
import Scan from "./pages/Scan.tsx";
import Cart from "./pages/Cart.tsx";

type View = "inicio" | "escanear" | "carrinho" | "importar" | "notas";
type Nav = "inicio" | "escanear" | "carrinho" | "notas";
const TITLES: Record<View, string> = { inicio: "Início", escanear: "Escanear produto", carrinho: "Carrinho", importar: "Importar nota", notas: "Notas fiscais" };
const LABELS: Record<Nav, string> = { inicio: "Início", escanear: "Escanear", carrinho: "Carrinho", notas: "Notas" };

const icons = {
  inicio: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 11l9-8 9 8" /><path d="M5 10v10h14V10" /></svg>,
  carrinho: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="9" cy="20" r="1.5" /><circle cx="18" cy="20" r="1.5" /><path d="M2 3h3l2.5 12h11L21 7H6" /></svg>,
  escanear: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 8V5a1 1 0 011-1h3M16 4h3a1 1 0 011 1v3M20 16v3a1 1 0 01-1 1h-3M8 20H5a1 1 0 01-1-1v-3" /><path d="M7 12h10" /></svg>,
  notas: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 2h9l5 5v15H6z" /><path d="M14 2v6h6M9 13h8M9 17h8" /></svg>,
};

function currentView(): View {
  const h = location.hash.slice(1);
  return h === "escanear" || h === "carrinho" || h === "importar" || h === "notas" ? h : "inicio";
}

export default function App() {
  const [view, setView] = useState<View>(currentView());
  const [toastText, setToastText] = useState("");
  const [toastOn, setToastOn] = useState(false);
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => {
    const on = () => {
      setView(currentView());
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

  const toggleTheme = () => {
    const cur = document.documentElement.dataset.theme ?? (matchMedia("(prefers-color-scheme:dark)").matches ? "dark" : "light");
    const next = cur === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem("theme", next);
    } catch {
      /* ignora */
    }
  };

  const active: Nav = view === "importar" ? "notas" : view;
  const links = (["inicio", "escanear", "carrinho", "notas"] as Nav[]).map((v) => (
    <a key={v} className="nav" href={`#${v}`} aria-current={active === v ? "page" : undefined}>
      {v === "notas" ? icons.notas : icons[v]}
      <span>{LABELS[v]}</span>
    </a>
  ));

  return (
    <div className="app">
      <aside className="side" aria-label="Navegação principal">
        <div className="brand cond"><i />Gôndola</div>
        {links}
      </aside>
      <main id="main">
        <div className="top">
          <h1>{TITLES[view]}</h1>
          <button className="iconbtn" onClick={toggleTheme} aria-label="Alternar tema claro e escuro">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.8A9 9 0 1111.2 3a7 7 0 009.8 9.8z" /></svg>
          </button>
        </div>
        {view === "inicio" && <Home />}
        {view === "escanear" && <Scan toast={toast} />}
        {view === "carrinho" && <Cart toast={toast} />}
        {view === "importar" && <Import toast={toast} />}
        {view === "notas" && <Notes toast={toast} />}
      </main>
      <nav className="bottom" aria-label="Navegação principal">{links}</nav>
      <div className={`toast${toastOn ? " on" : ""}`} role="status" aria-live="polite">{toastText}</div>
    </div>
  );
}
