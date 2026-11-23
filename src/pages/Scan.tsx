import { useMemo, useState } from "react";
import BarcodeScanner from "../components/BarcodeScanner.tsx";
import { IconDoc, IconScan } from "../components/Icons.tsx";
import { loadCart, saveCart } from "../lib/cart.ts";
import { money, sentenceCase, storeLabel } from "../lib/format.ts";
import { findLink, isBarcode, removeLink, saveLink, type ProductLink } from "../lib/links.ts";
import { parseMoney } from "../lib/money.ts";
import { loadNotes } from "../lib/storage.ts";
import { latestPrices, pricesForKeys, verdict } from "../modules/prices/analytics.ts";

const OTHER = "outro";

export default function Scan({ toast }: { toast: (t: string) => void }) {
  const notes = useMemo(loadNotes, []);
  const stores = useMemo(() => {
    const m = new Map<string, string>();
    for (const n of [...notes].sort((a, b) => (a.issuedAt ?? a.savedAt).localeCompare(b.issuedAt ?? b.savedAt))) m.set(n.storeCnpj, n.storeName);
    return [...m].map(([cnpj, name]) => ({ cnpj, name })).reverse();
  }, [notes]);
  const products = useMemo(() => [...latestPrices(notes).values()].sort((a, b) => a.description.localeCompare(b.description)), [notes]);

  const [typed, setTyped] = useState("");
  const [barcode, setBarcode] = useState<string | null>(null);
  const [msg, setMsg] = useState("");
  const [link, setLink] = useState<ProductLink | undefined>();
  const [store, setStore] = useState(stores[0]?.cnpj ?? OTHER);
  const [shelf, setShelf] = useState("");
  const [qty, setQty] = useState(1);
  const [q, setQ] = useState("");
  const [picked, setPicked] = useState<string[]>([]);
  const [name, setName] = useState("");

  if (notes.length === 0)
    return (
      <div className="card empty">
        <IconDoc size={44} />
        <h3>Importe uma nota primeiro</h3>
        <p>Para comparar na gôndola, o app precisa dos preços que você já pagou.</p>
        <a className="btn tag" href="#importar">Importar nota</a>
      </div>
    );

  const accept = (raw: string) => {
    const code = raw.replace(/\D/g, "");
    setMsg("");
    if (!isBarcode(code)) { setMsg("Código de barras inválido. Ele tem de 8 a 14 números."); return; }
    setBarcode(code); setLink(findLink(code)); setShelf(""); setQty(1); setQ(""); setPicked([]); setName(""); setTyped("");
  };

  const known = link ? pricesForKeys(link.keys, notes) : [];
  const shelfCents = parseMoney(shelf);
  const v = shelfCents !== null ? verdict(shelfCents, known) : null;
  const storeName = store === OTHER ? "Outro mercado" : (stores.find((s) => s.cnpj === store)?.name ?? "");
  const filtered = products.filter((p) => !q.trim() || p.description.toLowerCase().includes(q.trim().toLowerCase())).slice(0, 30);

  const confirmLink = () => {
    if (!barcode || picked.length === 0) return;
    try {
      const l: ProductLink = { barcode, name: name.trim() || products.find((p) => p.productKey === picked[0])!.description, keys: picked, confirmedAt: new Date().toISOString() };
      saveLink(l); setLink(l); toast("Vínculo confirmado");
    } catch (e) { setMsg(e instanceof Error ? e.message : "Erro ao guardar."); }
  };

  const add = () => {
    if (!link || shelfCents === null) return;
    try {
      const cart = loadCart();
      cart.push({ id: crypto.randomUUID(), barcode: link.barcode, name: link.name, qty, shelfCents, storeCnpj: store === OTHER ? "" : store, storeName });
      saveCart(cart); toast("Adicionado ao carrinho"); setBarcode(null); setLink(undefined);
    } catch (e) { setMsg(e instanceof Error ? e.message : "Erro ao guardar."); }
  };

  return (
    <div className="grid two">
      <section className="card" aria-labelledby="sc">
        <h2 id="sc" className="sr">Ler código de barras</h2>
        <BarcodeScanner onCode={accept} />
        <div className="field">
          <label htmlFor="cod">Ou digite o código de barras</label>
          <input id="cod" inputMode="numeric" autoComplete="off" placeholder="7891000100103" value={typed} onChange={(e) => setTyped(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") accept(typed); }} />
        </div>
        <button className="btn" disabled={!typed.trim()} onClick={() => accept(typed)}>Usar código</button>
        <div className="field">
          <label htmlFor="loja">Você está em</label>
          <select id="loja" value={store} onChange={(e) => setStore(e.target.value)}>
            {stores.map((s) => <option key={s.cnpj} value={s.cnpj}>{storeLabel(s.name)}</option>)}
            <option value={OTHER}>Outro mercado</option>
          </select>
        </div>
        {msg && <div className="msg bad" role="alert">{msg}</div>}
      </section>

      <section className="card" aria-labelledby="rs" aria-live="polite">
        {!barcode && (
          <div className="empty">
            <IconScan size={44} />
            <h3 id="rs">Escaneie um produto</h3>
            <p>O preço de cada mercado onde você já comprou aparece aqui, antes de pôr no carrinho.</p>
          </div>
        )}

        {barcode && !link && (
          <>
            <h2 id="rs">Código novo</h2>
            <p className="sub">Código <span className="num">{barcode}</span>. A nota não traz o código de barras, então confirme quais itens das suas notas são este produto. Você só faz isso uma vez.</p>
            <div className="field">
              <label htmlFor="busca">Buscar nas suas notas</label>
              <input id="busca" value={q} onChange={(e) => setQ(e.target.value)} placeholder="ex.: arroz" />
            </div>
            <div className="pick" role="group" aria-label="Itens das suas notas">
              {filtered.length === 0 && <p className="note">Nenhum item com esse nome.</p>}
              {filtered.map((p) => (
                <label className="check" key={p.productKey}>
                  <input type="checkbox" checked={picked.includes(p.productKey)} onChange={(e) => setPicked(e.target.checked ? [...picked, p.productKey] : picked.filter((k) => k !== p.productKey))} />
                  <span>{sentenceCase(p.description)}<span className="note">, {storeLabel(p.storeName)}, {money(p.unitPriceCents)}</span></span>
                </label>
              ))}
            </div>
            <div className="field">
              <label htmlFor="nome">Nome do produto</label>
              <input id="nome" value={name} onChange={(e) => setName(e.target.value)} placeholder="opcional" />
            </div>
            <div className="row">
              <button className="btn primary" disabled={picked.length === 0} onClick={confirmLink}>Confirmar que é o mesmo produto</button>
              <button className="btn" onClick={() => setBarcode(null)}>Cancelar</button>
            </div>
          </>
        )}

        {barcode && link && (
          <>
            <h2 id="rs">{link.name}</h2>
            <p className="note">Código <span className="num">{link.barcode}</span></p>
            <div className="tablewrap">
              <table style={{ minWidth: 0 }}>
                <caption className="sr">Últimos preços que você pagou</caption>
                <thead><tr><th>Mercado</th><th className="r">Último preço</th></tr></thead>
                <tbody>
                  {known.length === 0 && <tr><td colSpan={2}>Sem preço nas suas notas.</td></tr>}
                  {known.map((o, i) => (
                    <tr key={o.productKey}><td>{storeLabel(o.storeName)}{i === 0 && known.length > 1 && <> <span className="pill good">↓ mais barato</span></>}</td><td className="r num">{money(o.unitPriceCents)}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="field">
              <label htmlFor="preco">Preço na etiqueta (R$)</label>
              <input id="preco" inputMode="decimal" placeholder="0,00" value={shelf} onChange={(e) => setShelf(e.target.value)} />
            </div>
            {shelf.trim() && shelfCents === null && <div className="msg bad" role="alert">Preço inválido. Use números, como 12,90.</div>}
            {v?.kind === "best" && <div className="msg good" role="status">↓ Melhor preço que você já pagou{v.savingCents > 0 && <> — {money(v.savingCents)} abaixo do último</>}.</div>}
            {v?.kind === "worse" && <div className="msg bad" role="status">↑ Mais caro: você pagou {money(v.best.unitPriceCents)} em {v.best.storeName} (+{money(v.extraCents)}, {(v.extraPct * 100).toFixed(0)}%).</div>}
            {v?.kind === "unknown" && <div className="msg info" role="status">Sem histórico para comparar.</div>}
            <div className="row">
              <label className="note" htmlFor="qtd">Qtde</label>
              <input id="qtd" type="number" min={1} max={99} value={qty} onChange={(e) => setQty(Math.max(1, Math.min(99, Number(e.target.value) || 1)))} style={{ width: 72, minHeight: 44, border: "1px solid var(--line)", borderRadius: 12, padding: "0 10px", background: "var(--surface)" }} />
              <button className="btn primary" disabled={shelfCents === null} onClick={add}>Adicionar ao carrinho</button>
              <button className="btn" onClick={() => setBarcode(null)}>Escanear outro</button>
            </div>
            <button className="btn danger sm" style={{ marginTop: 12 }} onClick={() => { removeLink(link.barcode); setLink(undefined); toast("Vínculo desfeito"); }}>Desfazer vínculo</button>
          </>
        )}
      </section>
    </div>
  );
}
