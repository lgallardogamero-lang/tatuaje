"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { api, ApiError } from "./api";

/** Ejecuta una acción de administración, muestra el resultado y refresca los datos de la página. */
export function useAdminAction() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  async function run(url: string, init: { method: string; json?: unknown }, okText: string) {
    setBusy(true);
    setMsg(null);
    try {
      await api(url, init);
      setMsg({ ok: true, text: okText });
      router.refresh();
      return true;
    } catch (e) {
      setMsg({ ok: false, text: e instanceof ApiError ? e.message : "Algo ha fallado" });
      return false;
    } finally {
      setBusy(false);
    }
  }
  return { busy, msg, run };
}
