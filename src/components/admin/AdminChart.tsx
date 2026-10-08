"use client";

import { useState } from "react";
import type { DayRow } from "@/lib/admin";
import { eur } from "@/lib/config";

// Paleta validada para fondo oscuro (separación para daltonismo y contraste ≥ 3:1)
const REVENUE = "#9478F0";
const COST = "#C47F2C";
const W = 720;
const H = 260;
const M = { l: 52, r: 12, t: 12, b: 34 };

function niceMax(v: number) {
  if (v <= 0) return 100;
  const p = Math.pow(10, Math.floor(Math.log10(v)));
  const n = v / p;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * p;
}

/** Ingresos (con IVA) frente a coste estimado de IA por día. Barras agrupadas, tabla equivalente debajo. */
export function AdminChart({ series }: { series: DayRow[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(100, niceMax(Math.max(...series.map((d) => Math.max(d.revenueCents, d.costCents)), 1)));
  const iw = W - M.l - M.r;
  const ih = H - M.t - M.b;
  const slot = iw / series.length;
  const bw = Math.min(16, (slot - 8) / 2 - 1);
  const y = (v: number) => M.t + ih - (v / max) * ih;
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((t) => t * max);
  const d = hover !== null ? series[hover] : null;
  const fmtDay = (s: string) => new Intl.DateTimeFormat("es-ES", { day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(`${s}T12:00:00Z`));

  return (
    <figure className="grid max-w-4xl gap-3">
      <figcaption className="flex flex-wrap items-center gap-x-5 gap-y-1 text-sm">
        <span className="font-semibold">Ingresos y coste de IA por día</span>
        <span className="flex items-center gap-2 text-bone/80"><i className="inline-block h-3 w-3 rounded-[3px]" style={{ background: REVENUE }} />Ingresos (con IVA)</span>
        <span className="flex items-center gap-2 text-bone/80"><i className="inline-block h-3 w-3 rounded-[3px]" style={{ background: COST }} />Coste estimado de IA</span>
      </figcaption>
      <div className="relative">
        <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label="Gráfico de barras de ingresos y coste de IA de los últimos días. Los mismos datos están en la tabla de debajo.">
          {ticks.map((t) => (
            <g key={t}>
              <line x1={M.l} x2={W - M.r} y1={y(t)} y2={y(t)} stroke="#2a2e3a" strokeWidth={1} />
              <text x={M.l - 8} y={y(t) + 4} textAnchor="end" fontSize="11" fill="#9a9ba3">{eur(t)}</text>
            </g>
          ))}
          {series.map((s, i) => {
            const x0 = M.l + i * slot + (slot - (bw * 2 + 2)) / 2;
            const bar = (v: number, x: number, color: string) =>
              v > 0 ? <path d={`M${x} ${y(0)} V${y(v) + 4} a4 4 0 0 1 4 -4 h${bw - 8} a4 4 0 0 1 4 4 V${y(0)} Z`} fill={color} /> : <rect x={x} y={y(0) - 1} width={bw} height={1} fill="#2a2e3a" />;
            return (
              <g key={s.day}>
                {hover === i && <rect x={M.l + i * slot} y={M.t} width={slot} height={ih} fill="#ffffff" opacity={0.05} />}
                {bar(s.revenueCents, x0, REVENUE)}
                {bar(s.costCents, x0 + bw + 2, COST)}
                {(i % 2 === 0 || series.length < 9) && (
                  <text x={M.l + i * slot + slot / 2} y={H - 12} textAnchor="middle" fontSize="11" fill="#9a9ba3">{fmtDay(s.day)}</text>
                )}
                {/* zona de contacto mayor que las barras */}
                <rect
                  x={M.l + i * slot}
                  y={M.t}
                  width={slot}
                  height={ih + M.b}
                  fill="transparent"
                  tabIndex={0}
                  role="img"
                  aria-label={`${fmtDay(s.day)}: ingresos ${eur(s.revenueCents)}, coste de IA ${eur(s.costCents)}, ${s.jobs} generaciones`}
                  onMouseEnter={() => setHover(i)}
                  onMouseLeave={() => setHover(null)}
                  onFocus={() => setHover(i)}
                  onBlur={() => setHover(null)}
                />
              </g>
            );
          })}
        </svg>
        {d && (
          <div className="pointer-events-none absolute top-2 z-10 min-w-44 rounded-md border border-line bg-panel-2 p-3 text-sm shadow-lg" style={{ left: `${Math.min(70, Math.max(2, ((M.l + (hover ?? 0) * slot) / W) * 100))}%` }}>
            <p className="font-semibold">{fmtDay(d.day)}</p>
            <p className="text-bone/80">Ingresos: {eur(d.revenueCents)}</p>
            <p className="text-bone/80">Coste IA: {eur(d.costCents)}</p>
            <p className="text-bone/80">{d.jobs} generaciones{d.failed ? `, ${d.failed} fallidas` : ""}</p>
          </div>
        )}
      </div>
      <details className="text-sm">
        <summary className="cursor-pointer text-bone/80">Ver como tabla</summary>
        <div className="mt-3 overflow-x-auto" tabIndex={0} role="region" aria-label="Tabla desplazable">
          <table className="w-full min-w-[32rem] text-left">
            <thead className="text-mute">
              <tr><th className="py-1 pr-4 font-semibold">Día</th><th className="pr-4 font-semibold">Ingresos</th><th className="pr-4 font-semibold">Coste IA</th><th className="pr-4 font-semibold">Generaciones</th><th className="font-semibold">Fallidas</th></tr>
            </thead>
            <tbody>
              {[...series].reverse().map((s) => (
                <tr key={s.day} className="border-t border-line"><td className="py-1.5 pr-4">{fmtDay(s.day)}</td><td className="pr-4">{eur(s.revenueCents)}</td><td className="pr-4">{eur(s.costCents)}</td><td className="pr-4">{s.jobs}</td><td>{s.failed}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </figure>
  );
}
