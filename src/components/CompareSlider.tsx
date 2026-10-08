"use client";

import { useRef, useState } from "react";

/** Deslizador antes/después sobre dos imágenes del mismo encuadre. */
export function CompareSlider({ before, after, beforeLabel = "Antes", afterLabel = "Después" }: { before?: string; after: string; beforeLabel?: string; afterLabel?: string }) {
  const [pos, setPos] = useState(before ? 38 : 100);
  const box = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);
  const move = (x: number) => {
    const r = box.current?.getBoundingClientRect();
    if (r) setPos(Math.min(100, Math.max(0, ((x - r.left) / r.width) * 100)));
  };
  return (
    <div
      ref={box}
      className="relative mx-auto w-full touch-pan-y select-none overflow-hidden rounded-[10px] border border-line bg-panel"
      onPointerDown={(e) => {
        if (!before) return;
        dragging.current = true;
        e.currentTarget.setPointerCapture(e.pointerId);
        move(e.clientX);
      }}
      onPointerMove={(e) => dragging.current && move(e.clientX)}
      onPointerUp={() => (dragging.current = false)}
      onPointerCancel={() => (dragging.current = false)}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={after} alt={afterLabel} className="block h-auto w-full" draggable={false} />
      {before && (
        <>
          <div className="absolute inset-0" style={{ clipPath: `inset(0 ${100 - pos}% 0 0)` }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={before} alt={beforeLabel} className="block h-full w-full object-cover" draggable={false} />
          </div>
          <div className="pointer-events-none absolute inset-y-0 w-px bg-bone/80" style={{ left: `${pos}%` }} />
          <button
            type="button"
            role="slider"
            aria-label="Comparar tu foto original con el resultado"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(pos)}
            className="absolute top-1/2 grid h-11 w-11 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border border-bone/80 bg-ink/80 text-bone backdrop-blur"
            style={{ left: `${pos}%` }}
            onKeyDown={(e) => {
              if (e.key === "ArrowLeft") setPos((p) => Math.max(0, p - 5));
              if (e.key === "ArrowRight") setPos((p) => Math.min(100, p + 5));
            }}
          >
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
              <path d="M6 4 L2 9 L6 14 M12 4 L16 9 L12 14" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <span className="pointer-events-none absolute bottom-3 left-3 rounded bg-ink/70 px-2 py-1 text-xs font-semibold backdrop-blur">{beforeLabel}</span>
          <span className="pointer-events-none absolute bottom-3 right-3 rounded bg-ink/70 px-2 py-1 text-xs font-semibold backdrop-blur">{afterLabel}</span>
        </>
      )}
    </div>
  );
}
