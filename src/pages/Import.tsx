import { useCallback, useEffect, useRef, useState, type MouseEvent } from "react";
import QrScanner from "../components/QrScanner.tsx";
import Review from "../components/Review.tsx";
import { countDigits, describeKey, extractAccessKey, formatKey, isValidAccessKey, officialConsultaUrl } from "../lib/accessKey.ts";
import { hasNote, loadNotes, removeNote, saveNote } from "../lib/storage.ts";
import Modal from "../components/Modal.tsx";
import { addPending, getPending, removePending } from "../lib/pending.ts";
import { takeShared } from "../lib/shared.ts";
import { useOnline } from "../lib/online.ts";
import { formatDateTime, money, storeLabel } from "../lib/format.ts";
import { parseRjConsultaText, type RjParseResult } from "../modules/nfce/uf/rj/parseConsultaText.ts";
import { looksLikeNfceXml, parseNfceXml } from "../modules/nfce/xml/parseNfceXml.ts";

/** Texto da consulta (colado ou do PDF) ou XML da nota. */
const readNote = (t: string): RjParseResult => (looksLikeNfceXml(t) ? parseNfceXml(t) : parseRjConsultaText(t));
const isXmlFile = (f: File) => /.xml$/i.test(f.name) || /xml/.test(f.type);
const FILE_ACCEPT = "application/pdf,.pdf,.xml,text/xml,application/xml";

const AWAIT_KEY = "gondola.awaiting"; // a pessoa foi à consulta da Fazenda e deve voltar com a nota

interface Saved { accessKey: string; store: string; items: number; payableCents: number; issuedAt: string | null; validated: boolean }
/** nota lida que já estava guardada */
interface Dup extends Saved { savedAt: string; result: RjParseResult }

