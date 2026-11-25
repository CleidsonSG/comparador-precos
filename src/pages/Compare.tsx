import { useMemo, useState } from "react";
import MonthChart, { seriesColor } from "../components/MonthChart.tsx";
import Modal from "../components/Modal.tsx";
import { IconDoc, IconDown } from "../components/Icons.tsx";
import { money, sentenceCase, storeLabel } from "../lib/format.ts";
import { isBarcode, isManualId, loadLinks, manualId, removeLink, saveLink, type ProductLink } from "../lib/links.ts";
import { loadNotes } from "../lib/storage.ts";
import { latestPrices, type Observation } from "../modules/prices/analytics.ts";
import { compareMarkets, marketsOf, monthlyByMarket, suggestLinks, type Suggestion } from "../modules/prices/compare.ts";

type Tab = "comparar" | "vinculos";
const DISMISS = "gondola.dismissed.v1"; // "não é o mesmo produto": só neste aparelho

function loadDismissed(): string[] {
  try { return JSON.parse(localStorage.getItem(DISMISS) ?? "[]") as string[]; } catch { return []; }
}
function saveDismissed(ids: string[]) {
  try { localStorage.setItem(DISMISS, JSON.stringify(ids.slice(-500))); } catch { /* só conveniência */ }
}

const unitOf = (o: Observation) => (o.unit === "KG" ? "/kg" : ""); // preço por quilo; o resto é por unidade da nota
const pctTxt = (p: number) => `${(p * 100).toFixed(1).replace(".", ",")}%`;

export default function Compare({ tab, toast }: { tab: Tab; toast: (t: string) => void }) {
  const notes = useMemo(loadNotes, []);
  const [links, setLinks] = useState<ProductLink[]>(loadLinks);
  const refresh = () => { setLinks(loadLinks()); window.dispatchEvent(new Event("gondola:changed")); };
  const allMarkets = useMemo(() => marketsOf(notes), [notes]);
  const colorOf = (cnpj: string) => seriesColor(Math.max(0, allMarkets.findIndex((m) => m.cnpj === cnpj)));

  return (
    <>
      <nav className="seg" aria-label="Comparar mercados">
        <a href="#comparar" aria-current={tab === "comparar" ? "page" : undefined}>Comparação</a>
        <a href="#vinculos" aria-current={tab === "vinculos" ? "page" : undefined}>Vínculos{links.length > 0 && <span className="num">{` (${links.length})`}</span>}</a>
      </nav>
      {notes.length === 0 ? (
        <div className="card empty">
          <IconDoc size={44} />
          <h3>Importe suas notas primeiro</h3>
          <p>A comparação usa os preços das notas de dois ou mais mercados.</p>
          <a className="btn tag" href="#importar">Importar nota</a>
        </div>
      ) : tab === "comparar" ? (
        <Comparison notes={notes} links={links} colorOf={colorOf} marketCount={allMarkets.length} />
      ) : (
        <Links notes={notes} links={links} refresh={refresh} toast={toast} />
      )}
    </>
  );
}

