"use client";

import Link from "next/link";
import { useState } from "react";
import { STUDIO_PLANS, eur } from "@/lib/config";
import { api, ApiError } from "@/lib/client/api";

export function StudioRequestForm({ signedIn, status }: { signedIn: boolean; status: "pending" | "approved" | "rejected" | null }) {
  const [f, setF] = useState({ name: "", city: "", contactEmail: "", instagram: "", plan: "pro", message: "" });
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(status === "pending");

  if (!signedIn) {
    return (
      <div className="panel grid gap-4 p-6">
        <h2 className="text-2xl">Solicita el alta de tu estudio</h2>
        <p className="text-bone/80">Primero entra con tu email: la cuenta quedará como responsable del estudio.</p>
        <Link href="/entrar" className="btn btn-primary w-fit">Entrar para solicitarlo</Link>
      </div>
    );
  }
  if (sent) {
    return (
      <div className="panel grid gap-3 p-6" role="status">
        <h2 className="text-2xl">Solicitud recibida</h2>
        <p className="text-bone/80">La revisamos y te avisamos por email. Si la aprobamos, verás «Mi estudio» en la cabecera.</p>
      </div>
    );
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await api("/api/studio-requests", { method: "POST", json: { ...f, instagram: f.instagram || undefined, message: f.message || undefined } });
      setSent(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo enviar. Inténtalo de nuevo");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="panel grid gap-5 p-6 sm:grid-cols-2" id="solicitar">
      <h2 className="text-2xl sm:col-span-2">Solicita el alta de tu estudio</h2>
      {status === "rejected" && <p className="notice sm:col-span-2">Tu solicitud anterior no se pudo aprobar. Puedes enviar otra con los datos corregidos.</p>}
      <div className="field"><label htmlFor="r-name">Nombre del estudio</label><input id="r-name" className="input" required maxLength={80} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></div>
      <div className="field"><label htmlFor="r-city">Ciudad</label><input id="r-city" className="input" required maxLength={60} value={f.city} onChange={(e) => setF({ ...f, city: e.target.value })} /></div>
      <div className="field"><label htmlFor="r-mail">Email de contacto del estudio</label><input id="r-mail" type="email" className="input" required value={f.contactEmail} onChange={(e) => setF({ ...f, contactEmail: e.target.value })} /><p className="hint">Es el que verán los clientes en el directorio.</p></div>
      <div className="field"><label htmlFor="r-ig">Instagram (opcional)</label><input id="r-ig" className="input" placeholder="tuestudio" value={f.instagram} onChange={(e) => setF({ ...f, instagram: e.target.value })} /></div>
      <div className="field sm:col-span-2">
        <label htmlFor="r-plan">Plan que te interesa</label>
        <select id="r-plan" className="select" value={f.plan} onChange={(e) => setF({ ...f, plan: e.target.value })}>
          {Object.entries(STUDIO_PLANS).map(([id, p]) => <option key={id} value={id}>{p.label}: {eur(p.priceCents)} al mes, {p.quota} generaciones</option>)}
        </select>
        <p className="hint">Sin compromiso: te contactamos antes de activar nada.</p>
      </div>
      <div className="field sm:col-span-2"><label htmlFor="r-msg">Cuéntanos de tu estudio (opcional)</label><textarea id="r-msg" className="textarea" maxLength={600} value={f.message} onChange={(e) => setF({ ...f, message: e.target.value })} placeholder="Cuántos tatuadores sois, qué estilos hacéis…" /></div>
      <label className="flex items-start gap-3 text-[0.92rem] text-bone/85 sm:col-span-2">
        <input type="checkbox" className="mt-1 h-5 w-5 shrink-0 accent-[#a58bff]" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
        <span>Acepto que Calco use estos datos para contactarme sobre el alta de mi estudio. Más en el <Link className="link" href="/privacidad" target="_blank">aviso de privacidad</Link>.</span>
      </label>
      {error && <p role="alert" className="notice error sm:col-span-2">{error}</p>}
      <div className="sm:col-span-2"><button className="btn btn-primary" disabled={busy || !consent}>{busy ? "Enviando…" : "Enviar solicitud"}</button></div>
    </form>
  );
}
