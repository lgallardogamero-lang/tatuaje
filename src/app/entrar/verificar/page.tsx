"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { api, ApiError, safeNext } from "@/lib/client/api";

function Verify() {
  const sp = useSearchParams();
  const router = useRouter();
  const token = sp.get("token") ?? "";
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function go() {
    setBusy(true);
    setError("");
    try {
      await api("/api/auth/verify", { method: "POST", json: { token } });
      router.replace(safeNext(sp.get("next")));
      router.refresh();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Algo ha fallado");
      setBusy(false);
    }
  }

  return (
    <div className="wrap grid max-w-xl gap-6 py-16">
      <h1 className="text-[clamp(2rem,4vw,3rem)]">Ya casi estás dentro</h1>
      <p className="text-bone/80">Pulsa el botón para entrar en tu cuenta.</p>
      {error && <p className="notice error" role="alert">{error} <a className="link" href="/entrar">Pedir un enlace nuevo</a></p>}
      <button className="btn btn-primary justify-self-start" onClick={go} disabled={busy || !token}>
        {busy ? "Entrando…" : "Entrar"}
      </button>
    </div>
  );
}

export default function Page() {
  return (
    <Suspense>
      <Verify />
    </Suspense>
  );
}
