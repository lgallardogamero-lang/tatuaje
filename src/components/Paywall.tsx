"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { CREDIT_PACKS, eur } from "@/lib/config";
import { api, ApiError } from "@/lib/client/api";
import { Modal } from "./Modal";

export function Paywall({ open, onClose, reason }: { open: boolean; onClose: () => void; reason?: string }) {
  const path = usePathname();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");

  async function buy(packId: string) {
    setBusy(packId);
    setError("");
    try {
      const { url } = await api<{ url: string }>("/api/billing/checkout", { method: "POST", json: { packId, next: /^\/[a-z0-9/_-]*$/i.test(path) ? path : "/cuenta" } });
      window.location.href = url;
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "No se pudo iniciar el pago");
      setBusy(null);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Te has quedado sin créditos">
      <p className="text-bone/80">{reason ?? "Elige un paquete para seguir probando tatuajes. Pago único, sin suscripción."}</p>
      <ul className="grid gap-3">
        {CREDIT_PACKS.map((p) => (
          <li key={p.id}>
            <button
              type="button"
              disabled={busy !== null}
              onClick={() => buy(p.id)}
              className={`flex w-full items-center justify-between gap-4 rounded-[10px] border p-4 text-left transition-colors ${"highlight" in p ? "border-stencil bg-stencil/10" : "border-line hover:border-stencil"}`}
            >
              <span>
                <span className="display text-3xl">{p.credits}</span> <span className="text-bone/75">créditos</span>
                <span className="hint block">{eur(Math.round(p.priceCents / p.credits))} cada uno · {p.label}</span>
              </span>
              <span className="font-semibold">{busy === p.id ? "Abriendo…" : eur(p.priceCents)}</span>
            </button>
          </li>
        ))}
      </ul>
      {error && <p role="alert" className="notice error">{error}</p>}
      <p className="hint">Precios con IVA incluido. Pago seguro con Stripe.</p>
    </Modal>
  );
}
