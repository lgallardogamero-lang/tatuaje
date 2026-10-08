"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { OPEN_COOKIES_EVENT, readConsent, saveConsent } from "@/lib/consent";
import { Modal } from "./Modal";

/**
 * Aviso de cookies con "Aceptar" y "Rechazar" al mismo nivel, y un panel para elegir por categoría.
 * Ahora mismo la web solo usa cookies necesarias; los interruptores de analítica y marketing no cargan nada todavía
 * pero la decisión queda registrada para cuando se añada.
 */
export function CookieConsent() {
  const [show, setShow] = useState(false);
  const [panel, setPanel] = useState(false);
  const [analytics, setAnalytics] = useState(false);
  const [marketing, setMarketing] = useState(false);

  useEffect(() => {
    const c = readConsent();
    if (c) {
      setAnalytics(c.analytics);
      setMarketing(c.marketing);
    } else setShow(true);
    const open = () => {
      const cur = readConsent();
      setAnalytics(cur?.analytics ?? false);
      setMarketing(cur?.marketing ?? false);
      setPanel(true);
    };
    window.addEventListener(OPEN_COOKIES_EVENT, open);
    return () => window.removeEventListener(OPEN_COOKIES_EVENT, open);
  }, []);

  const choose = (a: boolean, m: boolean) => {
    saveConsent({ analytics: a, marketing: m });
    setShow(false);
    setPanel(false);
  };

  return (
    <>
      {show && !panel && (
        <section aria-label="Aviso de cookies" className="fixed inset-x-3 bottom-3 z-[90] mx-auto grid max-w-3xl gap-4 rounded-[12px] border border-line bg-panel-2 p-5 shadow-2xl sm:p-6">
          <div>
            <p className="font-semibold">Cookies</p>
            <p className="mt-1 text-[0.95rem] text-bone/80">
              Usamos solo cookies necesarias para que funcione el acceso y evitar abusos. Si algún día añadimos analítica, solo la activaremos si lo aceptas. Más en la{" "}
              <Link className="link" href="/cookies">política de cookies</Link>.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <button className="btn btn-ghost" onClick={() => choose(false, false)}>Rechazar las no necesarias</button>
            <button className="btn btn-ghost" onClick={() => choose(true, true)}>Aceptar todas</button>
            <button className="btn btn-quiet" onClick={() => setPanel(true)}>Configurar</button>
          </div>
        </section>
      )}
      <Modal open={panel} onClose={() => setPanel(false)} title="Preferencias de cookies">
        <ul className="grid gap-4">
          <li className="grid gap-1">
            <label className="flex items-center justify-between gap-4 font-semibold">
              Necesarias
              <input type="checkbox" checked disabled className="h-5 w-5 accent-[#a58bff]" aria-label="Cookies necesarias, siempre activas" />
            </label>
            <p className="hint">Sesión, dispositivo contra abusos y estas mismas preferencias. No se pueden desactivar.</p>
          </li>
          <li className="grid gap-1">
            <label className="flex items-center justify-between gap-4 font-semibold">
              Analítica
              <input type="checkbox" checked={analytics} onChange={(e) => setAnalytics(e.target.checked)} className="h-5 w-5 accent-[#a58bff]" />
            </label>
            <p className="hint">Medir qué se usa para mejorar el producto. Hoy no hay ninguna activa.</p>
          </li>
          <li className="grid gap-1">
            <label className="flex items-center justify-between gap-4 font-semibold">
              Marketing
              <input type="checkbox" checked={marketing} onChange={(e) => setMarketing(e.target.checked)} className="h-5 w-5 accent-[#a58bff]" />
            </label>
            <p className="hint">Publicidad personalizada. Hoy no hay ninguna activa y Calco no tiene anuncios.</p>
          </li>
        </ul>
        <div className="flex flex-wrap gap-3">
          <button className="btn btn-primary" onClick={() => choose(analytics, marketing)}>Guardar mi elección</button>
          <button className="btn btn-ghost" onClick={() => choose(false, false)}>Rechazar las no necesarias</button>
        </div>
      </Modal>
    </>
  );
}
