"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Antebrazo ilustrado con un tatuaje que se traza en violeta de stencil y se asienta como tinta.
 * Un deslizador compara la piel limpia con el resultado. Es la pieza central del hero.
 */
const TATTOO = (
  <g transform="translate(575 290) scale(1.35) translate(-410 -236)" fill="none" strokeLinecap="round" strokeLinejoin="round" stroke="#a58bff" strokeWidth="2.6">
    <circle className="draw" pathLength={1} cx="410" cy="236" r="74" />
    <circle className="draw late" pathLength={1} cx="410" cy="236" r="58" strokeWidth="1.4" />
    <path className="draw" pathLength={1} d="M300 372 L372 276 L412 330 L452 288 L536 372" />
    <path className="draw late" pathLength={1} d="M334 372 L372 322 L398 354" strokeWidth="1.6" />
    <path className="draw" pathLength={1} d="M470 372 L500 330" strokeWidth="1.6" />
    <path className="draw late" pathLength={1} d="M326 200 Q 410 120 494 200" strokeDasharray="0.01 0.04" strokeWidth="2" />
    <path className="draw" pathLength={1} d="M410 150 L410 322" strokeWidth="1" />
    <g strokeWidth="2">
      <path className="draw late" pathLength={1} d="M300 150 l8 0 M304 146 l0 8" />
      <path className="draw late" pathLength={1} d="M520 140 l8 0 M524 136 l0 8" />
      <path className="draw late" pathLength={1} d="M548 250 l6 0 M551 247 l0 6" />
    </g>
    <circle className="dot-in" cx="410" cy="236" r="5" fill="#a58bff" />
  </g>
);

function Arm({ withTattoo }: { withTattoo: boolean }) {
  const id = withTattoo ? "t" : "b";
  return (
    <svg viewBox="0 0 820 560" className="absolute inset-0 h-full w-full" role="img" aria-hidden={!withTattoo} preserveAspectRatio="xMidYMid slice">
      <defs>
        {/* Sombreado de cilindro: sombra arriba, luz en el tercio superior, sombra profunda abajo */}
        <linearGradient id={`skin-${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#8d5a3f" />
          <stop offset=".18" stopColor="#c28865" />
          <stop offset=".38" stopColor="#dca988" />
          <stop offset=".62" stopColor="#c58e6b" />
          <stop offset=".88" stopColor="#92603f" />
          <stop offset="1" stopColor="#6d4430" />
        </linearGradient>
        <radialGradient id={`light-${id}`} cx=".34" cy=".3" r=".6">
          <stop offset="0" stopColor="#fff2e6" stopOpacity=".28" />
          <stop offset="1" stopColor="#fff2e6" stopOpacity="0" />
        </radialGradient>
        <linearGradient id={`edge-${id}`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#000" stopOpacity=".28" />
          <stop offset=".12" stopColor="#000" stopOpacity="0" />
          <stop offset=".9" stopColor="#000" stopOpacity="0" />
          <stop offset="1" stopColor="#000" stopOpacity=".22" />
        </linearGradient>
        <filter id={`pores-${id}`}>
          <feTurbulence type="fractalNoise" baseFrequency="1.1" numOctaves="2" seed="4" />
          <feColorMatrix values="0 0 0 0 .3  0 0 0 0 .18  0 0 0 0 .1  0 0 0 .3 0" />
        </filter>
      </defs>
      <rect width="820" height="560" fill={`url(#skin-${id})`} />
      <rect width="820" height="560" filter={`url(#pores-${id})`} />
      <rect width="820" height="560" fill={`url(#light-${id})`} />
      <rect width="820" height="560" fill={`url(#edge-${id})`} />
      <path d="M-10 190 C 160 168, 300 176, 470 188" stroke="#7d4c32" strokeOpacity=".14" strokeWidth="14" fill="none" strokeLinecap="round" />
      {withTattoo && <g style={{ mixBlendMode: "multiply" }}>{TATTOO}</g>}
    </svg>
  );
}

export function HeroSkin() {
  const [pos, setPos] = useState(100);
  const [touched, setTouched] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);

  // Una sola vez, tras dibujarse el trazo, el deslizador barre para mostrar que se puede mover.
  useEffect(() => {
    if (touched || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      if (!touched) setPos(38);
      return;
    }
    let raf = 0;
    const start = performance.now() + 4200;
    const tick = (t: number) => {
      if (t < start) {
        raf = requestAnimationFrame(tick);
        return;
      }
      const k = Math.min(1, (t - start) / 1400);
      setPos(100 - 62 * (1 - Math.pow(1 - k, 3)));
      if (k < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [touched]);

  const move = useCallback((clientX: number) => {
    const r = box.current?.getBoundingClientRect();
    if (!r) return;
    setPos(Math.min(100, Math.max(0, ((clientX - r.left) / r.width) * 100)));
  }, []);

  return (
    <div
      ref={box}
      className="relative aspect-[41/28] w-full touch-pan-y select-none overflow-hidden rounded-[10px] border border-line"
      onPointerDown={(e) => {
        dragging.current = true;
        setTouched(true);
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
        move(e.clientX);
      }}
      onPointerMove={(e) => dragging.current && move(e.clientX)}
      onPointerUp={() => (dragging.current = false)}
      onPointerCancel={() => (dragging.current = false)}
    >
      <Arm withTattoo={false} />
      <div className="absolute inset-0" style={{ clipPath: `inset(0 0 0 ${pos}%)` }}>
        <Arm withTattoo />
      </div>
      <div className="pointer-events-none absolute inset-y-0 w-px bg-bone/80" style={{ left: `${pos}%` }} />
      <button
        type="button"
        role="slider"
        aria-label="Comparar antes y después"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(pos)}
        className="absolute top-1/2 grid h-11 w-11 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border border-bone/80 bg-ink/80 text-bone backdrop-blur"
        style={{ left: `${pos}%` }}
        onKeyDown={(e) => {
          setTouched(true);
          if (e.key === "ArrowLeft") setPos((p) => Math.max(0, p - 5));
          if (e.key === "ArrowRight") setPos((p) => Math.min(100, p + 5));
        }}
      >
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
          <path d="M6 4 L2 9 L6 14 M12 4 L16 9 L12 14" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      <span className="pointer-events-none absolute bottom-3 left-3 rounded bg-ink/70 px-2 py-1 text-xs font-semibold backdrop-blur">Antes</span>
      <span className="pointer-events-none absolute bottom-3 right-3 rounded bg-ink/70 px-2 py-1 text-xs font-semibold backdrop-blur">Después</span>
    </div>
  );
}
