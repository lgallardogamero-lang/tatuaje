"use client";

import { useState } from "react";
import { STUDIO_PLANS } from "@/lib/config";
import type { OrgRow } from "@/lib/admin";
import { useAdminAction } from "@/lib/client/useAdmin";

const PLANS = [["none", "Sin plan"], ...Object.entries(STUDIO_PLANS).map(([id, p]) => [id, p.label])] as [string, string][];

export function AdminOrgs({ orgs }: { orgs: OrgRow[] }) {
  const { busy, msg, run } = useAdminAction();
  const [f, setF] = useState({ name: "", city: "", ownerEmail: "", plan: "pro" });

  return (
    <div className="grid gap-10">
      <form
        className="panel grid gap-4 p-6 sm:grid-cols-2"
        onSubmit={async (e) => {
          e.preventDefault();
          if (await run("/api/admin/orgs", { method: "POST", json: f }, "Estudio creado")) setF({ name: "", city: "", ownerEmail: "", plan: "pro" });
        }}
      >
        <h2 className="text-2xl sm:col-span-2">Dar de alta un estudio</h2>
        <div className="field"><label htmlFor="o-name">Nombre</label><input id="o-name" className="input" required value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></div>
        <div className="field"><label htmlFor="o-city">Ciudad</label><input id="o-city" className="input" required value={f.city} onChange={(e) => setF({ ...f, city: e.target.value })} /></div>
        <div className="field"><label htmlFor="o-owner">Email del responsable</label><input id="o-owner" type="email" className="input" required value={f.ownerEmail} onChange={(e) => setF({ ...f, ownerEmail: e.target.value })} /><p className="hint">Debe tener ya una cuenta en Calco.</p></div>
        <div className="field">
          <label htmlFor="o-plan">Plan</label>
          <select id="o-plan" className="select" value={f.plan} onChange={(e) => setF({ ...f, plan: e.target.value })}>
            {PLANS.map(([id, label]) => <option key={id} value={id}>{label}</option>)}
          </select>
          <p className="hint">Se activa a mano, sin cobro. Útil para el mes de prueba gratis.</p>
        </div>
        <div className="sm:col-span-2"><button className="btn btn-primary" disabled={busy}>Crear estudio</button></div>
      </form>

      {msg && <p role="status" className={`notice ${msg.ok ? "ok" : "error"}`}>{msg.text}</p>}

      {orgs.length === 0 ? (
        <p className="text-bone/75">Todavía no hay estudios.</p>
      ) : (
        <ul className="grid gap-4">
          {orgs.map((o) => (
            <li key={o.id} className="panel grid gap-4 p-5">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h3 className="text-2xl">{o.name} <span className="text-mute">· {o.city}</span></h3>
                <p className="text-sm text-bone/75">{o.members} miembro(s) · {o.used}/{o.monthly_quota} generaciones este mes · {o.subscription_status === "active" ? "Activo" : "Inactivo"}</p>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <label className="text-sm" htmlFor={`plan-${o.id}`}>Plan</label>
                <select id={`plan-${o.id}`} className="select w-40" value={o.plan} disabled={busy} onChange={(e) => run(`/api/admin/orgs/${o.id}`, { method: "PATCH", json: { plan: e.target.value } }, "Plan actualizado")}>
                  {PLANS.map(([id, label]) => <option key={id} value={id}>{label}</option>)}
                </select>
                <button className="btn btn-ghost btn-sm" disabled={busy} onClick={() => run(`/api/admin/orgs/${o.id}`, { method: "PATCH", json: { listed: !o.listed } }, "Directorio actualizado")}>{o.listed ? "Quitar del directorio" : "Mostrar en el directorio"}</button>
                <button className="btn btn-ghost btn-sm" disabled={busy} onClick={() => run(`/api/admin/orgs/${o.id}`, { method: "PATCH", json: { featured: !o.featured } }, "Destacado actualizado")}>{o.featured ? "Quitar destacado" : "Destacar"}</button>
                <button className="btn btn-ghost btn-sm" disabled={busy} onClick={() => run(`/api/admin/orgs/${o.id}`, { method: "PATCH", json: { status: o.subscription_status === "active" ? "inactive" : "active" } }, "Estado actualizado")}>{o.subscription_status === "active" ? "Pausar" : "Activar"}</button>
                <button className="btn btn-ghost btn-sm text-danger" disabled={busy} onClick={() => window.confirm(`Se borrará el estudio ${o.name} y su catálogo. ¿Seguro?`) && run(`/api/admin/orgs/${o.id}`, { method: "DELETE" }, "Estudio borrado")}>Borrar</button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
