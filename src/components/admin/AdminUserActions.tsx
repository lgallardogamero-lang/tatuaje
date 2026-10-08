"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAdminAction } from "@/lib/client/useAdmin";

export function AdminUserActions({ userId, isSelf, role, banned }: { userId: string; isSelf: boolean; role: "user" | "admin"; banned: boolean }) {
  const { busy, msg, run } = useAdminAction();
  const router = useRouter();
  const [amount, setAmount] = useState("5");
  const url = `/api/admin/users/${userId}`;
  const post = (json: unknown, ok: string) => run(url, { method: "POST", json }, ok);

  return (
    <section aria-labelledby="acc" className="grid gap-6">
      <h2 id="acc" className="text-2xl">Acciones</h2>
      <form
        className="flex flex-wrap items-end gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          void post({ action: "credits", amount: Number(amount) }, "Créditos actualizados");
        }}
      >
        <div className="field">
          <label htmlFor="amount">Regalar o quitar créditos</label>
          <input id="amount" type="number" step={1} className="input w-40" value={amount} onChange={(e) => setAmount(e.target.value)} />
          <p className="hint">Negativo para quitar. Queda en el registro.</p>
        </div>
        <button className="btn btn-primary" disabled={busy || !Number.isInteger(Number(amount)) || Number(amount) === 0}>Aplicar</button>
      </form>
      <div className="flex flex-wrap gap-3">
        {!isSelf && (banned
          ? <button className="btn btn-ghost" disabled={busy} onClick={() => post({ action: "unban" }, "Usuario desbloqueado")}>Desbloquear</button>
          : <button className="btn btn-ghost" disabled={busy || role === "admin"} onClick={() => window.confirm("Se cerrará su sesión y no podrá volver a entrar. ¿Seguro?") && post({ action: "ban" }, "Usuario bloqueado")}>Bloquear</button>)}
        {!isSelf && (
          <button className="btn btn-ghost" disabled={busy} onClick={() => window.confirm(role === "admin" ? "Quitar el rol de administrador a este usuario?" : "Dar permisos de administrador a este usuario? Podrá ver todo y gestionar usuarios y precios.") && post({ action: "role", role: role === "admin" ? "user" : "admin" }, "Rol actualizado")}>
            {role === "admin" ? "Quitar rol de administrador" : "Hacer administrador"}
          </button>
        )}
        <button className="btn btn-ghost" disabled={busy} onClick={() => window.confirm("Se borrarán todas las fotos y resultados de este usuario. ¿Seguro?") && post({ action: "purge_photos" }, "Fotos borradas")}>Borrar sus fotos</button>
        {!isSelf && (
          <button
            className="btn btn-ghost text-danger"
            disabled={busy || role === "admin"}
            onClick={async () => {
              if (window.confirm("Se borrará la cuenta y todas sus fotos. No se puede deshacer. ¿Seguro?") && (await post({ action: "delete" }, "Cuenta borrada"))) router.push("/admin/usuarios");
            }}
          >
            Borrar cuenta
          </button>
        )}
      </div>
      {msg && <p role="status" className={`notice ${msg.ok ? "ok" : "error"}`}>{msg.text}</p>}
    </section>
  );
}
