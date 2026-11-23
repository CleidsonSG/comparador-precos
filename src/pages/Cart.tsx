import { useMemo, useState } from "react";
import { loadCart, saveCart, type CartItem } from "../lib/cart.ts";
import { money } from "../lib/format.ts";
import { findLink } from "../lib/links.ts";
import { loadNotes } from "../lib/storage.ts";
import { pricesForKeys, verdict } from "../modules/prices/analytics.ts";

export default function Cart({ toast }: { toast: (t: string) => void }) {
  const notes = useMemo(loadNotes, []);
  const [items, setItems] = useState<CartItem[]>(loadCart);

  const update = (next: CartItem[]) => {
    try { saveCart(next); setItems(next); } catch (e) { toast(e instanceof Error ? e.message : "Erro ao guardar."); }
  };

  if (items.length === 0)
    return (
      <div className="card empty">
        <h3>Seu carrinho está vazio</h3>
        <p>Escaneie um produto para comparar o preço e adicionar aqui.</p>
        <a className="btn primary" href="#escanear">Escanear produto</a>
      </div>
    );

  const units = items.reduce((s, i) => s + i.qty, 0);
  const total = items.reduce((s, i) => s + i.shelfCents * i.qty, 0);
  const rows = items.map((i) => {
    const l = findLink(i.barcode);
    const v = l ? verdict(i.shelfCents, pricesForKeys(l.keys, notes)) : null;
    return { i, v };
  });
  const saving = rows.reduce((s, r) => s + (r.v?.kind === "worse" ? r.v.extraCents * r.i.qty : 0), 0);

  return (
    <>
      <div className="grid kpis">
        <div className="card kpi"><div className="note">Total do carrinho</div><div className="v cond num">{money(total)}</div><span className="note">{units} {units === 1 ? "unidade" : "unidades"}</span></div>
        <div className="card kpi">
          <div className="note">Economia possível</div>
          <div className="v cond num">{money(saving)}</div>
          {saving > 0 ? <span className="pill bad">↑ há itens mais caros que o seu histórico</span> : <span className="pill good">↓ nenhum item acima do histórico</span>}
        </div>
      </div>
      <section className="card list" aria-label="Itens do carrinho">
        {rows.map(({ i, v }) => (
          <div className="it" key={i.id}>
            <div>
              <strong>{i.name}</strong>
              <div className="note">{i.storeName} · {money(i.shelfCents)} cada</div>
              {v?.kind === "worse" && <div className="note" style={{ color: "var(--bad)" }}>↑ {money(v.best.unitPriceCents)} em {v.best.storeName}</div>}
              {v?.kind === "best" && <div className="note" style={{ color: "var(--good)" }}>↓ melhor preço do seu histórico</div>}
            </div>
            <div className="cond num" style={{ fontSize: 22 }}>{money(i.shelfCents * i.qty)}</div>
            <div className="row">
              <button className="btn sm" aria-label={`Diminuir ${i.name}`} disabled={i.qty <= 1} onClick={() => update(items.map((x) => (x.id === i.id ? { ...x, qty: x.qty - 1 } : x)))}>−</button>
              <span className="num" aria-label={`${i.qty} unidades`}>{i.qty}</span>
              <button className="btn sm" aria-label={`Aumentar ${i.name}`} onClick={() => update(items.map((x) => (x.id === i.id ? { ...x, qty: x.qty + 1 } : x)))}>+</button>
              <button className="btn sm danger" onClick={() => update(items.filter((x) => x.id !== i.id))}>Remover</button>
            </div>
          </div>
        ))}
      </section>
      <div className="row"><a className="btn tag" href="#escanear">Escanear outro</a><button className="btn" onClick={() => { if (confirm("Esvaziar o carrinho?")) update([]); }}>Esvaziar</button></div>
    </>
  );
}
