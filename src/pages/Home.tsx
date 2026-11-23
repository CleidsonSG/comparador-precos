import { useMemo, useState } from "react";
import PriceChart from "../components/PriceChart.tsx";
import { money } from "../lib/format.ts";
import { loadNotes } from "../lib/storage.ts";
import { averageChange, priceChanges, spendByMonth, spendByStore } from "../modules/prices/analytics.ts";

const pct = (p: number) => `${p > 0 ? "+" : ""}${(p * 100).toFixed(1).replace(".", ",")}%`;
const monthName = (m: string) => new Date(`${m}-15T12:00:00`).toLocaleDateString("pt-BR", { month: "long" });

function Badge({ p }: { p: number }) {
  const up = p > 0.0005, down = p < -0.0005;
  return (
    <span className={`pill ${up ? "bad" : down ? "good" : ""}`}>
      {up ? "↑ " : down ? "↓ " : "= "}{up || down ? pct(p) : "sem mudança"}
    </span>
  );
}

export default function Home() {
  const notes = useMemo(loadNotes, []);
  const changes = useMemo(() => priceChanges(notes), [notes]);
  const months = useMemo(() => spendByMonth(notes), [notes]);
  const stores = useMemo(() => spendByStore(notes), [notes]);
  const avg = averageChange(changes);
  const charts = useMemo(() => [...changes].sort((a, b) => b.history.length - a.history.length || a.description.localeCompare(b.description)), [changes]);
  const [sel, setSel] = useState(0);

  if (notes.length === 0)
    return (
      <div className="card empty">
        <h3>Comece pela primeira nota</h3>
        <p>Leia o QR do cupom ou digite a chave. Os preços ficam guardados para comparar na próxima compra.</p>
        <a className="btn tag" href="#importar">Importar nota</a>
      </div>
    );

  const last = months[months.length - 1]!;
  const before = months[months.length - 2];
  const delta = before ? (last.cents - before.cents) / before.cents : null;
  const maxStore = stores[0]!.cents;
  const risers = [...changes].filter((c) => c.pct > 0.0005).sort((a, b) => b.pct - a.pct).slice(0, 5);
  const chosen = charts[Math.min(sel, charts.length - 1)];

  return (
    <>
      <div className="grid kpis">
        <div className="card kpi">
          <div className="note">Gasto em {monthName(last.month)}</div>
          <div className="v cond num">{money(last.cents)}</div>
          {delta !== null ? <Badge p={delta} /> : <span className="pill">primeiro mês registrado</span>}
        </div>
        <div className="card kpi">
          <div className="note">Variação dos seus preços</div>
          <div className="v cond num">{avg === null ? "—" : pct(avg)}</div>
          {avg === null ? <span className="pill">precisa de um produto comprado 2 vezes</span> : <span className="note">média de {changes.length} {changes.length === 1 ? "produto repetido" : "produtos repetidos"}</span>}
        </div>
        <div className="card kpi">
          <div className="note">Notas e itens</div>
          <div className="v cond num">{notes.length} · {notes.reduce((s, n) => s + n.items.length, 0)}</div>
          <span className="note">{stores.length} {stores.length === 1 ? "mercado" : "mercados"}</span>
        </div>
      </div>

      <div className="grid two">
        <section className="card" aria-labelledby="gp">
          <h2 id="gp">Preço por compra</h2>
          {chosen ? (
            <>
              <div className="field">
                <label htmlFor="prod">Produto</label>
                <select id="prod" value={sel} onChange={(e) => setSel(Number(e.target.value))}>
                  {charts.map((c, i) => <option key={c.productKey} value={i}>{c.description} — {c.storeName}</option>)}
                </select>
              </div>
              <PriceChart points={chosen.history} label={`Preço unitário de ${chosen.description} em ${chosen.storeName}`} />
            </>
          ) : (
            <div className="empty">
              <h3>Falta uma segunda compra</h3>
              <p>Importe outra nota do mesmo mercado. Os produtos que aparecerem nas duas ganham um gráfico de preço.</p>
              <a className="btn tag" href="#importar">Importar outra nota</a>
            </div>
          )}
        </section>

        <section className="card" aria-labelledby="gm">
          <h2 id="gm">Gasto por mercado</h2>
          <p className="sub">Soma do valor pago nas notas guardadas.</p>
          <div className="list">
            {stores.map((s) => (
              <div key={s.cnpj} style={{ margin: "10px 0" }}>
                <div className="row" style={{ justifyContent: "space-between", flexWrap: "nowrap" }}>
                  <span>{s.storeName}</span><b className="num">{money(s.cents)}</b>
                </div>
                <div className="bar" role="img" aria-label={`${s.storeName}: ${money(s.cents)}`}><div className="fill" style={{ width: `${(s.cents / maxStore) * 100}%` }} /></div>
                <div className="note">{s.notes} {s.notes === 1 ? "nota" : "notas"}</div>
              </div>
            ))}
          </div>
          {stores.length < 2 && <p className="note">A comparação de preços entre mercados chega quando houver notas de mais de um mercado e os produtos forem vinculados.</p>}
        </section>
      </div>

      <section className="card" aria-labelledby="ma">
        <h2 id="ma">Maiores aumentos</h2>
        {risers.length === 0 ? (
          <p className="sub">Nenhum produto ficou mais caro entre as suas compras.</p>
        ) : (
          <div className="list">
            {risers.map((c) => (
              <div className="it" key={c.productKey}>
                <div>{c.description}<div className="note">{c.storeName} · {money(c.firstCents)} → {money(c.lastCents)}</div></div>
                <Badge p={c.pct} />
              </div>
            ))}
          </div>
        )}
      </section>

      <div className="row"><a className="btn tag" href="#importar">Importar outra nota</a><a className="btn" href="#notas">Ver notas</a></div>
    </>
  );
}
