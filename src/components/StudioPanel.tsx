"use client";

import { useState } from "react";
import { STUDIO_PLANS, STYLES, eur } from "@/lib/config";
import { api, ApiError } from "@/lib/client/api";
import type { Overview } from "@/lib/studio";
import { useAdminAction } from "@/lib/client/useAdmin";
import { dateTime } from "@/lib/format";

const fmt = dateTime;

export function StudioPanel({ data, isOwner, selfId, shareUrl }: { data: Overview; isOwner: boolean; selfId: string; shareUrl: string }) {
  const { busy, msg, run } = useAdminAction();
  const [email, setEmail] = useState("");
  const [profile, setProfile] = useState({ city: data.org.city, contactEmail: data.org.contact_email ?? "", instagram: data.org.instagram ?? "" });
  const [flashName, setFlashName] = useState("");
  const [flashStyle, setFlashStyle] = useState("");
  const [listed, setListed] = useState(data.org.listed);
  const [color, setColor] = useState(data.org.accent_color);
  const [logoVer, setLogoVer] = useState(0);
  const [copied, setCopied] = useState(false);
  const [consent, setConsent] = useState(false);
  const [payError, setPayError] = useState("");
  async function pay(url: string, json?: unknown) {
    setPayError("");
    try {
      const r = await api<{ url: string }>(url, { method: "POST", json });
      window.location.href = r.url;
    } catch (e) {
      setPayError(e instanceof ApiError ? e.message : "No se pudo iniciar el pago");
    }
  }
  const pct = data.org.quota > 0 ? Math.min(100, Math.round((data.org.used / data.org.quota) * 100)) : 0;

  async function uploadFlash(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const file = (form.elements.namedItem("file") as HTMLInputElement).files?.[0];
    if (!file) return;
    const fd = new FormData();
    fd.set("file", file);
    fd.set("name", flashName);
    if (flashStyle) fd.set("style", flashStyle);
    // reutiliza useAdminAction con un cuerpo FormData
    const ok = await run("/api/studio/flash", { method: "POST", body: fd } as never, "Diseño añadido al catálogo");
    if (ok) {
      setFlashName("");
      form.reset();
    }
  }

  return (
    <div className="grid gap-12">
      {msg && <p role="status" className={`notice ${msg.ok ? "ok" : "error"}`}>{msg.text}</p>}

      {data.org.listed && data.org.active && (
        <section aria-labelledby="enlace" className="grid gap-3">
          <h2 id="enlace" className="text-2xl">Tu página para clientes</h2>
          <p className="measure text-bone/75">Compártela en Instagram, en tu web o en un QR del mostrador. Tus clientes ven tu marca, prueban un tatuaje y te escriben desde ahí.</p>
          <div className="flex flex-wrap items-center gap-3">
            <input readOnly aria-label="Enlace de tu página" className="input max-w-lg" value={shareUrl} onFocus={(e) => e.currentTarget.select()} />
            <button type="button" className="btn btn-ghost" onClick={() => navigator.clipboard?.writeText(shareUrl).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2500); })}>{copied ? "Enlace copiado" : "Copiar enlace"}</button>
          </div>
        </section>
      )}

      {isOwner && (
        <section aria-labelledby="plan" className="grid gap-4">
          <h2 id="plan" className="text-2xl">Tu plan</h2>
          {data.org.active ? (
            <>
              <p className="text-bone/80">Plan <strong>{STUDIO_PLANS[data.org.plan as keyof typeof STUDIO_PLANS]?.label ?? data.org.plan}</strong> activo, con {data.org.quota} generaciones al mes.{data.org.billing === "manual" ? " Lo ha activado Calco directamente." : ""}</p>
              {data.org.billing === "stripe" && <button className="btn btn-ghost w-fit" onClick={() => pay("/api/studio/portal")}>Gestionar suscripción y facturas</button>}
            </>
          ) : (
            <>
              <p className="text-bone/80">{data.org.subscription_status === "past_due" ? "No hemos podido cobrar tu última cuota. Actualiza la tarjeta para reactivar el plan." : "Elige un plan para usar el modo estudio con tus clientes. Se cobra cada mes y puedes cancelar cuando quieras."}</p>
              {data.org.billing === "stripe" && <button className="btn btn-primary w-fit" onClick={() => pay("/api/studio/portal")}>Actualizar el método de pago</button>}
              <label className="flex items-start gap-3 text-[0.9rem] text-bone/80">
                <input type="checkbox" className="mt-1 h-5 w-5 shrink-0 accent-[#a58bff]" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
                <span>Quiero que el servicio empiece ya y entiendo que pierdo el derecho de desistimiento de 14 días sobre el periodo ya prestado.</span>
              </label>
              <ul className="grid gap-3 sm:grid-cols-3">
                {Object.entries(STUDIO_PLANS).map(([id, p]) => (
                  <li key={id} className="panel grid gap-2 p-4">
                    <h3 className="text-xl">{p.label}</h3>
                    <p><span className="display text-3xl">{eur(p.priceCents)}</span> <span className="text-mute">/mes</span></p>
                    <p className="hint">{p.quota} generaciones al mes</p>
                    <button className="btn btn-primary btn-sm" disabled={!consent} onClick={() => pay("/api/studio/subscribe", { plan: id, withdrawalConsent: consent })}>Contratar {p.label}</button>
                  </li>
                ))}
              </ul>
              {payError && <p role="alert" className="notice error">{payError}</p>}
            </>
          )}
        </section>
      )}

      <section aria-labelledby="uso" className="grid gap-3">
        <h2 id="uso" className="text-2xl">Uso de este mes</h2>
        <p className="text-bone/80"><span className="display text-4xl text-stencil">{data.org.used}</span> de {data.org.quota} generaciones</p>
        <div className="h-2 max-w-md overflow-hidden rounded-full bg-line" role="img" aria-label={`${pct}% del cupo mensual usado`}>
          <div className="h-full rounded-full bg-stencil" style={{ width: `${pct}%` }} />
        </div>
        <p className="hint">Cada prueba con un cliente cuenta una generación y sale sin marca de agua, con el diseño y el stencil incluidos. Las fotos se borran a las 24 horas.</p>
      </section>

      <section aria-labelledby="flash" className="grid gap-4">
        <h2 id="flash" className="text-2xl">Catálogo de flash <span className="text-mute">({data.flash.length})</span></h2>
        <p className="measure text-bone/75">Sube los diseños de tu estudio y el cliente los prueba directamente sobre su piel, sin esperar a la IA.</p>
        <form onSubmit={uploadFlash} className="panel grid gap-4 p-5 sm:grid-cols-[1fr_12rem_auto] sm:items-end">
          <div className="field"><label htmlFor="fl-name">Nombre del diseño</label><input id="fl-name" className="input" required maxLength={60} value={flashName} onChange={(e) => setFlashName(e.target.value)} /></div>
          <div className="field">
            <label htmlFor="fl-style">Estilo</label>
            <select id="fl-style" className="select" value={flashStyle} onChange={(e) => setFlashStyle(e.target.value)}>
              <option value="">Sin indicar</option>
              {STYLES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
            </select>
          </div>
          <div className="field sm:col-span-2"><label htmlFor="fl-file">Imagen (JPG, PNG o WEBP, mejor sobre fondo blanco)</label><input id="fl-file" name="file" type="file" accept="image/jpeg,image/png,image/webp" required className="input pt-2.5" /></div>
          <button className="btn btn-primary" disabled={busy}>Añadir al catálogo</button>
        </form>
        {data.flash.length > 0 && (
          <ul className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {data.flash.map((f) => (
              <li key={f.id} className="grid gap-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={`/api/studio/flash/${f.id}/image`} alt={f.name} className="aspect-square w-full rounded-[10px] border border-line bg-white object-contain" />
                <p className="text-sm font-semibold">{f.name}</p>
                <p className="hint">{f.tried_count} {f.tried_count === 1 ? "prueba" : "pruebas"}</p>
                <button className="btn btn-quiet justify-self-start text-danger" disabled={busy} onClick={() => window.confirm(`Quitar «${f.name}» del catálogo?`) && run(`/api/studio/flash/${f.id}`, { method: "DELETE" }, "Diseño quitado")}>Quitar</button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="equipo" className="grid gap-4">
        <h2 id="equipo" className="text-2xl">Equipo</h2>
        <ul className="divide-y divide-line border-y border-line">
          {data.members.map((m) => (
            <li key={m.user_id} className="flex items-center justify-between gap-4 py-3">
              <span>{m.email}<span className="hint block">{m.role === "owner" ? "Responsable" : "Tatuador"}</span></span>
              {isOwner && m.role !== "owner" && m.user_id !== selfId && (
                <button className="btn btn-quiet text-danger" disabled={busy} onClick={() => window.confirm(`Quitar a ${m.email} del estudio?`) && run(`/api/studio/members/${m.user_id}`, { method: "DELETE" }, "Persona quitada del estudio")}>Quitar</button>
              )}
            </li>
          ))}
        </ul>
        {isOwner && (
          <form className="flex flex-wrap items-end gap-3" onSubmit={async (e) => { e.preventDefault(); if (await run("/api/studio/members", { method: "POST", json: { email } }, "Tatuador añadido")) setEmail(""); }}>
            <div className="field"><label htmlFor="mem">Añadir un tatuador por email</label><input id="mem" type="email" className="input w-72 max-w-full" required value={email} onChange={(e) => setEmail(e.target.value)} /><p className="hint">Debe tener ya una cuenta en Calco.</p></div>
            <button className="btn btn-ghost" disabled={busy}>Añadir tatuador</button>
          </form>
        )}
      </section>

      {isOwner && (
        <section aria-labelledby="perfil" className="grid gap-4">
          <h2 id="perfil" className="text-2xl">Datos y directorio</h2>
          <form className="grid max-w-xl gap-4" onSubmit={(e) => { e.preventDefault(); void run("/api/studio", { method: "PATCH", json: profile }, "Datos guardados"); }}>
            <div className="field"><label htmlFor="p-city">Ciudad</label><input id="p-city" className="input" value={profile.city} onChange={(e) => setProfile({ ...profile, city: e.target.value })} /></div>
            <div className="field"><label htmlFor="p-mail">Email de contacto (público en el directorio)</label><input id="p-mail" type="email" className="input" value={profile.contactEmail} onChange={(e) => setProfile({ ...profile, contactEmail: e.target.value })} /></div>
            <div className="field"><label htmlFor="p-ig">Instagram</label><input id="p-ig" className="input" placeholder="tuestudio" value={profile.instagram} onChange={(e) => setProfile({ ...profile, instagram: e.target.value })} /></div>
            <div><button className="btn btn-primary" disabled={busy}>Guardar datos</button></div>
          </form>
          <div className="grid max-w-xl gap-4" role="group" aria-labelledby="marca">
            <h3 id="marca" className="text-xl">Marca del estudio</h3>
            <p className="hint">Tu logo y tu color aparecen en los resultados que ven tus clientes y en las imágenes que descargan.</p>
            <div className="flex flex-wrap items-end gap-3">
              <div className="field">
                <label htmlFor="b-color">Color de marca</label>
                <div className="flex gap-2">
                  <input id="b-color-pick" type="color" aria-label="Elegir color" className="h-12 w-14 cursor-pointer rounded-md border border-line bg-panel p-1" value={color} onChange={(e) => setColor(e.target.value)} />
                  <input id="b-color" className="input w-32" value={color} maxLength={7} onChange={(e) => setColor(e.target.value)} />
                </div>
              </div>
              <button type="button" className="btn btn-ghost" disabled={busy} onClick={() => run("/api/studio", { method: "PATCH", json: { accentColor: color } }, "Color guardado")}>Guardar color</button>
            </div>
            <div className="flex flex-wrap items-center gap-4">
              {data.org.has_logo && /* eslint-disable-next-line @next/next/no-img-element */ <img src={`/api/studio/logo?v=${logoVer}`} alt={`Logo de ${data.org.name}`} className="h-14 w-auto max-w-48 rounded-md border border-line bg-panel object-contain p-1" />}
              <div className="field">
                <label htmlFor="b-logo">{data.org.has_logo ? "Cambiar el logo" : "Subir el logo"} (JPG, PNG o WEBP, máx. 1 MB)</label>
                <input id="b-logo" type="file" accept="image/jpeg,image/png,image/webp" className="input pt-2.5" onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  const fd = new FormData();
                  fd.set("file", file);
                  if (await run("/api/studio/logo", { method: "POST", body: fd } as never, "Logo guardado")) setLogoVer((v) => v + 1);
                  e.target.value = "";
                }} />
              </div>
              {data.org.has_logo && <button type="button" className="btn btn-quiet text-danger" disabled={busy} onClick={() => run("/api/studio/logo", { method: "DELETE" }, "Logo quitado")}>Quitar logo</button>}
            </div>
          </div>
          <label className="flex items-center gap-3">
            <input
              type="checkbox"
              className="h-5 w-5 accent-[#a58bff]"
              checked={listed}
              disabled={busy || (!data.org.active && !listed)}
              onChange={async (e) => {
                const v = e.target.checked;
                setListed(v); // cambio inmediato; se revierte si el servidor lo rechaza
                if (!(await run("/api/studio", { method: "PATCH", json: { listed: v } }, v ? "Ya apareces en el directorio" : "Has salido del directorio"))) setListed(!v);
              }}
            />
            Aparecer en el directorio de estudios de {data.org.city}
          </label>
        </section>
      )}

      <section aria-labelledby="contactos" className="grid gap-4">
        <h2 id="contactos" className="text-2xl">Solicitudes de clientes <span className="text-mute">({data.leadsTotal})</span></h2>
        {data.leads.length === 0 ? (
          <p className="text-bone/75">Cuando alguien te contacte desde el directorio, lo verás aquí con su email y su mensaje.</p>
        ) : (
          <ul className="divide-y divide-line border-y border-line">
            {data.leads.map((l) => (
              <li key={l.id} className="grid gap-1 py-3">
                <p><strong>{l.email}</strong> <span className="text-mute">· {l.kind === "booking" ? "Quiere reservar" : "Contacto"} · {fmt.format(l.created_at)}</span></p>
                {l.message && <p className="text-bone/80">{l.message}</p>}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
