"use client";

import { useEffect, useState } from "react";
import { api, ApiError } from "@/lib/client/api";

export function AuthForm({ showGoogle, compact = false, onSignedIn, turnstileSiteKey }: { showGoogle: boolean; compact?: boolean; onSignedIn?: () => void; turnstileSiteKey?: string }) {
  const [email, setEmail] = useState("");
  const [adult, setAdult] = useState(false);
  const [privacy, setPrivacy] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState<{ devLink?: string } | null>(null);
  const [token, setToken] = useState<string>();

  // Turnstile (solo si hay clave de sitio configurada)
  useEffect(() => {
    if (!turnstileSiteKey) return;
    (window as unknown as { __ts: (t: string) => void }).__ts = setToken;
    const s = document.createElement("script");
    s.src = "https://challenges.cloudflare.com/turnstile/v0/api.js";
    s.async = true;
    document.head.appendChild(s);
    return () => s.remove();
  }, [turnstileSiteKey]);

  // Si el enlace se abre en otra pestaña, esta detecta la sesión y continúa.
  useEffect(() => {
    if (!sent || !onSignedIn) return;
    const t = setInterval(async () => {
      try {
        const me = await api<{ user: unknown }>("/api/me");
        if (me.user) {
          clearInterval(t);
          onSignedIn();
        }
      } catch {}
    }, 2500);
    return () => clearInterval(t);
  }, [sent, onSignedIn]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      const r = await api<{ devLink?: string }>("/api/auth/request", { method: "POST", json: { email, adult, privacy, turnstileToken: token } });
      setSent({ devLink: r.devLink });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Algo ha fallado. Inténtalo de nuevo");
    } finally {
      setBusy(false);
    }
  }

  if (sent) {
    return (
      <div className="grid gap-4" role="status">
        <h2 className="text-3xl">Revisa tu correo</h2>
        <p className="text-bone/80">
          Te hemos enviado un enlace a <strong>{email}</strong>. Ábrelo para entrar. Caduca en 15 minutos.
          {onSignedIn ? " Puedes abrirlo en otra pestaña: esta continuará sola." : ""}
        </p>
        {sent.devLink && (
          <div className="notice">
            <p className="font-semibold">Modo desarrollo: no se envía ningún correo real.</p>
            <a className="link break-all" href={sent.devLink} target={onSignedIn ? "_blank" : undefined} rel="noreferrer" data-testid="dev-link">
              Abrir el enlace de acceso
            </a>
          </div>
        )}
        <button type="button" className="btn btn-quiet justify-self-start" onClick={() => setSent(null)}>
          Usar otro email
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="grid gap-5" noValidate>
      {!compact && <h1 className="text-[clamp(2rem,4vw,3rem)]">Entra para guardar tus pruebas</h1>}
      {showGoogle && (
        <>
          <a href="/api/auth/google" className="btn btn-ghost">Continuar con Google</a>
          <p className="hint text-center">o con tu email</p>
        </>
      )}
      <div className="field">
        <label htmlFor="email">Email</label>
        <input id="email" type="email" autoComplete="email" required className="input" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="tu@email.com" />
        <p className="hint">Te enviamos un enlace para entrar, sin contraseñas.</p>
      </div>
      <fieldset className="grid gap-3">
        <legend className="sr-only">Confirmaciones</legend>
        <label className="flex items-start gap-3 text-[0.95rem]">
          <input type="checkbox" className="mt-1 h-5 w-5 accent-[#a58bff]" checked={adult} onChange={(e) => setAdult(e.target.checked)} />
          Soy mayor de edad.
        </label>
        <label className="flex items-start gap-3 text-[0.95rem]">
          <input type="checkbox" className="mt-1 h-5 w-5 accent-[#a58bff]" checked={privacy} onChange={(e) => setPrivacy(e.target.checked)} />
          <span>
            He leído el <a className="link" href="/privacidad" target="_blank">aviso de privacidad</a> y acepto que mis fotos se procesen con IA y se borren a las 24 horas.
          </span>
        </label>
      </fieldset>
      {turnstileSiteKey && <div className="cf-turnstile" data-sitekey={turnstileSiteKey} data-callback="__ts" />}
      {error && <p className="notice error" role="alert">{error}</p>}
      <button className="btn btn-primary" disabled={busy || !email || !adult || !privacy}>
        {busy ? "Enviando…" : "Enviarme el enlace"}
      </button>
    </form>
  );
}
