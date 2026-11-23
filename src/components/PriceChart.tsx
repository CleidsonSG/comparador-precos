import { useEffect, useRef, useState } from "react";
import type { Observation } from "../modules/prices/analytics.ts";
import { money } from "../lib/format.ts";

const dm = (iso: string) => new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });

/** Linha de uma série (preço de um produto em um mercado ao longo das compras), com leitura por toque, mouse e setas. */
export default function PriceChart({ points, label, table = false }: { points: Observation[]; label: string; table?: boolean }) {
  const box = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(320);
  const [idx, setIdx] = useState(points.length - 1);

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setW(Math.max(260, Math.round(el.clientWidth))));
    ro.observe(el);
    setW(Math.max(260, Math.round(el.clientWidth)));
    return () => ro.disconnect();
  }, []);
  useEffect(() => setIdx(points.length - 1), [points]);

  const H = 220, l = 52, r = 16, t = 14, b = 28;
  const vals = points.map((p) => p.unitPriceCents / 100);
  const lo = Math.min(...vals), hi = Math.max(...vals);
  const pad = (hi - lo || hi * 0.1 || 1) * 0.25;
  const y0 = Math.max(0, lo - pad), y1 = hi + pad;
  const n = points.length;
  const x = (i: number) => l + (n === 1 ? (w - l - r) / 2 : (i * (w - l - r)) / (n - 1));
  const y = (v: number) => t + (1 - (v - y0) / (y1 - y0)) * (H - t - b);
  const ticks = [0, 1, 2, 3].map((k) => y0 + ((y1 - y0) * k) / 3);
  const path = vals.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join(" ");
  const cur = points[idx] ?? points[n - 1]!;
  const prev = idx > 0 ? points[idx - 1] : null;

  const at = (clientX: number, rect: DOMRect) => {
    const px = ((clientX - rect.left) * w) / rect.width;
    const i = n === 1 ? 0 : Math.round(((px - l) / (w - l - r)) * (n - 1));
    setIdx(Math.max(0, Math.min(n - 1, i)));
  };

  return (
    <div ref={box}>
      <div className="readout" aria-live="polite">
        <b>{dm(cur.date)}</b> <span className="cond num" style={{ fontSize: 22 }}>{money(cur.unitPriceCents)}</span>
        {prev && <span className="note">na compra anterior: {money(prev.unitPriceCents)}</span>}
      </div>
      {table ? (
        <div className="tablewrap">
          <table style={{ minWidth: 0 }}>
            <caption className="sr">{label}</caption>
            <thead><tr><th>Data</th><th className="r">Preço unit.</th></tr></thead>
            <tbody>{points.map((p) => <tr key={p.date}><td>{dm(p.date)}</td><td className="r num">{money(p.unitPriceCents)}</td></tr>)}</tbody>
          </table>
        </div>
      ) : (
        <svg
          viewBox={`0 0 ${w} ${H}`} width={w} height={H} role="img" tabIndex={0} style={{ display: "block", touchAction: "pan-y" }}
          aria-label={`${label}. ${n} compras, de ${money(points[0]!.unitPriceCents)} a ${money(points[n - 1]!.unitPriceCents)}. Use as setas para ver cada compra.`}
          onPointerMove={(e) => at(e.clientX, e.currentTarget.getBoundingClientRect())}
          onPointerDown={(e) => at(e.clientX, e.currentTarget.getBoundingClientRect())}
          onKeyDown={(e) => {
            if (e.key === "ArrowRight") { setIdx((i) => Math.min(n - 1, i + 1)); e.preventDefault(); }
            if (e.key === "ArrowLeft") { setIdx((i) => Math.max(0, i - 1)); e.preventDefault(); }
          }}
        >
          {ticks.map((tv) => (
            <g key={tv}>
              <line x1={l} x2={w - r} y1={y(tv)} y2={y(tv)} stroke="var(--line)" />
              <text x={l - 8} y={y(tv) + 4} textAnchor="end" fontSize="11" fill="var(--ink2)">{tv.toFixed(2).replace(".", ",")}</text>
            </g>
          ))}
          {points.map((p, i) => (n <= 6 || i === 0 || i === n - 1 || i % Math.ceil(n / 5) === 0) && (
            <text key={p.date} x={x(i)} y={H - 8} textAnchor={i === 0 && n > 1 ? "start" : i === n - 1 && n > 1 ? "end" : "middle"} fontSize="11" fill="var(--ink2)">{dm(p.date)}</text>
          ))}
          {n > 1 && <path d={path} fill="none" stroke="var(--s1)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />}
          <line x1={x(idx)} x2={x(idx)} y1={t} y2={H - b} stroke="var(--ink2)" strokeDasharray="3 3" />
          {points.map((p, i) => <circle key={p.date} cx={x(i)} cy={y(vals[i]!)} r={i === idx ? 5 : 3} fill="var(--s1)" stroke="var(--surface)" strokeWidth="2" />)}
        </svg>
      )}
    </div>
  );
}
