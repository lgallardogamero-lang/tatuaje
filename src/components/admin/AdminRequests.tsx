"use client";

import { useState } from "react";
import { STUDIO_PLANS } from "@/lib/config";
import type { StudioRequest } from "@/lib/studio-requests";
import { useAdminAction } from "@/lib/client/useAdmin";

const fmt = new Intl.DateTimeFormat("es-ES", { dateStyle: "medium", timeZone: "Europe/Madrid" });

export function AdminRequests({ requests }: { requests: StudioRequest[] }) {
  const { busy, msg, run } = useAdminAction();
  const [plans, setPlans] = useState<Record<string, string>>({});
  if (requests.length === 0 && !msg) return null;
  return (
    <section aria-labelledby="solicitudes" className="grid gap-4">
      <h2 id="solicitudes" className="text-2xl">Solicitudes pendientes <span className="text-mute">({requests.length})</span></h2>
      {msg && <p role="status" className={`notice ${msg.ok ? "ok" : "error"}`}>{msg.text}</p>}
      <ul className="grid gap-4">
        {requests.map((r) => (
          <li key={r.id} className="panel grid gap-3 p-5">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h3 className="text-2xl">{r.name} <span className="text-mute">· {r.city}</span></h3>
              <p className="text-sm text-bone/75">{fmt.format(r.created_at)}</p>
            </div>
            <p className="text-sm text-bone/80">Pide el plan {STUDIO_PLANS[r.plan_wanted].label} · Cuenta: {r.email} · Contacto: {r.contact_email}{r.instagram ? ` · @${r.instagram}` : ""}</p>
            {r.message && <p className="text-bone/85">“{r.message}”</p>}
            <div className="flex flex-wrap items-center gap-3">
              <label className="text-sm" htmlFor={`pl-${r.id}`}>Activar con</label>
              <select id={`pl-${r.id}`} className="select w-44" value={plans[r.id] ?? r.plan_wanted} onChange={(e) => setPlans({ ...plans, [r.id]: e.target.value })}>
                <option value="none">Sin plan (solo crear)</option>
                {Object.entries(STUDIO_PLANS).map(([id, p]) => <option key={id} value={id}>{p.label}</option>)}
              </select>
              <button className="btn btn-primary btn-sm" disabled={busy} onClick={() => run(`/api/admin/studio-requests/${r.id}`, { method: "POST", json: { action: "approve", plan: plans[r.id] ?? r.plan_wanted } }, `Estudio «${r.name}» creado`)}>Aprobar</button>
              <button className="btn btn-ghost btn-sm" disabled={busy} onClick={() => { const reason = window.prompt("Motivo (se envía a quien lo pidió, opcional)") ?? undefined; if (reason !== undefined) void run(`/api/admin/studio-requests/${r.id}`, { method: "POST", json: { action: "reject", reason: reason || undefined } }, "Solicitud rechazada"); }}>Rechazar</button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
