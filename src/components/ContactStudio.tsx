"use client";

import Link from "next/link";
import { useState } from "react";
import { api, ApiError } from "@/lib/client/api";
import { Modal } from "./Modal";

export function ContactStudio({ orgId, orgName, jobId, signedIn }: { orgId: string; orgName: string; jobId?: string; signedIn: boolean }) {
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<"contact" | "booking">("contact");
  const [message, setMessage] = useState("");
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);

  if (!signedIn) return <Link href="/entrar" className="btn btn-ghost">Entrar para contactar</Link>;

  async function send(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await api("/api/leads", { method: "POST", json: { orgId, jobId, kind, message: message.trim() || undefined, consent } });
      setSent(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo enviar. Inténtalo de nuevo");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button className="btn btn-primary" onClick={() => setOpen(true)}>Contactar</button>
      <Modal open={open} onClose={() => setOpen(false)} title={`Contactar con ${orgName}`}>
        {sent ? (
          <div className="grid gap-4" role="status">
            <p className="text-bone/85">Listo. {orgName} recibirá tu mensaje y tu email, y te responderá por correo.</p>
            <button className="btn btn-ghost justify-self-start" onClick={() => setOpen(false)}>Cerrar</button>
          </div>
        ) : (
          <form onSubmit={send} className="grid gap-4">
            <div role="group" aria-label="Qué quieres" className="flex gap-2">
              <button type="button" className="chip" aria-pressed={kind === "contact"} onClick={() => setKind("contact")}>Tengo una consulta</button>
              <button type="button" className="chip" aria-pressed={kind === "booking"} onClick={() => setKind("booking")}>Quiero reservar</button>
            </div>
            <div className="field">
              <label htmlFor="lead-msg">Mensaje (opcional)</label>
              <textarea id="lead-msg" className="textarea" maxLength={500} value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Cuéntales qué tatuaje tienes en mente y dónde" />
            </div>
            <label className="flex items-start gap-3 text-[0.92rem] text-bone/85">
              <input type="checkbox" className="mt-1 h-5 w-5 shrink-0 accent-[#a58bff]" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
              <span>Acepto que Calco comparta mi email y este mensaje con {orgName} para que me responda.</span>
            </label>
            {error && <p role="alert" className="notice error">{error}</p>}
            <button className="btn btn-primary" disabled={busy || !consent}>{busy ? "Enviando…" : "Enviar"}</button>
          </form>
        )}
      </Modal>
    </>
  );
}