const scrollTo = (id: string) => window.setTimeout(() => document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" }), 60);

export default function Import({ toast }: { toast: (t: string) => void }) {
  const online = useOnline();
  const [typed, setTyped] = useState("");
  const [key, setKey] = useState<string | null>(null);
  const [qrText, setQrText] = useState<string | null>(null);
  const [keyMsg, setKeyMsg] = useState("");
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [result, setResult] = useState<RjParseResult | null>(null);
  const [saved, setSaved] = useState<Saved | null>(null);
  const [dup, setDup] = useState<Dup | null>(null);
  const [back, setBack] = useState(false); // voltou da Fazenda: oferece colar
  const keyRef = useRef<string | null>(null);
  keyRef.current = key;

  const reset = () => { setResult(null); setErr(""); setText(""); setSaved(null); setDup(null); };

  const acceptInput = useCallback((raw: string, opts: { scroll?: boolean } = {}) => {
    setKeyMsg(""); setResult(null); setErr(""); setText(""); setSaved(null); setDup(null);
    const k = extractAccessKey(raw);
    if (!k) {
      const n = countDigits(raw);
      setKey(null);
      setKeyMsg(n > 0 && n !== 44
        ? `Encontrei ${n} ${n === 1 ? "número" : "números"}, mas a chave tem 44 (11 grupos de 4). Confira se copiou a chave inteira: no WhatsApp ela pode ter sido cortada.`
        : "Não encontrei uma chave de 44 números nesse conteúdo.");
      return;
    }
    if (!isValidAccessKey(k)) { setKey(null); setKeyMsg("A chave tem 44 números, mas o dígito verificador não confere. Confira se digitou tudo certo."); return; }
    if (describeKey(k).uf !== "33") { setKey(null); setKeyMsg("Esta nota é de outro estado. Por enquanto só o Rio de Janeiro tem leitor."); return; }
    const qr = /^https?:/i.test(raw.trim()) ? raw.trim() : (getPending(k)?.qrText ?? null);
    setKey(k);
    setQrText(qr);
    if (hasNote(k)) { setKeyMsg(""); return; }
    addPending(k, qr);
    if (opts.scroll !== false) scrollTo("passo2");
  }, []);

  const save = useCallback((r: RjParseResult, k: string) => {
    if (!r.ok || !r.store || !r.note || !k) return;
    try {
      saveNote({
        accessKey: k, savedAt: new Date().toISOString(),
        storeName: r.store.name, storeCnpj: r.store.cnpj, storeAddress: r.store.address,
        issuedAt: r.note.issuedAt, number: r.note.number, series: r.note.series,
        totalCents: r.totals.totalCents ?? 0, discountCents: r.totals.discountCents ?? 0, payableCents: r.totals.payableCents ?? 0,
        validated: r.validated, parserVersion: r.parserVersion, items: r.items,
      });
      removePending(k);
      try { sessionStorage.removeItem(AWAIT_KEY); } catch { /* ignora */ }
      setBack(false);
      setDup(null);
      setSaved({ accessKey: k, store: storeLabel(r.store.name), items: r.items.length, payableCents: r.totals.payableCents ?? 0, issuedAt: r.note.issuedAt, validated: r.validated });
    } catch (e) { setErr(e instanceof Error ? e.message : "Erro ao guardar."); }
  }, []);

  /** Lê o texto da consulta. Se a soma confere e a nota é nova, guarda sozinho (com "Desfazer"). */
  const parse = useCallback((t: string) => {
    setErr(""); setSaved(null); setDup(null);
    const r = readNote(t);
    const cur = keyRef.current;
    const fromText = r.note?.accessKey?.replace(/\D/g, "") || "";
    if (fromText && cur && fromText !== cur) {
      setResult(null);
      setErr("Esta nota não é a da chave informada. Confira se copiou a nota certa.");
      return;
    }
    const k = fromText || cur || "";
    if (fromText && !cur) { setKey(fromText); setQrText(getPending(fromText)?.qrText ?? null); }
    setResult(r);
    setBack(false);
    const old = r.ok && k ? loadNotes().find((n) => n.accessKey === k) : undefined;
    if (old && r.store && r.note) {
      // já importada: avisa numa caixa e não substitui sem pedir
      setDup({ accessKey: k, store: storeLabel(r.store.name), items: r.items.length, payableCents: r.totals.payableCents ?? 0, issuedAt: r.note.issuedAt, validated: r.validated, savedAt: old.savedAt, result: r });
    } else if (r.ok && r.validated && k) save(r, k);
    else scrollTo("revisao");
  }, [save]);

  const paste = async () => {
    try {
      const t = await navigator.clipboard.readText();
      if (!t.trim()) { toast("A área de transferência está vazia. Copie o texto da página da Fazenda."); return; }
      setText(t); parse(t);
    } catch {
      toast("O navegador bloqueou a leitura. Cole no campo do passo 3.");
      setBack(false);
      scrollTo("passo3");
    }
  };

  /** PDF da consulta ou XML da nota (o XML não vai para o campo de texto: é grande e traz o bloco do consumidor). */
  const onFile = async (f: File | undefined) => {
    if (!f) return;
    setBusy(true); setErr(""); setBack(false);
    const xml = isXmlFile(f);
    try {
      if (xml) {
        if (f.size > 5_000_000) throw new Error("grande");
        const t = await f.text();
        setText("");
        if (!looksLikeNfceXml(t)) { setResult(null); setErr("Este arquivo não é o XML de uma nota fiscal (NFC-e)."); return; }
        parse(t);
      } else {
        const { pdfToText } = await import("../lib/pdfText.ts");
        const t = await pdfToText(f);
        setText(t); parse(t);
      }
    } catch {
      setErr(xml ? "Não consegui ler este XML. Use o arquivo XML da nota, sem compactar." : "Não consegui ler este PDF. Use o PDF salvo da consulta oficial ou cole o texto da página.");
    } finally { setBusy(false); }
  };

  // Entrada: chave vinda de Notas (pendente), foco no campo, ou conteúdo compartilhado com o app (Android).
  useEffect(() => {
    const q = location.hash.split("?")[1] ?? "";
    const params = new URLSearchParams(q);
    const k = params.get("chave");
    if (k && /^\d{44}$/.test(k)) acceptInput(k);
    else if (q === "chave") document.getElementById("chave")?.focus();
    if (params.has("compartilhado")) {
      void takeShared().then(async (s) => {
        if (!s) return;
        if (s.file) await onFile(s.file);
        else if (s.text) {
          // texto da página (selecionar tudo > Compartilhar) ou só o link da nota (Compartilhar a página)
          if (readNote(s.text).ok) { setText(s.text); parse(s.text); }
          else acceptInput(s.text);
        }
      });
    }
    if (q) history.replaceState(null, "", `${location.pathname}#importar`);
  }, []);

  // Voltou ao app depois de abrir a consulta: oferece colar a nota.
  useEffect(() => {
    const check = () => {
      if (document.visibilityState !== "visible") return;
      let k: string | null = null;
      try { k = sessionStorage.getItem(AWAIT_KEY); } catch { /* ignora */ }
      if (k && k === keyRef.current) { setBack(true); window.scrollTo({ top: 0, behavior: "smooth" }); }
    };
    document.addEventListener("visibilitychange", check);
    window.addEventListener("focus", check);
    return () => { document.removeEventListener("visibilitychange", check); window.removeEventListener("focus", check); };
  }, []);

  const openConsulta = (e: MouseEvent) => {
    if (!key || !online) { e.preventDefault(); return; }
    try { sessionStorage.setItem(AWAIT_KEY, key); } catch { /* ignora */ }
  };

  const copyKey = async () => {
    if (!key) return;
    try { await navigator.clipboard.writeText(key); toast("Chave copiada"); } catch { toast("Não consegui copiar. Selecione a chave e copie."); }
  };

  const finish = () => {
    setSaved(null); setDup(null); setKey(null); setQrText(null); setTyped(""); setResult(null); setErr(""); setText(""); setBack(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const undo = () => {
    if (!saved) return;
    removeNote(saved.accessKey);
    addPending(saved.accessKey, qrText);
    setSaved(null);
    toast("Nota desfeita. Confira e guarde quando quiser.");
    scrollTo("revisao");
  };

  const noteKey = (result?.note?.accessKey ?? key ?? "").replace(/\D/g, "");
  const alreadySaved = !!key && hasNote(key) && !saved;
  const nextStep = !!key && !result && !saved && !alreadySaved;

  return (
    <>
      <p className="sub">Três passos: identifique a nota, abra a consulta oficial e traga o resultado de volta.</p>

      {back && !saved && !dup && (
        <section className="card back" aria-labelledby="voltou">
          <h2 id="voltou">Trouxe a nota da Fazenda?</h2>
          <p className="sub">Na página da nota, selecione todo o texto e copie. Depois toque em <b>Colar agora</b>. A nota é conferida e guardada sozinha.</p>
          <div className="row">
            <button className="btn tag" onClick={() => void paste()}>Colar agora</button>
            <label className="btn">
              Enviar PDF ou XML
              <input type="file" accept={FILE_ACCEPT} className="sr" onChange={(e) => { void onFile(e.target.files?.[0]); e.target.value = ""; }} />
            </label>
            <button className="btn" onClick={() => setBack(false)}>Agora não</button>
          </div>
        </section>
      )}

      <Modal
        open={!!saved}
        badge="✓"
        title="Nota importada"
        onClose={finish}
        actions={<>
          <button className="btn primary" autoFocus onClick={finish}>OK</button>
          <a className="btn" href="#notas">Ver notas</a>
          <button className="btn" onClick={undo}>Desfazer</button>
        </>}
      >
        {saved && (
          <p className="sub" role="status">
            <b>{saved.store}</b>, {formatDateTime(saved.issuedAt)}.<br />
            {saved.items} {saved.items === 1 ? "item" : "itens"}, {money(saved.payableCents)} pagos.
            {saved.validated ? " A soma dos itens conferiu com o total." : ""}
          </p>
        )}
      </Modal>

      <Modal
        open={!!dup}
        badge="i"
        tone="info"
        title="Esta nota já estava importada"
        onClose={finish}
        actions={<>
          <button className="btn primary" autoFocus onClick={finish}>OK</button>
          <a className="btn" href="#notas">Ver notas</a>
          <button className="btn" onClick={() => { if (dup) save(dup.result, dup.accessKey); }}>Substituir pela nova leitura</button>
        </>}
      >
        {dup && (
          <p className="sub" role="status">
            <b>{dup.store}</b>, {formatDateTime(dup.issuedAt)}, {dup.items} {dup.items === 1 ? "item" : "itens"}, {money(dup.payableCents)}.<br />
            Guardada em {formatDateTime(dup.savedAt)}. Nada foi alterado.
          </p>
        )}
      </Modal>

      <section className="card">
        <div className={`step${key ? " done" : ""}`}>
          <div className="n" aria-hidden="true">{key ? "✓" : "1"}</div>
          <div>
            <h2>Identifique a nota</h2>
            <p className="sub">Leia o QR do cupom ou digite a chave de 44 números.</p>
            <QrScanner onText={(t) => acceptInput(t)} />
            <div className="field">
              <label htmlFor="chave">Chave de acesso</label>
              <input id="chave" inputMode="numeric" autoComplete="off" placeholder="0000 0000 0000 …" value={typed} onChange={(e) => setTyped(e.target.value)} />
            </div>
            <button className="btn" onClick={() => acceptInput(typed)} disabled={!typed.trim()}>Usar esta chave</button>
            {keyMsg && <div className="msg bad" role="alert">{keyMsg}</div>}
            {key && <div className="msg good" role="status">Chave válida do RJ: <span className="num">{formatKey(key)}</span></div>}
            {alreadySaved && <div className="msg info" role="status">Esta nota já está guardada. <a href="#notas">Ver notas</a></div>}
            {nextStep && <p className="note" style={{ margin: "8px 0 0" }}>Chave guardada em Notas como pendente: dá para terminar depois.</p>}
          </div>
        </div>
      </section>

      <section className={`card${nextStep ? " next" : ""}`} id="passo2" aria-disabled={!key}>
        <div className="step">
          <div className="n" aria-hidden="true">2</div>
          <div>
            <h2>Abra a consulta oficial</h2>
            {nextStep && <p className="nexthint" role="status">Próximo passo: toque em <b>Abrir consulta da Fazenda</b>.</p>}
            <p className="sub">
              A nota abre no seu navegador. Lá, selecione todo o texto e copie, e volte ao app: ele oferece colar.
              No Android, com o app instalado, você também pode tocar em <b>Compartilhar</b> e escolher <b>Gôndola</b>.
            </p>
            <div className="row">
              <a role="link" className={`btn primary${key && online ? "" : " off"}`} href={key && online ? officialConsultaUrl(qrText) : undefined} target="_blank" rel="noopener noreferrer" aria-disabled={!key || !online} onClick={openConsulta}>Abrir consulta da Fazenda</a>
              <button className="btn" disabled={!key} onClick={copyKey}>Copiar chave</button>
            </div>
            {key && !online && <div className="msg warn" role="status">Sem internet. A consulta da Fazenda precisa de internet; a chave fica guardada em Notas para você terminar depois.</div>}
          </div>
        </div>
      </section>

      <section className="card" id="passo3">
        <div className="step">
          <div className="n" aria-hidden="true">3</div>
          <div>
            <h2>Traga a nota de volta</h2>
            <p className="sub">Cole o texto da página ou envie o PDF salvo dela ou o XML da nota. Se a soma dos itens conferir, a nota é guardada sozinha. Já tem o PDF, o XML ou o texto? Pode usar direto, sem os passos 1 e 2: a chave vem junto. O CPF e o nome do consumidor são ignorados e não ficam guardados.</p>
            <div className="row">
              <button className="btn tag" onClick={() => void paste()}>Colar da área de transferência</button>
              <label className="btn">
                Enviar PDF ou XML
                <input type="file" accept={FILE_ACCEPT} className="sr" onChange={(e) => { void onFile(e.target.files?.[0]); e.target.value = ""; }} />
              </label>
            </div>
            <div className="field">
              <label htmlFor="texto">Ou cole o texto aqui</label>
              <textarea id="texto" value={text} onChange={(e) => setText(e.target.value)} placeholder="Texto da consulta…" />
            </div>
            <button className="btn" disabled={!text.trim()} onClick={() => parse(text)}>Ler texto</button>
            {busy && <div className="msg info" role="status" aria-busy="true">Lendo o arquivo…</div>}
            {err && <div className="msg bad" role="alert">{err}</div>}
          </div>
        </div>
      </section>

      {result && !saved && !dup && (
        <div id="revisao">
          <Review
            result={result} duplicate={!!noteKey && hasNote(noteKey)} onSave={() => save(result, noteKey)} onCancel={reset}
            blocked={result.ok && !noteKey ? "O texto não traz a chave de acesso. Informe a chave no passo 1 para guardar esta nota." : undefined}
          />
        </div>
      )}
    </>
  );
}
