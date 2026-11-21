import { money } from "../lib/format.ts";
import { loadNotes } from "../lib/storage.ts";

export default function Home() {
  const notes = loadNotes();
  const total = notes.reduce((s, n) => s + n.payableCents, 0);
  const items = notes.reduce((s, n) => s + n.items.length, 0);
  if (notes.length === 0)
    return (
      <div className="card empty">
        <h3>Comece pela primeira nota</h3>
        <p>Leia o QR do cupom ou digite a chave. Os preços ficam guardados para comparar na próxima compra.</p>
        <a className="btn tag" href="#importar">Importar nota</a>
      </div>
    );
  return (
    <>
      <div className="grid kpis">
        <div className="card kpi"><div className="note">Notas guardadas</div><div className="v cond num">{notes.length}</div></div>
        <div className="card kpi"><div className="note">Itens registrados</div><div className="v cond num">{items}</div></div>
        <div className="card kpi"><div className="note">Total gasto</div><div className="v cond num">{money(total)}</div></div>
      </div>
      <div className="row"><a className="btn tag" href="#importar">Importar outra nota</a><a className="btn" href="#notas">Ver notas</a></div>
    </>
  );
}
