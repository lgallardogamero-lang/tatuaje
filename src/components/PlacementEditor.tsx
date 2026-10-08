"use client";

import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef } from "react";
import type { Placement } from "@/lib/schema";
import { toBlob } from "@/lib/client/image";

export type Tool = "move" | "paint" | "erase";
export type Ghost = { kind: "image"; bitmap: ImageBitmap } | { kind: "placeholder" };

export interface EditorHandle {
  /** Máscara en PNG (blanco = zona del tatuaje). Null si no se ha pintado nada. */
  getMask(): Promise<Blob | null>;
  clearMask(): void;
  hasMask(): boolean;
  /** Imagen de lo que se ve ahora mismo en el editor (foto + guía del diseño). */
  snapshot(): Promise<Blob>;
}

interface Props {
  photo: ImageBitmap;
  ghost: Ghost;
  placement: Placement;
  onPlacement: (p: Placement) => void;
  tool: Tool;
  /** Grosor del pincel como fracción del ancho de la foto. */
  brush: number;
  onMaskChange?: (has: boolean) => void;
}

const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
const MASK_MAX = 1024;

/**
 * Editor sobre canvas: la foto, una guía del diseño (referencia o recuadro) que se mueve,
 * escala y gira con ratón, rueda o dos dedos, y una máscara que se pinta con el pincel.
 */
