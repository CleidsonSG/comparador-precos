import { useEffect, useState } from "react";
import { getThemePref, setThemePref, type ThemePref } from "../lib/theme.ts";
import Account from "./Account.tsx";

export default function Settings({ toast }: { toast: (t: string) => void }) {
  const [theme, setTheme] = useState<ThemePref>(getThemePref);
  useEffect(() => {
    const on = () => setTheme(getThemePref());
    window.addEventListener("gondola:theme", on);
    return () => window.removeEventListener("gondola:theme", on);
  }, []);

  return (
    <div className="grid cols2">
      <Account toast={toast} />
      <section className="card" aria-labelledby="pref">
        <h2 id="pref">Preferências</h2>
        <div className="set">
          <div><label htmlFor="tema"><b>Tema</b></label><div className="note">Claro, escuro ou do sistema</div></div>
          <select id="tema" className="inline-select" value={theme} onChange={(e) => setThemePref(e.target.value as ThemePref)}>
            <option value="auto">Sistema</option>
            <option value="light">Claro</option>
            <option value="dark">Escuro</option>
          </select>
        </div>
        <div className="set">
          <div><b>Privacidade</b><div className="note">Nunca guardamos CPF nem nome do consumidor, nem no aparelho, nem na conta.</div></div>
        </div>
      </section>
    </div>
  );
}
