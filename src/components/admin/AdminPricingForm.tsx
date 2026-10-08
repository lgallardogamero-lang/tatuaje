"use client";

import { useState } from "react";
import type { Pricing } from "@/lib/pricing";
import { useAdminAction } from "@/lib/client/useAdmin";

const num = (v: string) => (v.trim() === "" ? NaN : Number(v));

export function AdminPricingForm({ initial }: { initial: Pricing }) {
  const { busy, msg, run } = useAdminAction();
  const [p, setP] = useState<Pricing>(initial);
  const euros = (c: number) => String(c / 100);
  const cents = (s: string) => Math.round(num(s) * 100);

  return (
    <form
      className="grid gap-10"
      onSubmit={(e) => {
        e.preventDefault();
        void run("/api/admin/pricing", { method: "PUT", json: p }, "Precios guardados");
      }}
    >
      <section className="grid gap-4 sm:grid-cols-2">
        <div className="field">
          <label htmlFor="free">Pruebas gratis al registrarse</label>
          <input id="free" type="number" min={0} max={20} className="input" value={p.freeCredits} onChange={(e) => setP({ ...p, freeCredits: num(e.target.value) })} />
        </div>
        <div className="field">
          <label htmlFor="cost">Coste de IA por imagen (céntimos de €)</label>
          <input id="cost" type="number" step="0.1" min={0} max={100} className="input" value={p.aiUnitCostCents} onChange={(e) => setP({ ...p, aiUnitCostCents: num(e.target.value) })} />
          <p className="hint">Solo para calcular el margen en el resumen. Con el proveedor simulado no hay coste real.</p>
        </div>
      </section>

      <section className="grid gap-4">
        <h2 className="text-2xl">Paquetes de créditos</h2>
        {p.packs.map((k, i) => (
          <div key={i} className="panel grid items-end gap-3 p-4 sm:grid-cols-[8rem_7rem_8rem_1fr_auto_auto]">
            <div className="field"><label htmlFor={`id${i}`}>Identificador</label><input id={`id${i}`} className="input" value={k.id} onChange={(e) => setP({ ...p, packs: p.packs.map((x, j) => (j === i ? { ...x, id: e.target.value } : x)) })} /></div>
            <div className="field"><label htmlFor={`cr${i}`}>Créditos</label><input id={`cr${i}`} type="number" min={1} className="input" value={k.credits} onChange={(e) => setP({ ...p, packs: p.packs.map((x, j) => (j === i ? { ...x, credits: num(e.target.value) } : x)) })} /></div>
            <div className="field"><label htmlFor={`pr${i}`}>Precio (€ con IVA)</label><input id={`pr${i}`} type="number" step="0.01" min={0.5} className="input" value={euros(k.priceCents)} onChange={(e) => setP({ ...p, packs: p.packs.map((x, j) => (j === i ? { ...x, priceCents: cents(e.target.value) } : x)) })} /></div>
            <div className="field"><label htmlFor={`lb${i}`}>Etiqueta</label><input id={`lb${i}`} className="input" value={k.label} onChange={(e) => setP({ ...p, packs: p.packs.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)) })} /></div>
            <label className="flex h-12 items-center gap-2 text-sm"><input type="checkbox" className="h-5 w-5 accent-[#a58bff]" checked={Boolean(k.highlight)} onChange={(e) => setP({ ...p, packs: p.packs.map((x, j) => (j === i ? { ...x, highlight: e.target.checked } : x)) })} />Destacado</label>
            <button type="button" className="btn btn-quiet text-danger" disabled={p.packs.length <= 1} onClick={() => setP({ ...p, packs: p.packs.filter((_, j) => j !== i) })}>Quitar</button>
          </div>
        ))}
        <button type="button" className="btn btn-ghost w-fit" disabled={p.packs.length >= 6} onClick={() => setP({ ...p, packs: [...p.packs, { id: `pack${p.packs.length + 1}`, credits: 10, priceCents: 499, label: "Nuevo" }] })}>Añadir paquete</button>
      </section>

      <section className="grid gap-4">
        <h2 className="text-2xl">Descargas</h2>
        {(["hd", "stencil"] as const).map((k) => (
          <div key={k} className="panel grid items-end gap-3 p-4 sm:grid-cols-[1fr_8rem_9rem]">
            <div className="field"><label htmlFor={`al-${k}`}>{k === "hd" ? "Alta resolución sin marca de agua" : "Diseño y stencil"}</label><input id={`al-${k}`} className="input" value={p.assets[k].label} onChange={(e) => setP({ ...p, assets: { ...p.assets, [k]: { ...p.assets[k], label: e.target.value } } })} /></div>
            <div className="field"><label htmlFor={`ac-${k}`}>Créditos</label><input id={`ac-${k}`} type="number" min={0} className="input" value={p.assets[k].credits} onChange={(e) => setP({ ...p, assets: { ...p.assets, [k]: { ...p.assets[k], credits: num(e.target.value) } } })} /></div>
            <div className="field"><label htmlFor={`ap-${k}`}>Precio (€ con IVA)</label><input id={`ap-${k}`} type="number" step="0.01" min={0} className="input" value={euros(p.assets[k].priceCents)} onChange={(e) => setP({ ...p, assets: { ...p.assets, [k]: { ...p.assets[k], priceCents: cents(e.target.value) } } })} /></div>
          </div>
        ))}
      </section>

      <div className="flex flex-wrap items-center gap-3">
        <button className="btn btn-primary" disabled={busy}>Guardar cambios</button>
        <button type="button" className="btn btn-ghost" disabled={busy} onClick={async () => window.confirm("Volver a los precios por defecto?") && (await run("/api/admin/pricing", { method: "DELETE" }, "Precios restablecidos")) && window.location.reload()}>Restablecer valores por defecto</button>
      </div>
      {msg && <p role="status" className={`notice ${msg.ok ? "ok" : "error"}`}>{msg.text}</p>}
    </form>
  );
}
