import { useState } from "react";
import { formatCnpj, formatDateTime, formatQty, money } from "../lib/format.ts";
import { loadNotes, removeNote, type SavedNote } from "../lib/storage.ts";

export default function Notes({ toast }: { toast: (t: string) => void }) {
  const [notes, setNotes] = useState<SavedNote[]>(loadNotes);
  const [open, setOpen] = useState<string | null>(null);
  const sorted = [...notes].sort((a, b) => (b.issuedAt ?? b.savedAt).localeCompare(a.issuedAt ?? a.savedAt));

  if (sorted.length === 0)
    return (
      <div className="card empty">
        <h3>Nenhuma nota guardada</h3>
        <p>Importe sua primeira nota para começar a comparar preços.</p>
        <a className="btn primary" href="#importar">Importar nota</a>
      </div>
    );

  const del = (k: string) => {
    if (!confirm("Apagar esta nota do aparelho?")) return;
    removeNote(k); setNotes(loadNotes()); setOpen(null); toast("Nota apagada");
  };

  return (
    <div className="card list">
      {sorted.map((n) => (
        <div key={n.accessKey}>
          <div className="it">
            <div><strong>{n.storeName}</strong><div className="note">{formatDateTime(n.issuedAt)} · {n.items.length} itens</div></div>
            <div className="cond num" style={{ fontSize: 24 }}>{money(n.payableCents)}</div>
            <button className="btn sm" aria-expanded={open === n.accessKey} onClick={() => setOpen(open === n.accessKey ? null : n.accessKey)}>
              {open === n.accessKey ? "Fechar" : "Ver itens"}
            </button>
            {!n.validated && <span className="pill warn">Totais não conferidos</span>}
          </div>
          {open === n.accessKey && (
            <div>
              <div className="note">CNPJ {formatCnpj(n.storeCnpj)} · {n.storeAddress}</div>
              <div className="tablewrap">
                <table>
                  <thead><tr><th>Produto</th><th className="r">Qtde</th><th className="r">Unit.</th><th className="r">Total</th></tr></thead>
                  <tbody>{n.items.map((i) => (
                    <tr key={i.line}><td>{i.description}</td><td className="r num">{formatQty(i.quantity)} {i.unit}</td><td className="r num">{money(i.unitPriceCents)}</td><td className="r num">{money(i.totalCents)}</td></tr>
                  ))}</tbody>
                </table>
              </div>
              <button className="btn danger sm" onClick={() => del(n.accessKey)}>Apagar nota</button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