function Comparison({ notes, links, colorOf, marketCount }: {
  notes: ReturnType<typeof loadNotes>; links: ProductLink[]; colorOf: (c: string) => string; marketCount: number;
}) {
  const base = useMemo(() => compareMarkets(links, notes), [links, notes]);
  const [off, setOff] = useState<string[]>([]); // mercados desmarcados
  const only = base.markets.map((m) => m.cnpj).filter((c) => !off.includes(c));
  const c = off.length ? compareMarkets(links, notes, only) : base;
  const multi = c.rows.filter((r) => Object.keys(r.byMarket).length > 1);
  const [sel, setSel] = useState(0);
  const [table, setTable] = useState(false);
  const chosen = multi[Math.min(sel, multi.length - 1)];
  const monthly = useMemo(() => (chosen ? monthlyByMarket(chosen.link, notes, c.markets) : null), [chosen, notes, c.markets]);

  if (marketCount < 2)
    return (
      <div className="card empty">
        <IconDoc size={44} />
        <h3>Falta a nota de outro mercado</h3>
        <p>Importe uma nota de um segundo mercado. Depois vincule os produtos iguais para comparar.</p>
        <a className="btn tag" href="#importar">Importar nota</a>
      </div>
    );
  if (base.markets.length < 2 || base.rows.every((r) => Object.keys(r.byMarket).length < 2))
    return (
      <div className="card empty">
        <IconDoc size={44} />
        <h3>Vincule os produtos iguais</h3>
        <p>Cada mercado usa um código próprio na nota. Confirme quais itens são o mesmo produto e a comparação aparece aqui.</p>
        <a className="btn tag" href="#vinculos">Ver sugestões de vínculo</a>
      </div>
    );

  const totals = [...c.common.totals].sort((a, b) => a.cents - b.cents);
  const cheapest = totals[0], dearest = totals[totals.length - 1];
  const max = dearest?.cents || 1;
  const name = (cnpj: string) => storeLabel(c.markets.find((m) => m.cnpj === cnpj)?.name ?? "");

  return (
    <>
      {base.markets.length > 2 && (
        <fieldset className="chips">
          <legend className="sub">Mercados na comparação</legend>
          {base.markets.map((m) => (
            <label key={m.cnpj} className="chip">
              <input type="checkbox" checked={!off.includes(m.cnpj)} disabled={!off.includes(m.cnpj) && only.length <= 2}
                onChange={(e) => setOff(e.target.checked ? off.filter((x) => x !== m.cnpj) : [...off, m.cnpj])} />
              <i style={{ background: colorOf(m.cnpj) }} aria-hidden="true" />{storeLabel(m.name)}
            </label>
          ))}
        </fieldset>
      )}

      <div className="grid two">
        <section className="card" aria-labelledby="cesta">
          <h2 id="cesta">Cesta comum</h2>
          {c.common.count === 0 ? (
            <p className="sub">Nenhum produto vinculado tem preço em todos estes mercados ainda.</p>
          ) : (
            <>
              <p className="sub">Soma do último preço de {c.common.count} {c.common.count === 1 ? "produto vinculado que existe" : "produtos vinculados que existem"} em todos os mercados.</p>
              <div className="bars">
                {totals.map((t, i) => (
                  <div key={t.cnpj} className="barrow">
                    <div className="lab">
                      <span>{name(t.cnpj)} {i === 0 && totals.length > 1 && t.cents < totals[1]!.cents && <span className="pill good"><IconDown size={12} /> mais barato</span>}</span>
                      <b className="num">{money(t.cents)}</b>
                    </div>
                    <div className="bar" aria-hidden="true"><div className="fill" style={{ width: `${(t.cents / max) * 100}%`, background: colorOf(t.cnpj) }} /></div>
                  </div>
                ))}
              </div>
              {cheapest && dearest && dearest.cents > cheapest.cents && (
                <p className="note">{name(cheapest.cnpj)} sai {money(dearest.cents - cheapest.cents)} mais barato ({pctTxt((dearest.cents - cheapest.cents) / dearest.cents)} a menos) que {name(dearest.cnpj)}.</p>
              )}
              {cheapest && c.common.bestMixCents < cheapest.cents && (
                <p className="note">Comprando cada produto onde é mais barato: <b className="num">{money(c.common.bestMixCents)}</b>, {money(cheapest.cents - c.common.bestMixCents)} a menos.</p>
              )}
            </>
          )}
        </section>

        <section className="card" aria-labelledby="mes">
          {chosen && monthly ? (
            <>
              <div className="hdr">
                <div>
                  <h2 id="mes">Preço por mês</h2>
                  <p className="sub">Média do preço unitário no mês, por mercado.</p>
                </div>
                <button className="btn sm" aria-pressed={table} onClick={() => setTable(!table)}>{table ? "Ver gráfico" : "Ver tabela"}</button>
              </div>
              <div className="field inline">
                <label htmlFor="cprod">Produto</label>
                <select id="cprod" value={Math.min(sel, multi.length - 1)} onChange={(e) => setSel(Number(e.target.value))}>
                  {multi.map((r, i) => <option key={r.link.barcode} value={i}>{r.link.name}</option>)}
                </select>
              </div>
              <MonthChart months={monthly.months} series={monthly.series} colorOf={colorOf} table={table} label={`Preço por mês de ${chosen.link.name}`} />
              {monthly.months.length === 1 && <p className="note">Com compras em outros meses, aparece a linha de cada mercado.</p>}
            </>
          ) : (
            <p className="sub" id="mes">Escolha mercados com produtos vinculados em comum.</p>
          )}
        </section>
      </div>

      <section className="card" aria-labelledby="prod">
        <h2 id="prod">Produto a produto</h2>
        <p className="sub">Último preço pago em cada mercado. Compare embalagens iguais: o preço é por unidade da nota (un. ou kg).</p>
        <div className="tablewrap">
          <table className="cmp">
            <caption className="sr">Último preço de cada produto vinculado, por mercado</caption>
            <thead><tr><th>Produto</th>{c.markets.map((m) => <th key={m.cnpj} className="r"><i className="sw" style={{ background: colorOf(m.cnpj) }} aria-hidden="true" />{storeLabel(m.name)}</th>)}</tr></thead>
            <tbody>
              {c.rows.map((r) => (
                <tr key={r.link.barcode}>
                  <td>{r.link.name}</td>
                  {c.markets.map((m) => {
                    const o = r.byMarket[m.cnpj];
                    const best = r.cheapest === m.cnpj;
                    return <td key={m.cnpj} className={`r num${best ? " best" : ""}`}>{o ? <>{money(o.unitPriceCents)}<span className="note">{unitOf(o)}</span>{best && <span className="sr"> (mais barato)</span>}{best && <IconDown size={14} />}</> : <span className="note">—</span>}</td>;
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="note"><IconDown size={14} /> = mais barato. Usa só produtos que você vinculou. <a href="#vinculos">Revisar vínculos</a></p>
      </section>
    </>
  );
}

function Links({ notes, links, refresh, toast }: {
  notes: ReturnType<typeof loadNotes>; links: ProductLink[]; refresh: () => void; toast: (t: string) => void;
}) {
  const latest = useMemo(() => latestPrices(notes), [notes]);
  const [dismissed, setDismissed] = useState<string[]>(loadDismissed);
  const sugg = useMemo(() => suggestLinks(notes, links, dismissed), [notes, links, dismissed]);
  const [msg, setMsg] = useState("");
  const [undo, setUndo] = useState<ProductLink | null>(null);
  const [manual, setManual] = useState(false);

  const guard = (f: () => void) => { setMsg(""); try { f(); refresh(); } catch (e) { setMsg(e instanceof Error ? e.message : "Erro ao guardar."); } };

  const accept = (s: Suggestion) => guard(() => {
    if (s.to.kind === "link") {
      saveLink({ ...s.to.link, keys: [...s.to.link.keys, s.from.productKey], confirmedAt: new Date().toISOString() });
      toast(`Acrescentado a ${s.to.link.name}`);
    } else {
      const shorter = [s.from, s.to.obs].sort((a, b) => a.description.length - b.description.length)[0]!;
      saveLink({ barcode: manualId(links.map((l) => l.barcode)), name: sentenceCase(shorter.description), keys: [s.from.productKey, s.to.obs.productKey], confirmedAt: new Date().toISOString() });
      toast("Vínculo confirmado");
    }
  });
  const reject = (s: Suggestion) => { const d = [...dismissed, s.id]; setDismissed(d); saveDismissed(d); };

  const sorted = [...links].sort((a, b) => a.name.localeCompare(b.name));

  return (
    <>
      {msg && <div className="msg bad" role="alert">{msg}</div>}

      <section className="card" aria-labelledby="sug">
        <h2 id="sug">Parece o mesmo produto?</h2>
        {sugg.length === 0 ? (
          <p className="sub">Nenhuma sugestão agora. Quando você importar notas de outros mercados, os produtos com nome parecido aparecem aqui.</p>
        ) : (
          <>
            <p className="sub">Nomes parecidos em mercados diferentes. Nada é vinculado sem a sua confirmação.</p>
            <div className="list">
              {sugg.map((s) => (
                <div key={s.id} className="sugg">
                  <div className="pair">
                    <Prod o={s.from} />
                    {s.to.kind === "product" ? <Prod o={s.to.obs} /> : (
                      <div><b>{s.to.link.name}</b><div className="note">vínculo com {s.to.link.keys.length} {s.to.link.keys.length === 1 ? "item" : "itens"}</div></div>
                    )}
                  </div>
                  <div className="row">
                    <button className="btn sm primary" onClick={() => accept(s)}>{s.to.kind === "link" ? "Acrescentar ao vínculo" : "É o mesmo, vincular"}</button>
                    <button className="btn sm" onClick={() => reject(s)}>Não é</button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
        {dismissed.length > 0 && (
          <button className="btn sm" onClick={() => { setDismissed([]); saveDismissed([]); }}>Mostrar de novo as {dismissed.length} recusadas</button>
        )}
      </section>

      <section className="card" aria-labelledby="man">
        <div className="hdr">
          <div>
            <h2 id="man">Vincular à mão</h2>
            <p className="sub">Escolha itens das suas notas que são o mesmo produto.</p>
          </div>
          <button className="btn sm" aria-expanded={manual} onClick={() => setManual(!manual)}>{manual ? "Fechar" : "Abrir"}</button>
        </div>
        {manual && <ManualLink latest={latest} links={links} done={() => { setManual(false); refresh(); toast("Vínculo confirmado"); }} onError={setMsg} />}
      </section>

      <section className="card" aria-labelledby="vin">
        <h2 id="vin">Seus vínculos</h2>
        {sorted.length === 0 ? (
          <p className="sub">Nenhum vínculo ainda. Confirme uma sugestão acima ou escaneie um produto em Escanear.</p>
        ) : (
          <div className="list">
            {sorted.map((l) => <LinkItem key={l.barcode} link={l} latest={latest} links={links} onUndo={() => setUndo(l)} guard={guard} toast={toast} />)}
          </div>
        )}
      </section>

      <Modal
        open={!!undo} badge="!" tone="bad" title="Desfazer este vínculo?" onClose={() => setUndo(null)}
        actions={<>
          <button className="btn danger" onClick={() => { const l = undo!; setUndo(null); guard(() => { removeLink(l.barcode); toast("Vínculo desfeito"); }); }}>Desfazer vínculo</button>
          <button className="btn" autoFocus onClick={() => setUndo(null)}>Cancelar</button>
        </>}
      >
        {undo && <p className="sub"><b>{undo.name}</b> deixa de ser comparado entre mercados. As notas e os preços continuam guardados.</p>}
      </Modal>
    </>
  );
}

function Prod({ o }: { o: Observation }) {
  return <div><b>{sentenceCase(o.description)}</b><div className="note">{storeLabel(o.storeName)}, <span className="num">{money(o.unitPriceCents)}{unitOf(o)}</span></div></div>;
}

function LinkItem({ link, latest, links, onUndo, guard, toast }: {
  link: ProductLink; latest: Map<string, Observation>; links: ProductLink[]; onUndo: () => void; guard: (f: () => void) => void; toast: (t: string) => void;
}) {
  const [code, setCode] = useState("");
  const [open, setOpen] = useState(false);
  const manual = isManualId(link.barcode);
  const removeKey = (k: string) => guard(() => {
    const keys = link.keys.filter((x) => x !== k);
    if (keys.length === 0) removeLink(link.barcode); else saveLink({ ...link, keys });
    toast("Item tirado do vínculo");
  });
  const addCode = () => guard(() => {
    const c = code.replace(/\D/g, "");
    if (!isBarcode(c) || isManualId(c)) throw new Error("Código de barras inválido. Ele tem de 8 a 14 números.");
    const other = links.find((l) => l.barcode === c);
    if (other) throw new Error(`Este código já está vinculado a ${other.name}.`);
    removeLink(link.barcode);
    saveLink({ ...link, barcode: c });
    toast("Código de barras guardado");
  });

  return (
    <div className="noteitem">
      <div className="it">
        <div>
          <b>{link.name}</b>
          <div className="note">{manual ? "sem código de barras" : <>código <span className="num">{link.barcode}</span></>}, {link.keys.length} {link.keys.length === 1 ? "item" : "itens"}</div>
        </div>
        <button className="btn sm" aria-expanded={open} onClick={() => setOpen(!open)}>{open ? "Fechar" : "Revisar"}</button>
      </div>
      {open && (
        <div className="noteopen">
          <ul className="keys">
            {link.keys.map((k) => {
              const o = latest.get(k);
              return (
                <li key={k}>
                  {o ? <Prod o={o} /> : <div><b>Item sem nota guardada</b><div className="note">código {k.split(":")[1]}</div></div>}
                  <button className="btn sm" onClick={() => removeKey(k)} aria-label={`Tirar ${o ? sentenceCase(o.description) : "item"} do vínculo`}>Tirar</button>
                </li>
              );
            })}
          </ul>
          {manual && (
            <div className="field">
              <label htmlFor={`cb-${link.barcode}`}>Código de barras (opcional, para usar em Escanear)</label>
              <div className="row">
                <input id={`cb-${link.barcode}`} inputMode="numeric" autoComplete="off" placeholder="7891000100103" value={code} onChange={(e) => setCode(e.target.value)} />
                <button className="btn sm" disabled={!code.trim()} onClick={addCode}>Guardar código</button>
              </div>
            </div>
          )}
          <button className="btn sm danger" onClick={onUndo}>Desfazer vínculo</button>
        </div>
      )}
    </div>
  );
}

function ManualLink({ latest, links, done, onError }: {
  latest: Map<string, Observation>; links: ProductLink[]; done: () => void; onError: (m: string) => void;
}) {
  const [q, setQ] = useState("");
  const [picked, setPicked] = useState<string[]>([]);
  const [name, setName] = useState("");
  const linked = new Set(links.flatMap((l) => l.keys));
  const products = [...latest.values()].filter((o) => !linked.has(o.productKey)).sort((a, b) => a.description.localeCompare(b.description));
  const filtered = products.filter((p) => !q.trim() || p.description.toLowerCase().includes(q.trim().toLowerCase())).slice(0, 30);
  const confirm = () => {
    try {
      const first = latest.get(picked[0]!)!;
      saveLink({ barcode: manualId(links.map((l) => l.barcode)), name: name.trim() || sentenceCase(first.description), keys: picked, confirmedAt: new Date().toISOString() });
      setPicked([]); setName(""); setQ(""); done();
    } catch (e) { onError(e instanceof Error ? e.message : "Erro ao guardar."); }
  };
  return (
    <>
      <div className="field">
        <label htmlFor="mbusca">Buscar nas suas notas</label>
        <input id="mbusca" value={q} onChange={(e) => setQ(e.target.value)} placeholder="ex.: arroz" />
      </div>
      <div className="pick" role="group" aria-label="Itens ainda sem vínculo">
        {filtered.length === 0 && <p className="note">Nenhum item sem vínculo com esse nome.</p>}
        {filtered.map((p) => (
          <label className="check" key={p.productKey}>
            <input type="checkbox" checked={picked.includes(p.productKey)} onChange={(e) => setPicked(e.target.checked ? [...picked, p.productKey] : picked.filter((k) => k !== p.productKey))} />
            <span>{sentenceCase(p.description)}<span className="note">, {storeLabel(p.storeName)}, {money(p.unitPriceCents)}{unitOf(p)}</span></span>
          </label>
        ))}
      </div>
      <div className="field">
        <label htmlFor="mnome">Nome do produto</label>
        <input id="mnome" value={name} onChange={(e) => setName(e.target.value)} placeholder="opcional" />
      </div>
      <button className="btn primary" disabled={picked.length < 2} onClick={confirm}>Confirmar que é o mesmo produto</button>
      {picked.length === 1 && <p className="note">Escolha pelo menos dois itens.</p>}
    </>
  );
}
