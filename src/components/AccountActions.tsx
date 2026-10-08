"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { api, ApiError } from "@/lib/client/api";

export function AccountActions() {
  const router = useRouter();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  async function run(fn: () => Promise<unknown>, okText: string, after?: () => void) {
    setBusy(true);
    setMsg(null);
    try {
      await fn();
      setMsg({ ok: true, text: okText });
      after?.();
    } catch (e) {
      setMsg({ ok: false, text: e instanceof ApiError ? e.message : "Algo ha fallado" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <section aria-labelledby="priv" className="grid gap-5">
      <h2 id="priv" className="text-2xl">Privacidad y sesión</h2>
      <p className="text-bone/75">Tus fotos se borran solas a las 24 horas. Si prefieres, bórralas ahora.</p>
      <div className="flex flex-wrap gap-3">
        <button disabled={busy} className="btn btn-ghost" onClick={() => run(() => api("/api/me/photos", { method: "DELETE" }), "Hemos borrado todas tus fotos y resultados.")}>
          Borrar mis fotos
        </button>
        <button disabled={busy} className="btn btn-ghost" onClick={() => run(() => api("/api/auth/logout", { method: "POST" }), "Sesión cerrada.", () => { router.push("/"); router.refresh(); })}>
          Cerrar sesión
        </button>
        <button
          disabled={busy}
          className="btn btn-ghost text-danger"
          onClick={() => {
            if (window.confirm("Se borrarán tus fotos y tu cuenta, y perderás los créditos que te queden. ¿Seguro?")) {
              void run(() => api("/api/me/account", { method: "DELETE" }), "Cuenta eliminada.", () => { router.push("/"); router.refresh(); });
            }
          }}
        >
          Eliminar mi cuenta
        </button>
      </div>
      {msg && <p role="status" className={`notice ${msg.ok ? "ok" : "error"}`}>{msg.text}</p>}
    </section>
  );
}
