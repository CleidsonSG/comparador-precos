import { useEffect, useRef, useState } from "react";
import { money, storeLabel } from "../lib/format.ts";
import type { MonthSeries } from "../modules/prices/compare.ts";

/** Cor fixa por mercado (posição na lista completa de mercados), nunca pela ordem de preço. */
export const seriesColor = (i: number): string => `var(--s${(i % 3) + 1})`;
const monthShort = (m: string) => new Date(`${m}-15T12:00:00`).toLocaleDateString("pt-BR", { month: "short", year: "2-digit" }).replace(". de ", "/").replace(" de ", "/");

/** Preço por mês, uma linha por mercado. Legenda, leitura do mês escolhido (toque, mouse, setas) e tabela. */
export default function MonthChart({ months, series, colorOf, label, table = false }: {
  months: string[]; series: MonthSeries[]; colorOf: (cnpj: string) => string; label: string; table?: boolean;
}) {
  const box = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(320);
  const [idx, setIdx] = useState(months.length - 1);
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setW(Math.max(260, Math.round(el.clientWidth))));
    ro.observe(el);
    setW(Math.max(260, Math.round(el.clientWidth)));
    return () => ro.disconnect();
  }, []);
  useEffect(() => setIdx(months.length - 1), [months]);

  const n = months.length;
  const H = 220, l = 52, r = 16, t = 14, b = 28;
  const vals = series.flatMap((s) => s.values.filter((v): v is number => v !== null)).map((v) => v / 100);
  const lo = Math.min(...vals), hi = Math.max(...vals);
  const pad = (hi - lo || hi * 0.1 || 1) * 0.25;
  const y0 = Math.max(0, lo - pad), y1 = hi + pad;
  const x = (i: number) => l + (n === 1 ? (w - l - r) / 2 : (i * (w - l - r)) / (n - 1));
  const y = (v: number) => t + (1 - (v - y0) / (y1 - y0)) * (H - t - b);
  const ticks = [0, 1, 2, 3].map((k) => y0 + ((y1 - y0) * k) / 3);
  const cur = Math.max(0, Math.min(n - 1, idx));
  const at = (clientX: number, rect: DOMRect) => {
    const px = ((clientX - rect.left) * w) / rect.width;
    setIdx(n === 1 ? 0 : Math.max(0, Math.min(n - 1, Math.round(((px - l) / (w - l - r)) * (n - 1)))));
  };
  // linha quebra nos meses sem compra
  const path = (vs: (number | null)[]) => {
    let d = "", pen = false;
    vs.forEach((v, i) => {
      if (v === null) { pen = false; return; }
      d += `${pen ? "L" : "M"}${x(i).toFixed(1)} ${y(v / 100).toFixed(1)} `;
      pen = true;
    });
    return d;
  };

  return (
    <div ref={box}>
      <ul className="legend" aria-label="Mercados">
        {series.map((s) => <li key={s.market.cnpj}><i style={{ background: colorOf(s.market.cnpj) }} />{storeLabel(s.market.name)}</li>)}
      </ul>
      <div className="readout" aria-live="polite">
        <b>{monthShort(months[cur]!)}</b>
        {series.map((s) => (
          <span key={s.market.cnpj} className="rv">
            <i style={{ background: colorOf(s.market.cnpj) }} aria-hidden="true" />{storeLabel(s.market.name)}: <b className="num">{s.values[cur] === null ? "sem compra" : money(s.values[cur]!)}</b>
          </span>
        ))}
      </div>
      {table ? (
        <div className="tablewrap">
          <table style={{ minWidth: 0 }}>
            <caption className="sr">{label}</caption>
            <thead><tr><th>Mês</th>{series.map((s) => <th key={s.market.cnpj} className="r">{storeLabel(s.market.name)}</th>)}</tr></thead>
            <tbody>{months.map((m, i) => (
              <tr key={m}><td>{monthShort(m)}</td>{series.map((s) => <td key={s.market.cnpj} className="r num">{s.values[i] === null ? "—" : money(s.values[i]!)}</td>)}</tr>
            ))}</tbody>
          </table>
        </div>
      ) : (
        <svg
          viewBox={`0 0 ${w} ${H}`} width={w} height={H} role="img" tabIndex={0} style={{ display: "block", touchAction: "pan-y" }}
          aria-label={`${label}. ${n} ${n === 1 ? "mês" : "meses"}, ${series.length} mercados. Use as setas para ver cada mês, ou veja a tabela.`}
          onPointerMove={(e) => at(e.clientX, e.currentTarget.getBoundingClientRect())}
          onPointerDown={(e) => at(e.clientX, e.currentTarget.getBoundingClientRect())}
          onKeyDown={(e) => {
            if (e.key === "ArrowRight") { setIdx(Math.min(n - 1, cur + 1)); e.preventDefault(); }
            if (e.key === "ArrowLeft") { setIdx(Math.max(0, cur - 1)); e.preventDefault(); }
          }}
        >
          {ticks.map((tv) => (
            <g key={tv}>
              <line x1={l} x2={w - r} y1={y(tv)} y2={y(tv)} stroke="var(--line)" />
              <text x={l - 8} y={y(tv) + 4} textAnchor="end" fontSize="11" fill="var(--ink2)">{tv.toFixed(2).replace(".", ",")}</text>
            </g>
          ))}
          {months.map((m, i) => (n <= 6 || i === 0 || i === n - 1 || i % Math.ceil(n / 5) === 0) && (
            <text key={m} x={x(i)} y={H - 8} textAnchor={i === 0 && n > 1 ? "start" : i === n - 1 && n > 1 ? "end" : "middle"} fontSize="11" fill="var(--ink2)">{monthShort(m)}</text>
          ))}
          <line x1={x(cur)} x2={x(cur)} y1={t} y2={H - b} stroke="var(--ink2)" strokeDasharray="3 3" />
          {series.map((s) => (
            <g key={s.market.cnpj}>
              <path d={path(s.values)} fill="none" stroke={colorOf(s.market.cnpj)} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
              {s.values.map((v, i) => v !== null && <circle key={i} cx={x(i)} cy={y(v / 100)} r={i === cur ? 6 : 4} fill={colorOf(s.market.cnpj)} stroke="var(--surface)" strokeWidth="2" />)}
            </g>
          ))}
        </svg>
      )}
    </div>
  );
}
