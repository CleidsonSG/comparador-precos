import { useState } from "react";
import QrScanner from "../components/QrScanner.tsx";
import Review from "../components/Review.tsx";
import { describeKey, extractAccessKey, formatKey, isValidAccessKey, officialConsultaUrl } from "../lib/accessKey.ts";
import { hasNote, saveNote } from "../lib/storage.ts";
import { parseRjConsultaText, type RjParseResult } from "../modules/nfce/uf/rj/parseConsultaText.ts";

export default function Import({ toast }: { toast: (t: string) => void }) {
  const [typed, setTyped] = useState("");
  const [key, setKey] = useState<string | null>(null);
  const [qrText, setQrText] = useState<string | null>(null);
  const [keyMsg, setKeyMsg] = useState("");
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [result, setResult] = useState<RjParseResult | null>(null);

  const reset = () => { setResult(null); setErr(""); setText(""); };

  const acceptInput = (raw: string) => {
    setKeyMsg(""); reset();
    const k = extractAccessKey(raw);
    if (!k) { setKey(null); setKeyMsg("Não encontrei uma chave de 44 números nesse conteúdo."); return; }
    if (!isValidAccessKey(k)) { setKey(null); setKeyMsg("A chave tem 44 números, mas o dígito verificador não confere. Confira se digitou tudo certo."); return; }
    if (describeKey(k).uf !== "33") { setKey(null); setKeyMsg("Esta nota é de outro estado. Por enquanto só o Rio de Janeiro tem leitor."); return; }
    setKey(k);
    setQrText(/^https?:/i.test(raw.trim()) ? raw : null);
  };

  const copyKey = async () => {
    if (!key) return;
    try { await navigator.clipboard.writeText(key); toast("Chave copiada"); } catch { toast("Não consegui copiar. Selecione a chave e copie."); }
  };

  const parse = (t: string) => {
    setErr("");
    const r = parseRjConsultaText(t);
    if (r.note?.accessKey && key && r.note.accessKey.replace(/\D/g, "") !== key) {
      setResult(null);
      setErr("Esta nota não é a da chave informada. Confira se copiou a nota certa.");
      return;
    }
    setResult(r);
  };

  const paste = async () => {
    try {
      const t = await navigator.clipboard.readText();
      if (!t.trim()) { toast("A área de transferência está vazia"); return; }
      setText(t); parse(t);
    } catch {
      toast("O navegador bloqueou a leitura. Cole no campo abaixo.");
    }
  };

  const onPdf = async (f: File | undefined) => {
    if (!f) return;
    setBusy(true); setErr("");
    try {
      const { pdfToText } = await import("../lib/pdfText.ts");
      const t = await pdfToText(f);
      setText(t); parse(t);
    } catch {
      setErr("Não consegui ler este PDF. Use o PDF salvo da consulta oficial ou cole o texto da página.");
    } finally { setBusy(false); }
  };

  const save = () => {
    if (!result?.ok || !result.store || !result.note?.accessKey) return;
    try {
      saveNote({
        accessKey: result.note.accessKey.replace(/\D/g, ""), savedAt: new Date().toISOString(),
        storeName: result.store.name, storeCnpj: result.store.cnpj, storeAddress: result.store.address,
        issuedAt: result.note.issuedAt, number: result.note.number, series: result.note.series,
        totalCents: result.totals.totalCents ?? 0, discountCents: result.totals.discountCents ?? 0, payableCents: result.totals.payableCents ?? 0,
        validated: result.validated, parserVersion: result.parserVersion, items: result.items,
      });
      toast("Nota guardada");
      location.hash = "#notas";
    } catch (e) { setErr(e instanceof Error ? e.message : "Erro ao guardar."); }
  };

  const noteKey = (result?.note?.accessKey ?? "").replace(/\D/g, "") ?? "";

  return (
    <>
      <p className="sub">Três passos: identifique a nota, abra a consulta oficial e traga o resultado de volta.</p>
      <section className="card">
        <div className={`step${key ? " done" : ""}`}>
          <div className="n" aria-hidden="true">{key ? "✓" : "1"}</div>
          <div>
            <h2>Identifique a nota</h2>
            <p className="sub">Leia o QR do cupom ou digite a chave de 44 números.</p>
            <QrScanner onText={acceptInput} />
            <div className="field">
              <label htmlFor="chave">Chave de acesso</label>
              <input id="chave" inputMode="numeric" autoComplete="off" placeholder="0000 0000 0000 …" value={typed} onChange={(e) => setTyped(e.target.value)} />
            </div>
            <button className="btn" onClick={() => acceptInput(typed)} disabled={!typed.trim()}>Usar esta chave</button>
            {keyMsg && <div className="msg bad" role="alert">{keyMsg}</div>}
            {key && <div className="msg good" role="status">Chave válida do RJ: <span className="num">{formatKey(key)}</span></div>}
          </div>
        </div>
      </section>

      <section className="card" aria-disabled={!key}>
        <div className="step">
          <div className="n" aria-hidden="true">2</div>
          <div>
            <h2>Abra a consulta oficial</h2>
            <p className="sub">A Fazenda do RJ mostra a nota no seu navegador. Copie a chave e cole lá.</p>
            <div className="row">
              <button className="btn" disabled={!key} onClick={copyKey}>Copiar chave</button>
              <a className={`btn primary${key ? "" : " off"}`} href={key ? officialConsultaUrl(qrText) : undefined} target="_blank" rel="noopener noreferrer" aria-disabled={!key} onClick={(e) => { if (!key) e.preventDefault(); }}>Abrir consulta da Fazenda</a>
            </div>
          </div>
        </div>
      </section>

      <section className="card">
        <div className="step">
          <div className="n" aria-hidden="true">3</div>
          <div>
            <h2>Traga a nota de volta</h2>
            <p className="sub">Selecione todo o texto da página e cole aqui, ou envie o PDF salvo da página. O CPF e o nome do consumidor são ignorados e não ficam guardados.</p>
            <div className="row">
              <button className="btn tag" onClick={paste} disabled={!key}>Colar da área de transferência</button>
              <label className={`btn`} aria-disabled={!key}>
                Enviar PDF
                <input type="file" accept="application/pdf" className="sr" disabled={!key} onChange={(e) => { void onPdf(e.target.files?.[0]); e.target.value = ""; }} />
              </label>
            </div>
            <div className="field">
              <label htmlFor="texto">Ou cole o texto aqui</label>
              <textarea id="texto" value={text} onChange={(e) => setText(e.target.value)} placeholder="Texto da consulta…" />
            </div>
            <button className="btn" disabled={!key || !text.trim()} onClick={() => parse(text)}>Ler texto</button>
            {busy && <div className="msg info" role="status">Lendo o PDF…</div>}
            {err && <div className="msg bad" role="alert">{err}</div>}
          </div>
        </div>
      </section>

      {result && <Review result={result} duplicate={hasNote(noteKey)} onSave={save} onCancel={reset} />}
    </>
  );
}