export const PlacementEditor = forwardRef<EditorHandle, Props>(function PlacementEditor({ photo, ghost, placement, onPlacement, tool, brush, onMaskChange }, ref) {
  const wrap = useRef<HTMLDivElement>(null);
  const base = useRef<HTMLCanvasElement>(null);
  const overlay = useRef<HTMLCanvasElement>(null);
  const maskCanvas = useRef<HTMLCanvasElement | null>(null);
  const painted = useRef(false);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const last = useRef<{ x: number; y: number } | null>(null);
  const pl = useRef(placement);
  pl.current = placement;

  const ratio = photo.width / photo.height;

  // Máscara a resolución reducida
  useEffect(() => {
    const s = Math.min(1, MASK_MAX / Math.max(photo.width, photo.height));
    const c = document.createElement("canvas");
    c.width = Math.round(photo.width * s);
    c.height = Math.round(photo.height * s);
    maskCanvas.current = c;
    painted.current = false;
  }, [photo]);

  const drawMaskOverlay = useCallback(() => {
    const o = overlay.current;
    const m = maskCanvas.current;
    if (!o || !m) return;
    const ctx = o.getContext("2d")!;
    ctx.clearRect(0, 0, o.width, o.height);
    ctx.globalAlpha = 1;
    ctx.drawImage(m, 0, 0, o.width, o.height);
    ctx.globalCompositeOperation = "source-in";
    ctx.fillStyle = "rgba(165,139,255,0.5)";
    ctx.fillRect(0, 0, o.width, o.height);
    ctx.globalCompositeOperation = "source-over";
  }, []);

  const draw = useCallback(() => {
    const c = base.current;
    if (!c) return;
    const ctx = c.getContext("2d")!;
    const W = c.width;
    const H = c.height;
    ctx.clearRect(0, 0, W, H);
    ctx.drawImage(photo, 0, 0, W, H);
    const p = pl.current;
    const w = p.scale * W;
    const h = ghost.kind === "image" ? w * (ghost.bitmap.height / ghost.bitmap.width) : w;
    ctx.save();
    ctx.translate(p.x * W, p.y * H);
    ctx.rotate((p.rotation * Math.PI) / 180);
    if (ghost.kind === "image") {
      ctx.globalCompositeOperation = "multiply";
      ctx.globalAlpha = p.opacity;
      ctx.drawImage(ghost.bitmap, -w / 2, -h / 2, w, h);
      ctx.globalCompositeOperation = "source-over";
      ctx.globalAlpha = 1;
    }
    if (tool === "move" || ghost.kind === "placeholder") {
      ctx.setLineDash([8, 7]);
      ctx.lineWidth = Math.max(2, W / 400);
      ctx.strokeStyle = "#a58bff";
      ctx.fillStyle = "rgba(165,139,255,0.12)";
      if (ghost.kind === "placeholder") {
        ctx.beginPath();
        ctx.ellipse(0, 0, w / 2, h / 2, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.beginPath();
        ctx.moveTo(-w * 0.12, 0);
        ctx.lineTo(w * 0.12, 0);
        ctx.moveTo(0, -w * 0.12);
        ctx.lineTo(0, w * 0.12);
        ctx.stroke();
      } else {
        ctx.strokeRect(-w / 2, -h / 2, w, h);
      }
    }
    ctx.restore();
  }, [photo, ghost, tool]);

  // Ajusta la resolución de los canvas al tamaño en pantalla
  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const fit = () => {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const w = Math.round(el.clientWidth * dpr);
      const h = Math.round(w / ratio);
      for (const c of [base.current, overlay.current]) {
        if (c && (c.width !== w || c.height !== h)) {
          c.width = w;
          c.height = h;
        }
      }
      draw();
      drawMaskOverlay();
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, [ratio, draw, drawMaskOverlay]);

  useEffect(() => {
    draw();
  }, [draw, placement]);

  // Rueda del ratón = tamaño (listener no pasivo para poder evitar el scroll de la página)
  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (tool !== "move") return;
      e.preventDefault();
      const f = Math.exp(-e.deltaY * 0.0015);
      onPlacement({ ...pl.current, scale: clamp(pl.current.scale * f, 0.03, 1.5) });
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [tool, onPlacement]);

  const toLocal = (e: { clientX: number; clientY: number }) => {
    const r = wrap.current!.getBoundingClientRect();
    return { x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height };
  };

  const stroke = (from: { x: number; y: number }, to: { x: number; y: number }) => {
    const m = maskCanvas.current;
    if (!m) return;
    const ctx = m.getContext("2d")!;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.lineWidth = brush * m.width;
    if (tool === "erase") {
      ctx.globalCompositeOperation = "destination-out";
    } else {
      ctx.globalCompositeOperation = "source-over";
      ctx.strokeStyle = "#fff";
    }
    ctx.beginPath();
    ctx.moveTo(from.x * m.width, from.y * m.height);
    ctx.lineTo(to.x * m.width + 0.01, to.y * m.height);
    ctx.stroke();
    ctx.globalCompositeOperation = "source-over";
    if (tool === "paint" && !painted.current) {
      painted.current = true;
      onMaskChange?.(true);
    }
    drawMaskOverlay();
  };

  const onDown = (e: React.PointerEvent) => {
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    const p = toLocal(e);
    pointers.current.set(e.pointerId, p);
    if (tool !== "move" && pointers.current.size === 1) {
      last.current = p;
      stroke(p, p);
    }
  };

  const onMove = (e: React.PointerEvent) => {
    const prev = pointers.current.get(e.pointerId);
    if (!prev) return;
    const cur = toLocal(e);
    if (tool !== "move") {
      if (pointers.current.size === 1 && last.current) {
        stroke(last.current, cur);
        last.current = cur;
      }
      pointers.current.set(e.pointerId, cur);
      return;
    }
    const others = [...pointers.current.entries()].filter(([id]) => id !== e.pointerId);
    const p = pl.current;
    const rect = wrap.current!.getBoundingClientRect();
    if (others.length === 0) {
      onPlacement({ ...p, x: clamp(p.x + (cur.x - prev.x), 0, 1), y: clamp(p.y + (cur.y - prev.y), 0, 1) });
    } else {
      const o = others[0]![1];
      const aspect = rect.width / rect.height;
      const vec = (a: { x: number; y: number }, b: { x: number; y: number }) => ({ x: (b.x - a.x) * aspect, y: b.y - a.y });
      const v0 = vec(prev, o);
      const v1 = vec(cur, o);
      const d0 = Math.hypot(v0.x, v0.y) || 1;
      const d1 = Math.hypot(v1.x, v1.y) || 1;
      const dAng = ((Math.atan2(v1.y, v1.x) - Math.atan2(v0.y, v0.x)) * 180) / Math.PI;
      onPlacement({
        ...p,
        scale: clamp(p.scale * (d1 / d0), 0.03, 1.5),
        rotation: ((((p.rotation + dAng + 180) % 360) + 360) % 360) - 180,
        x: clamp(p.x + (cur.x - prev.x) / 2, 0, 1),
        y: clamp(p.y + (cur.y - prev.y) / 2, 0, 1),
      });
    }
    pointers.current.set(e.pointerId, cur);
  };

  const onUp = (e: React.PointerEvent) => {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size === 0) last.current = null;
  };

  const onKey = (e: React.KeyboardEvent) => {
    if (tool !== "move") return;
    const step = e.shiftKey ? 0.04 : 0.01;
    const p = pl.current;
    const k: Record<string, Partial<Placement>> = {
      ArrowLeft: { x: clamp(p.x - step, 0, 1) },
      ArrowRight: { x: clamp(p.x + step, 0, 1) },
      ArrowUp: { y: clamp(p.y - step, 0, 1) },
      ArrowDown: { y: clamp(p.y + step, 0, 1) },
      "+": { scale: clamp(p.scale * 1.06, 0.03, 1.5) },
      "-": { scale: clamp(p.scale / 1.06, 0.03, 1.5) },
    };
    const patch = k[e.key];
    if (patch) {
      e.preventDefault();
      onPlacement({ ...p, ...patch });
    }
  };

  useImperativeHandle(ref, () => ({
    hasMask: () => painted.current,
    snapshot: () => toBlob(base.current!, "image/png"),
    clearMask: () => {
      const m = maskCanvas.current;
      m?.getContext("2d")!.clearRect(0, 0, m.width, m.height);
      painted.current = false;
      onMaskChange?.(false);
      drawMaskOverlay();
    },
    getMask: async () => {
      const m = maskCanvas.current;
      if (!m || !painted.current) return null;
      const out = document.createElement("canvas");
      out.width = m.width;
      out.height = m.height;
      const ctx = out.getContext("2d")!;
      const src = m.getContext("2d")!.getImageData(0, 0, m.width, m.height);
      const dst = ctx.createImageData(m.width, m.height);
      for (let i = 0; i < src.data.length; i += 4) {
        const on = src.data[i + 3]! > 24 ? 255 : 0;
        dst.data[i] = dst.data[i + 1] = dst.data[i + 2] = on;
        dst.data[i + 3] = 255;
      }
      ctx.putImageData(dst, 0, 0);
      return toBlob(out, "image/png");
    },
  }));

  return (
    <div
      ref={wrap}
      className="relative mx-auto w-full touch-none select-none overflow-hidden rounded-[10px] border border-line bg-panel outline-offset-4"
      style={{ aspectRatio: String(ratio), maxWidth: `min(100%, calc(68dvh * ${ratio}))`, cursor: tool === "move" ? "grab" : "crosshair" }}
      role="application"
      aria-label="Editor: arrastra para mover el diseño, pellizca para cambiar el tamaño y el giro. Con teclado, usa las flechas y más o menos."
      tabIndex={0}
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={onUp}
      onPointerCancel={onUp}
      onKeyDown={onKey}
    >
      <canvas ref={base} className="absolute inset-0 h-full w-full" />
      <canvas ref={overlay} className="pointer-events-none absolute inset-0 h-full w-full" />
    </div>
  );
});
