import { useMemo, useState } from "react";
import PriceChart from "../components/PriceChart.tsx";
import { IconDoc, IconDown, IconUp } from "../components/Icons.tsx";
import { money, sentenceCase, storeLabel } from "../lib/format.ts";
import { loadNotes } from "../lib/storage.ts";
import { averageChange, priceChanges, spendByMonth, spendByStore } from "../modules/prices/analytics.ts";

const pct = (p: number) => `${p > 0 ? "+" : ""}${(p * 100).toFixed(1).replace(".", ",")}%`;
const monthName = (m: string) => new Date(`${m}-15T12:00:00`).toLocaleDateString("pt-BR", { month: "long" });

/** Variação com ícone e texto (cor nunca é o único sinal). */
function Badge({ p, suffix = "" }: { p: number; suffix?: string }) {
  const up = p > 0.0005, down = p < -0.0005;
  return (
    <span className={`delta ${up ? "bad" : down ? "good" : ""}`}>
      {up ? <IconUp /> : down ? <IconDown /> : null}
      {up || down ? `${pct(Math.abs(p)).replace("+", "")} ${up ? "mais" : "menos"}${suffix}` : "sem mudança"}
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
  const [table, setTable] = useState(false);

  if (notes.length === 0)
    return (
      <div className="card empty">
        <IconDoc size={44} />
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

  const items = notes.reduce((s, n) => s + n.items.length, 0);

  return (
    <>
      <p className="note lead">Calculado com {notes.length} {notes.length === 1 ? "nota guardada" : "notas guardadas"} neste aparelho.</p>
      <div className="grid kpis">
        <div className="card kpi">
          <p className="sub">Gasto em {monthName(last.month)}</p>
          <div className="v cond num">{money(last.cents)}</div>
          {delta !== null && before ? <Badge p={delta} suffix={` que ${monthName(before.month)}`} /> : <span className="delta">primeiro mês registrado</span>}
        </div>
        <div className="card kpi">
          <p className="sub">Variação dos seus preços</p>
          <div className="v cond num">{avg === null ? "—" : pct(avg)}</div>
          {avg === null ? <span className="delta">precisa de um produto comprado 2 vezes</span> : <span className={`delta ${avg > 0.0005 ? "bad" : avg < -0.0005 ? "good" : ""}`}>{avg > 0.0005 ? <IconUp /> : avg < -0.0005 ? <IconDown /> : null}média de {changes.length} {changes.length === 1 ? "produto repetido" : "produtos repetidos"}</span>}
        </div>
        <div className="card kpi">
          <p className="sub">Notas guardadas</p>
          <div className="v cond num">{notes.length}</div>
          <span className="delta">{items} itens de {stores.length} {stores.length === 1 ? "mercado" : "mercados"}</span>
        </div>
      </div>

      <div className="grid two">
        <section className="card" aria-labelledby="gp">
          {chosen ? (
            <>
              <div className="hdr">
                <div>
                  <h2 id="gp">{sentenceCase(chosen.description)}: preço por compra</h2>
                  <p className="sub">{storeLabel(chosen.storeName)}. Toque, passe o mouse ou use as setas.</p>
                </div>
                <button className="btn sm" aria-pressed={table} onClick={() => setTable(!table)}>{table ? "Ver gráfico" : "Ver tabela"}</button>
              </div>
              {charts.length > 1 && (
                <div className="field inline">
                  <label htmlFor="prod">Produto</label>
                  <select id="prod" value={sel} onChange={(e) => setSel(Number(e.target.value))}>
                    {charts.map((c, i) => <option key={c.productKey} value={i}>{sentenceCase(c.description)}, {storeLabel(c.storeName)}</option>)}
                  </select>
                </div>
              )}
              <PriceChart points={chosen.history} table={table} label={`Preço unitário de ${sentenceCase(chosen.description)} em ${storeLabel(chosen.storeName)}`} />
            </>
          ) : (
            <div className="empty">
              <h2 id="gp" className="sr">Preço por compra</h2>
              <IconDoc size={44} />
              <h3>Falta uma segunda compra</h3>
              <p>Importe outra nota do mesmo mercado. Os produtos que aparecerem nas duas ganham um gráfico de preço.</p>
              <a className="btn tag" href="#importar">Importar outra nota</a>
            </div>
          )}
        </section>

        <section className="card" aria-labelledby="gm">
          <h2 id="gm">Gasto por mercado</h2>
          <p className="sub">Soma do valor pago nas notas guardadas.</p>
          <div className="bars">
            {stores.map((s) => (
              <div key={s.cnpj} className="barrow">
                <div className="lab"><span>{storeLabel(s.storeName)} <span className="note">{s.notes} {s.notes === 1 ? "nota" : "notas"}</span></span><b className="num">{money(s.cents)}</b></div>
                <div className="bar" aria-hidden="true"><div className="fill" style={{ width: `${(s.cents / maxStore) * 100}%` }} /></div>
              </div>
            ))}
          </div>
          {stores.length < 2 ? (
            <p className="note">Com notas de mais de um mercado, você compara o preço de cada produto entre eles.</p>
          ) : (
            <a className="btn" href="#comparar">Comparar preços entre mercados</a>
          )}
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
                <div>{sentenceCase(c.description)}<div className="note num">{storeLabel(c.storeName)}: de {money(c.firstCents)} para {money(c.lastCents)}</div></div>
                <span className="delta bad"><IconUp />{pct(c.pct)}</span>
              </div>
            ))}
          </div>
        )}
      </section>

    </>
  );
}
