import { useState } from "react";
import { IconDoc, IconKey, IconScan } from "../components/Icons.tsx";
import { formatCnpj, formatDateTime, formatQty, money, sentenceCase, storeLabel } from "../lib/format.ts";
import { loadNotes, removeNote, type SavedNote } from "../lib/storage.ts";
import { loadPending, removePending, type PendingNote } from "../lib/pending.ts";
import { describeKey } from "../lib/accessKey.ts";

function ImportCard() {
  return (
    <section className="card" aria-labelledby="imp">
      <h2 id="imp">Importar nota fiscal (NFC-e)</h2>
      <p className="sub">Grátis. Você identifica a nota, abre a consulta oficial da Fazenda e traz o texto ou o PDF de volta.</p>
      <div className="opts">
        <a className="opt" href="#importar"><IconScan size={26} /><b>Ler QR Code do cupom</b><span className="note">Aponte a câmera para o QR da nota</span></a>
        <a className="opt" href="#importar?chave"><IconKey size={26} /><b>Digitar a chave de acesso</b><span className="note">Os 44 números impressos no cupom</span></a>
      </div>
      <p className="note" style={{ margin: "12px 0 0" }}>CPF e nome do consumidor nunca são guardados.</p>
    </section>
  );
}

function PendingCard({ toast }: { toast: (t: string) => void }) {
  const [list, setList] = useState<PendingNote[]>(loadPending);
  if (list.length === 0) return null;
  // nome do mercado, quando já existe nota dele
  const names = new Map(loadNotes().map((n) => [n.storeCnpj, storeLabel(n.storeName)]));
  const drop = (k: string) => { removePending(k); setList(loadPending()); toast("Pendente descartada"); };
  return (
    <section className="card" aria-labelledby="pend">
      <h2 id="pend">Pendentes</h2>
      <p className="sub">Chaves lidas que ainda esperam os itens da consulta da Fazenda.</p>
      <div className="list">
        {list.map((p) => {
          const d = describeKey(p.accessKey);
          return (
            <div key={p.accessKey} className="noteitem">
              <div className="it">
                <div>
                  <b>{names.get(d.cnpj) ?? `CNPJ ${formatCnpj(d.cnpj)}`}</b>
                  <div className="note">Nota {Number(d.number)}, de {d.yearMonth.slice(2)}/20{d.yearMonth.slice(0, 2)}. Lida em {formatDateTime(p.readAt)}</div>
                </div>
                <div className="right"><span className="pill warn">falta trazer os itens</span></div>
              </div>
              <div className="row">
                <a className="btn sm primary" href={`#importar?chave=${p.accessKey}`}>Continuar</a>
                <button className="btn sm" onClick={() => drop(p.accessKey)}>Descartar</button>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

export default function Notes({ toast }: { toast: (t: string) => void }) {
  const [notes, setNotes] = useState<SavedNote[]>(loadNotes);
  const [open, setOpen] = useState<string | null>(null);
  const sorted = [...notes].sort((a, b) => (b.issuedAt ?? b.savedAt).localeCompare(a.issuedAt ?? a.savedAt));

  const del = (k: string) => {
    if (!confirm("Apagar esta nota? Os preços dela saem do histórico.")) return;
    removeNote(k); setNotes(loadNotes()); setOpen(null); toast("Nota apagada");
  };

  return (
    <>
      <ImportCard />
      <PendingCard toast={toast} />
      <section className="card" aria-labelledby="suas">
        <h2 id="suas">Suas notas</h2>
        {sorted.length === 0 ? (
          <div className="empty">
            <IconDoc size={44} />
            <h3>Nenhuma nota ainda</h3>
            <p>Importe sua primeira nota para começar a comparar preços.</p>
          </div>
        ) : (
          <div className="list">
            {sorted.map((n) => (
              <div key={n.accessKey} className="noteitem">
                <div className="it">
                  <div>
                    <b>{storeLabel(n.storeName)}</b>
                    <div className="note">{formatDateTime(n.issuedAt)}, {n.items.length} {n.items.length === 1 ? "item" : "itens"}</div>
                  </div>
                  <div className="right">
                    <b className="num">{money(n.payableCents)}</b>
                    {n.validated ? <span className="pill good">✓ conferida</span> : <span className="pill warn">totais não conferidos</span>}
                  </div>
                </div>
                <button className="btn sm" aria-expanded={open === n.accessKey} onClick={() => setOpen(open === n.accessKey ? null : n.accessKey)}>
                  {open === n.accessKey ? "Fechar itens" : "Ver itens"}
                </button>
                {open === n.accessKey && (
                  <div className="noteopen">
                    <div className="note">CNPJ {formatCnpj(n.storeCnpj)}, {n.storeAddress}</div>
                    <div className="tablewrap">
                      <table>
                        <caption className="sr">Itens da nota de {storeLabel(n.storeName)}</caption>
                        <thead><tr><th>Produto</th><th className="r">Qtde</th><th className="r">Unit.</th><th className="r">Total</th></tr></thead>
                        <tbody>{n.items.map((i) => (
                          <tr key={i.line}><td>{sentenceCase(i.description)}</td><td className="r num">{formatQty(i.quantity)} {i.unit}</td><td className="r num">{money(i.unitPriceCents)}</td><td className="r num">{money(i.totalCents)}</td></tr>
                        ))}</tbody>
                      </table>
                    </div>
                    <button className="btn danger sm" onClick={() => del(n.accessKey)}>Apagar nota</button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>
    </>
  );
}
