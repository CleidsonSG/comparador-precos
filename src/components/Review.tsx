import { useState } from "react";
import type { RjParseResult } from "../modules/nfce/uf/rj/parseConsultaText.ts";
import { formatCnpj, formatDateTime, formatQty, money } from "../lib/format.ts";

interface Props {
  result: RjParseResult;
  duplicate: boolean;
  onSave: () => void;
  onCancel: () => void;
  /** Motivo que impede guardar (ex.: falta a chave de acesso). */
  blocked?: string;
}

export default function Review({ result, duplicate, onSave, onCancel, blocked }: Props) {
  const [confirmed, setConfirmed] = useState(false);
  const { store, note, items, totals } = result;
  const needsConfirm = result.ok && !result.validated;
  const canSave = result.ok && !blocked && (result.validated || confirmed);

  return (
    <section className="card" aria-labelledby="rev">
      <h2 id="rev">Confira a nota</h2>
      {result.errors.length > 0 && (
        <div className="msg bad" role="alert">
          <div>Não deu para ler esta nota:<ul>{result.errors.map((e) => <li key={e}>{e}</li>)}</ul></div>
        </div>
      )}
      {store && (
        <div className="hdr">
          <div>
            <strong>{store.name}</strong>
            <div className="note">CNPJ {formatCnpj(store.cnpj)}</div>
            <div className="note">{store.address}</div>
          </div>
          {note && <div className="note">Nota {note.number} · série {note.series}<br />{formatDateTime(note.issuedAt)}</div>}
        </div>
      )}
      {result.ok && (
        <>
          <div className="row" style={{ margin: "10px 0" }}>
            <span className={`pill ${result.validated ? "good" : "warn"}`}>
              {result.validated ? "Totais conferem com os itens" : "Totais não conferidos"}
            </span>
            <span className="pill">{totals.itemCount} itens</span>
          </div>
          <div className="grid kpis">
            <div><div className="note">Total dos itens</div><div className="cond num" style={{ fontSize: 28 }}>{money(totals.totalCents ?? 0)}</div></div>
            {(totals.discountCents ?? 0) > 0 && <div><div className="note">Desconto</div><div className="cond num" style={{ fontSize: 28 }}>{money(totals.discountCents ?? 0)}</div></div>}
            <div><div className="note">A pagar</div><div className="cond num" style={{ fontSize: 28 }}>{money(totals.payableCents ?? 0)}</div></div>
          </div>
        </>
      )}
      {result.warnings.length > 0 && (
        <div className="msg warn"><div>Atenção:<ul>{result.warnings.map((w) => <li key={w}>{w}</li>)}</ul></div></div>
      )}
      {items.length > 0 && (
        <div className="tablewrap">
          <table>
            <caption className="sr">Itens da nota</caption>
            <thead><tr><th>Produto</th><th>Código</th><th className="r">Qtde</th><th className="r">Unit.</th><th className="r">Total</th></tr></thead>
            <tbody>
              {items.map((i) => (
                <tr key={i.line}>
                  <td>{i.description}</td><td className="num">{i.storeCode}</td>
                  <td className="r num">{formatQty(i.quantity)} {i.unit}</td>
                  <td className="r num">{money(i.unitPriceCents)}</td><td className="r num">{money(i.totalCents)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {duplicate && result.ok && <div className="msg info">Esta nota já está guardada. Salvar de novo substitui a anterior.</div>}
      {needsConfirm && (
        <label className="check">
          <input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} />
          <span>Conferi os itens e valores com a nota e quero guardar mesmo assim.</span>
        </label>
      )}
      {blocked && <div className="msg bad" role="alert">{blocked}</div>}
      <div className="row">
        <button className="btn primary" disabled={!canSave} onClick={onSave}>Guardar nota</button>
        <button className="btn" onClick={onCancel}>Descartar</button>
      </div>
    </section>
  );
}
