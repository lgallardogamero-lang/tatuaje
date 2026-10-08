"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { STYLES, eur } from "@/lib/config";
import { usePricing } from "@/lib/client/usePricing";
import { api, ApiError } from "@/lib/client/api";
import { downloadBlob, makeStencil, toPngBlob, withLogo } from "@/lib/client/image";
import { CompareSlider } from "./CompareSlider";
import { Paywall } from "./Paywall";

interface JobData {
  id: string;
  status: "queued" | "running" | "done" | "failed" | "cancelled";
  progress: number;
  stage: string | null;
  error: string | null;
  expiresAt: number;
  options: { zone: string; style: string; color: string; description: string };
  variants: number;
  hasOriginal: boolean;
  entitlements: string[];
  studio: { name: string; accent: string; hasLogo: boolean } | null;
}

const MESSAGES = ["Preparando la piel", "Dibujando el diseño", "Calcando el stencil", "Tatuando la piel", "Asentando la tinta", "Revelando el resultado"];

export function JobView({ id }: { id: string }) {
  const router = useRouter();
  const sp = useSearchParams();
  const [job, setJob] = useState<JobData | null>(null);
  const [error, setError] = useState("");
  const [variant, setVariant] = useState(0);
  const [busy, setBusy] = useState<string | null>(null);
  const [paywall, setPaywall] = useState(false);
  const [notice, setNotice] = useState("");
  const [consent, setConsent] = useState(false);
  const [msgIdx, setMsgIdx] = useState(0);
  const failures = useRef(0);
  const { assets: ASSET_PRODUCTS } = usePricing();

  const load = useCallback(async () => {
    try {
      const j = await api<JobData>(`/api/jobs/${id}`);
      failures.current = 0;
      setJob(j);
      setError("");
      return j;
    } catch (e) {
      failures.current++;
      if (e instanceof ApiError && e.status === 404) setError("No encontramos esta prueba. Puede haber caducado.");
      else if (failures.current > 3) setError(e instanceof ApiError ? e.message : "Se ha perdido la conexión");
      return null;
    }
  }, [id]);

  // Sondeo mientras el trabajo está en curso
  useEffect(() => {
    let stop = false;
    let timer: ReturnType<typeof setTimeout>;
    const tick = async () => {
      const j = await load();
      if (stop) return;
      if (!j || j.status === "queued" || j.status === "running") timer = setTimeout(tick, 1200 + Math.min(failures.current, 5) * 1000);
    };
    void tick();
    return () => {
      stop = true;
      clearTimeout(timer);
    };
  }, [load]);

  useEffect(() => {
    if (job?.status !== "queued" && job?.status !== "running") return;
    const t = setInterval(() => setMsgIdx((i) => (i + 1) % MESSAGES.length), 2600);
    return () => clearInterval(t);
  }, [job?.status]);

  useEffect(() => {
    if (sp.get("pago") === "ok") setNotice("Pago recibido. Tus créditos o tu descarga se actualizan en unos segundos.");
  }, [sp]);

  async function action<T>(key: string, fn: () => Promise<T>) {
    setBusy(key);
    setError("");
    try {
      return await fn();
    } catch (e) {
      if (e instanceof ApiError && e.status === 402) setPaywall(true);
      else setError(e instanceof Error ? e.message : "Algo ha fallado");
    } finally {
      setBusy(null);
    }
  }

  const cancel = () => action("cancel", async () => {
    await api(`/api/jobs/${id}/cancel`, { method: "POST" });
    await load();
  });

  const regenerate = () => action("regen", async () => {
    const r = await api<{ id: string }>(`/api/jobs/${id}/regenerate`, { method: "POST" });
    router.push(`/crear/${r.id}`);
  });

  const unlock = (kind: "hd" | "stencil", method: "credits" | "card") => action(`unlock-${kind}`, async () => {
    const r = await api<{ url?: string }>(`/api/jobs/${id}/unlock`, { method: "POST", json: { kind, method, withdrawalConsent: method === "card" ? consent : undefined } });
    if (r.url) window.location.href = r.url;
    else {
      await load();
      setNotice(kind === "hd" ? "Listo: ya puedes descargar sin marca de agua." : "Listo: ya puedes descargar el diseño y el stencil.");
    }
  });

  const download = (what: "variant" | "design" | "stencil") => action(`dl-${what}`, async () => {
    if (what === "variant") {
      let png = await toPngBlob(`/api/jobs/${id}/files/variant-${variant}`);
      if (job?.studio?.hasLogo) png = await withLogo(png, `/api/jobs/${id}/studio`).catch(() => png); // marca blanca: el logo del estudio en la imagen que se lleva el cliente
      downloadBlob(png, `calco-tatuaje-${variant + 1}.png`);
    }
    else if (what === "design") downloadBlob(await toPngBlob(`/api/jobs/${id}/files/design`), "calco-diseno.png");
    else downloadBlob(await makeStencil(`/api/jobs/${id}/files/design`), "calco-stencil.png");
  });

  if (error && !job) {
    return (
      <div className="wrap grid max-w-2xl gap-5 py-16">
        <p role="alert" className="notice error">{error}</p>
        <Link href="/crear" className="btn btn-primary justify-self-start">Probar otro tatuaje</Link>
      </div>
    );
  }
  if (!job) {
    return (
      <div className="wrap max-w-3xl py-16" aria-busy="true" aria-label="Cargando">
        <div className="skeleton h-12 w-2/3" />
        <div className="skeleton mt-8 h-80 w-full" />
      </div>
    );
  }

  const styleLabel = STYLES.find((s) => s.id === job.options.style)?.label ?? job.options.style;
  const hd = job.entitlements.includes("hd");
  const stencil = job.entitlements.includes("stencil");
  const hoursLeft = Math.max(0, Math.round((job.expiresAt - Date.now()) / 3600_000));

  return (
    <div className="wrap max-w-5xl py-10 sm:py-14" style={job.studio ? ({ "--color-stencil": job.studio.accent } as React.CSSProperties) : undefined}>
      <Paywall open={paywall} onClose={() => setPaywall(false)} />
      {job.studio && (
        <p className="mb-6 flex items-center gap-3 text-bone/85" data-testid="studio-brand">
          {job.studio.hasLogo && /* eslint-disable-next-line @next/next/no-img-element */ <img src={`/api/jobs/${id}/studio`} alt={`Logo de ${job.studio.name}`} className="h-9 w-auto max-w-40 rounded-sm object-contain" />}
          <span className="font-semibold">{job.studio.name}</span>
        </p>
      )}

      {(job.status === "queued" || job.status === "running") && (
        <div className="grid justify-items-center gap-8 py-10 text-center" role="status" aria-live="polite">
          <InkRun />
          <div className="grid gap-2">
            <h1 className="text-[clamp(2rem,4.5vw,3.2rem)]">{MESSAGES[msgIdx]}…</h1>
            <p className="text-bone/75">{job.stage ?? "En cola"}. Suele tardar menos de un minuto.</p>
          </div>
          <div className="h-1.5 w-full max-w-sm overflow-hidden rounded-full bg-line" aria-hidden="true">
            <div className="h-full rounded-full bg-stencil transition-[width] duration-700" style={{ width: `${Math.max(6, job.progress)}%` }} />
          </div>
          <button className="btn btn-ghost" disabled={busy === "cancel"} onClick={cancel}>Cancelar y recuperar el crédito</button>
        </div>
      )}

      {job.status === "failed" && (
        <div className="grid max-w-2xl gap-5 py-6">
          <h1 className="text-[clamp(2rem,4.5vw,3.2rem)]">No hemos podido generarlo</h1>
          <p className="notice error" role="alert">{job.error ?? "Algo ha fallado."}</p>
          <div className="flex flex-wrap gap-3">
            <button className="btn btn-primary" disabled={busy === "regen"} onClick={regenerate}>Volver a intentarlo</button>
            <Link href="/crear" className="btn btn-ghost">Empezar de nuevo</Link>
          </div>
        </div>
      )}

      {job.status === "cancelled" && (
        <div className="grid max-w-2xl gap-5 py-6">
          <h1 className="text-[clamp(2rem,4.5vw,3.2rem)]">Prueba cancelada</h1>
          <p className="text-bone/80">Te hemos devuelto el crédito.</p>
          <div className="flex flex-wrap gap-3">
            <button className="btn btn-primary" disabled={busy === "regen"} onClick={regenerate}>Volver a generarla</button>
            <Link href="/crear" className="btn btn-ghost">Empezar de nuevo</Link>
          </div>
        </div>
      )}

      {job.status === "done" && (
        <div className="grid gap-8">
          <div>
            <h1 className="text-[clamp(2rem,4.5vw,3.4rem)]">Así te queda</h1>
            <p className="mt-2 text-bone/75">{styleLabel}, {job.options.color === "bw" ? "blanco y negro" : "color"}. Desliza para comparar con tu foto original.</p>
          </div>

          {job.variants > 1 && (
            <div role="tablist" aria-label="Variantes" className="flex gap-2">
              {Array.from({ length: job.variants }, (_, i) => (
                <button key={i} role="tab" aria-selected={variant === i} className="chip" aria-pressed={variant === i} onClick={() => setVariant(i)}>
                  Variante {i + 1}
                </button>
              ))}
            </div>
          )}

          <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,19rem)]">
            <CompareSlider key={`${variant}-${hd}`} before={job.hasOriginal ? `/api/jobs/${id}/files/original` : undefined} after={`/api/jobs/${id}/files/variant-${variant}${hd ? "?hd=1" : ""}`} />
            <div className="grid gap-5">
              <button className="btn btn-primary" disabled={busy === "dl-variant"} onClick={() => download("variant")}>
                {busy === "dl-variant" ? "Preparando…" : hd ? "Descargar en alta resolución" : "Descargar con marca de agua"}
              </button>
              {!hd && (
                <div className="panel grid gap-3 p-4">
                  <p className="font-semibold">Quita la marca de agua</p>
                  <div className="flex flex-wrap gap-2">
                    <button className="btn btn-ghost btn-sm" disabled={busy === "unlock-hd"} onClick={() => unlock("hd", "credits")}>{ASSET_PRODUCTS.hd.credits} créditos</button>
                    <button className="btn btn-ghost btn-sm" disabled={busy === "unlock-hd" || !consent} onClick={() => unlock("hd", "card")}>{eur(ASSET_PRODUCTS.hd.priceCents)} con tarjeta</button>
                  </div>
                </div>
              )}
              <hr className="rule" />
              <p className="font-semibold">Para llevar a tu tatuador</p>
              <button className="btn btn-ghost" disabled={busy === "dl-design"} onClick={() => download("design")}>Descargar el diseño</button>
              {stencil ? (
                <button className="btn btn-ghost" disabled={busy === "dl-stencil"} onClick={() => download("stencil")}>Descargar el stencil</button>
              ) : (
                <div className="panel grid gap-3 p-4">
                  <p className="text-sm text-bone/80">El diseño en limpio y el stencil listo para imprimir.</p>
                  <div className="flex flex-wrap gap-2">
                    <button className="btn btn-ghost btn-sm" disabled={busy === "unlock-stencil"} onClick={() => unlock("stencil", "credits")}>{ASSET_PRODUCTS.stencil.credits} créditos</button>
                    <button className="btn btn-ghost btn-sm" disabled={busy === "unlock-stencil" || !consent} onClick={() => unlock("stencil", "card")}>{eur(ASSET_PRODUCTS.stencil.priceCents)} con tarjeta</button>
                  </div>
                </div>
              )}
              {!(hd && stencil) && (
                <label className="flex items-start gap-3 text-[0.85rem] text-bone/75">
                  <input type="checkbox" className="mt-0.5 h-5 w-5 shrink-0 accent-[#a58bff]" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
                  <span>Para pagar con tarjeta: acepto que el contenido digital se entregue al instante y pierdo el derecho de desistimiento de 14 días.</span>
                </label>
              )}
              <hr className="rule" />
              <button className="btn btn-ghost" disabled={busy === "regen"} onClick={regenerate}>Regenerar (1 crédito)</button>
              <Link href={`/directorio?prueba=${id}`} className="btn btn-ghost">Encontrar un estudio</Link>
              <Link href="/crear" className="btn btn-quiet justify-self-start">Probar otro tatuaje</Link>
            </div>
          </div>

          {notice && <p role="status" className="notice ok">{notice}</p>}
          {error && <p role="alert" className="notice error">{error}</p>}
          <p className="hint max-w-[70ch]">
            Simulación orientativa: el resultado real depende del tatuador. {hoursLeft > 30 ? `Tus resultados comprados se guardan ${Math.round(hoursLeft / 24)} días.` : `Tus fotos y resultados se borran en ${hoursLeft} h.`}{" "}
            <Link className="link" href="/cuenta">Borrar ahora</Link>
          </p>
        </div>
      )}
    </div>
  );
}

/** Animación de espera: un trazo de tinta que se dibuja sobre una piel estilizada. */
function InkRun() {
  return (
    <svg width="220" height="140" viewBox="0 0 220 140" fill="none" aria-hidden="true">
      <rect x="6" y="10" width="208" height="120" rx="14" fill="#c98f6b" opacity=".9" />
      <rect x="6" y="10" width="208" height="120" rx="14" fill="url(#g)" />
      <defs>
        <linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#000" stopOpacity=".28" />
          <stop offset=".4" stopColor="#fff" stopOpacity=".16" />
          <stop offset="1" stopColor="#000" stopOpacity=".35" />
        </linearGradient>
      </defs>
      <g stroke="#1b1830" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
        <path className="ink-run" pathLength={1} d="M40 100 L84 40 L110 78 L136 52 L180 100" />
        <circle className="ink-run" pathLength={1} cx="110" cy="62" r="30" style={{ animationDelay: ".4s" }} />
      </g>
    </svg>
  );
}
