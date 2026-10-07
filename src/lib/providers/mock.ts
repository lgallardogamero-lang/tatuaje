import { imageSize } from "../image-validation";
import type { ApplyInput, DesignInput, ImageBytes, ImageGenerationProvider } from "./types";

/**
 * Proveedor simulado: no llama a ninguna API ni cuesta dinero. Genera diseños
 * geométricos deterministas (según el texto) y los compone sobre la foto en SVG.
 * Sirve para desarrollar, probar y hacer demos; no representa la calidad de la IA real.
 */

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function rng(seed: number) {
  let a = seed || 1;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const PALETTES = [
  ["#c0392b", "#f39c12", "#1b1b1b"],
  ["#1f6f8b", "#99d5c9", "#1b1b1b"],
  ["#7b2d8e", "#e84a5f", "#1b1b1b"],
  ["#2d6a4f", "#d4a017", "#1b1b1b"],
];

const SVG_OPEN = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="1024" height="1024">';

/** Motivos distintos por estilo para que las demos y la galería no sean todas iguales. */
function motif(style: string, r: () => number, ink: string, a1: string, a2: string, sw: number, seedText: string): string {
  const arc = (cx: number, cy: number, rad: number, from: number, to: number) => {
    const p = (t: number) => `${(cx + rad * Math.cos(t)).toFixed(1)} ${(cy + rad * Math.sin(t)).toFixed(1)}`;
    return `M${p(from)} A${rad} ${rad} 0 0 1 ${p(to)}`;
  };
  let o = "";
  switch (style) {
    case "japones": {
      o += `<circle cx="256" cy="150" r="62" fill="${a1}" stroke="${ink}" stroke-width="${sw}"/>`;
      for (let row = 0; row < 6; row++)
        for (let i = 0; i < 7; i++) {
          const cx = 60 + i * 66 + (row % 2) * 33;
          const cy = 300 + row * 28;
          for (let k = 3; k >= 1; k--) o += `<path d="${arc(cx, cy, k * 11, Math.PI, 2 * Math.PI)}" fill="none" stroke="${ink}" stroke-width="${sw * 0.7}" stroke-linecap="round"/>`;
        }
      return o;
    }
    case "fine-line": {
      o += `<path d="M256 470 C 250 360 270 250 256 110" fill="none" stroke="${ink}" stroke-width="${sw}" stroke-linecap="round"/>`;
      for (let i = 0; i < 9; i++) {
        const y = 420 - i * 34;
        const w = 60 - i * 3.5;
        o += `<path d="M256 ${y} C ${256 - w} ${y - 30} ${256 - w - 14} ${y - 8} ${256 - w - 28} ${y - 40}" fill="none" stroke="${ink}" stroke-width="${sw}" stroke-linecap="round"/>`;
        o += `<path d="M256 ${y - 14} C ${256 + w} ${y - 44} ${256 + w + 14} ${y - 22} ${256 + w + 28} ${y - 54}" fill="none" stroke="${a2}" stroke-width="${sw}" stroke-linecap="round"/>`;
      }
      return o + `<circle cx="256" cy="104" r="7" fill="none" stroke="${ink}" stroke-width="${sw}"/>`;
    }
    case "acuarela": {
      const cols = [a1, a2, "#4f8fc0"];
      for (let i = 0; i < 6; i++)
        o += `<circle cx="${150 + r() * 210}" cy="${150 + r() * 210}" r="${50 + r() * 70}" fill="${cols[i % 3]}" fill-opacity=".38"/>`;
      return o + `<path d="M120 380 C 200 300 300 330 400 150" fill="none" stroke="${ink}" stroke-width="${sw * 0.6}" stroke-linecap="round"/>`;
    }
    case "minimalista": {
      o += `<path d="M300 130 A 120 120 0 1 0 300 390 A 92 92 0 1 1 300 130 Z" fill="none" stroke="${ink}" stroke-width="${sw}" stroke-linejoin="round"/>`;
      return o + `<circle cx="370" cy="190" r="6" fill="${ink}"/><circle cx="400" cy="250" r="3.5" fill="${ink}"/>`;
    }
    case "old-school": {
      o += `<path d="M256 440 C 90 320 90 170 170 140 C 215 124 245 150 256 180 C 267 150 297 124 342 140 C 422 170 422 320 256 440 Z" fill="${a1}" stroke="${ink}" stroke-width="${sw}" stroke-linejoin="round"/>`;
      o += `<path d="M110 300 L400 270 L412 320 L120 350 Z" fill="#fff" stroke="${ink}" stroke-width="${sw}" stroke-linejoin="round"/>`;
      return o + `<path d="M180 190 C 190 170 215 168 232 188" fill="none" stroke="#fff" stroke-width="${sw}" stroke-linecap="round" opacity=".7"/>`;
    }
    case "blackwork": {
      o += `<circle cx="256" cy="256" r="78" fill="${ink}"/>`;
      for (let i = 0; i < 16; i++) {
        const t = (i / 16) * Math.PI * 2;
        const long = i % 2 === 0;
        o += `<path d="M${(256 + 100 * Math.cos(t - 0.1)).toFixed(1)} ${(256 + 100 * Math.sin(t - 0.1)).toFixed(1)} L${(256 + (long ? 215 : 160) * Math.cos(t)).toFixed(1)} ${(256 + (long ? 215 : 160) * Math.sin(t)).toFixed(1)} L${(256 + 100 * Math.cos(t + 0.1)).toFixed(1)} ${(256 + 100 * Math.sin(t + 0.1)).toFixed(1)} Z" fill="${ink}"/>`;
      }
      return o + `<circle cx="256" cy="256" r="46" fill="none" stroke="#fff" stroke-width="${sw * 0.8}" stroke-dasharray="3 9" stroke-linecap="round"/>`;
    }
    case "lettering": {
      const word = (seedText.replace(/[^\p{L}\s]/gu, "").trim().split(/\s+/)[0] || "Carpe").slice(0, 10);
      return `<text x="256" y="290" text-anchor="middle" font-family="'Brush Script MT','Snell Roundhand',cursive,serif" font-style="italic" font-size="${word.length > 6 ? 110 : 150}" fill="${ink}">${word.replace(/[<>&]/g, "")}</text><path d="M100 330 C 200 300 320 360 420 320" fill="none" stroke="${a1}" stroke-width="${sw}" stroke-linecap="round"/>`;
    }
    case "realista":
    case "neotradicional": {
      // Rosa: capas de pétalos (elipses giradas) y hojas
      const real = style === "realista";
      for (let layer = 3; layer >= 1; layer--)
        for (let i = 0; i < 5; i++) {
          const rot = i * 72 + layer * 24;
          o += `<ellipse cx="256" cy="${256 - layer * 30}" rx="${layer * 26 + 14}" ry="${layer * 34 + 18}" transform="rotate(${rot} 256 256)" fill="${layer % 2 ? a1 : a2}" fill-opacity="${real ? 0.14 : 0.5}" stroke="${ink}" stroke-width="${sw * 0.8}"/>`;
        }
      o += `<path d="M256 256 m-22 0 a22 22 0 1 1 22 22 a12 12 0 1 1 -12 -12" fill="none" stroke="${ink}" stroke-width="${sw}" stroke-linecap="round"/>`;
      o += `<path d="M256 470 C 262 420 250 380 256 340" fill="none" stroke="${ink}" stroke-width="${sw * 1.4}" stroke-linecap="round"/>`;
      return o + `<path d="M256 430 C 200 420 168 392 150 360 C 210 356 246 382 256 430Z" fill="${a2}" fill-opacity="${real ? 0.2 : 0.7}" stroke="${ink}" stroke-width="${sw * 0.8}"/><path d="M256 400 C 310 392 342 366 358 336 C 300 334 266 360 256 400Z" fill="${a2}" fill-opacity="${real ? 0.2 : 0.7}" stroke="${ink}" stroke-width="${sw * 0.8}"/>`;
    }
    default:
      return "";
  }
}

export function designSvg(seedText: string, style: string, color: "bw" | "color"): string {
  const r = rng(hash(`${seedText}|${style}`));
  const pal = PALETTES[Math.floor(r() * PALETTES.length)]!;
  const ink = color === "bw" ? "#161616" : pal[2]!;
  const a1 = color === "bw" ? "#161616" : pal[0]!;
  const a2 = color === "bw" ? "#161616" : pal[1]!;
  const thin = style === "fine-line" || style === "minimalista" || style === "geometrico";
  const sw = thin ? 1.8 : style === "blackwork" || style === "old-school" ? 6 : 3.4;
  if (style !== "geometrico") {
    const m = motif(style, r, ink, a1, a2, sw, seedText);
    if (m) return `${SVG_OPEN}${m}</svg>`;
  }
  const rings = 4 + Math.floor(r() * 3);
  const sides = 3 + Math.floor(r() * 5);
  const rays = 8 + Math.floor(r() * 16);
  let body = "";
  for (let k = 0; k < rings; k++) {
    const rad = 220 - k * (200 / rings);
    const rot = r() * 360;
    const pts = Array.from({ length: sides }, (_, i) => {
      const a = ((i / sides) * 360 + rot) * (Math.PI / 180);
      return `${(256 + rad * Math.cos(a)).toFixed(1)},${(256 + rad * Math.sin(a)).toFixed(1)}`;
    }).join(" ");
    body += `<polygon points="${pts}" fill="none" stroke="${ink}" stroke-width="${sw}" stroke-linejoin="round"/>`;
    body += `<circle cx="256" cy="256" r="${(rad * 0.92).toFixed(1)}" fill="none" stroke="${k % 2 ? a1 : ink}" stroke-width="${sw * 0.8}" ${k % 2 ? 'stroke-dasharray="2 9" stroke-linecap="round"' : ""}/>`;
  }
  for (let i = 0; i < rays; i++) {
    const a = (i / rays) * Math.PI * 2;
    body += `<line x1="${(256 + 30 * Math.cos(a)).toFixed(1)}" y1="${(256 + 30 * Math.sin(a)).toFixed(1)}" x2="${(256 + 215 * Math.cos(a)).toFixed(1)}" y2="${(256 + 215 * Math.sin(a)).toFixed(1)}" stroke="${ink}" stroke-width="${sw * 0.6}" stroke-linecap="round" opacity="0.8"/>`;
  }
  body += `<circle cx="256" cy="256" r="14" fill="${a1}" stroke="${ink}" stroke-width="${sw}"/>`;
  return `${SVG_OPEN}${body}</svg>`;
}

const b64 = (bytes: Uint8Array): string => {
  let s = "";
  const CH = 0x8000;
  for (let i = 0; i < bytes.length; i += CH) s += String.fromCharCode(...bytes.subarray(i, i + CH));
  return btoa(s);
};
const dataUri = (img: ImageBytes) => `data:${img.contentType};base64,${b64(img.bytes)}`;
const svgBytes = (svg: string): ImageBytes => ({ bytes: new TextEncoder().encode(svg), contentType: "image/svg+xml" });

export class MockProvider implements ImageGenerationProvider {
  readonly name = "mock";

  async createDesign(input: DesignInput): Promise<ImageBytes> {
    await new Promise((r) => setTimeout(r, 300));
    return svgBytes(designSvg(input.seed || input.prompt, input.style, input.color));
  }

  async applyToSkin(input: ApplyInput): Promise<ImageBytes[]> {
    const size = imageSize(input.photo.bytes) ?? { width: 1024, height: 1024 };
    const { width: W, height: H } = size;
    const photo = dataUri(input.photo);
    const design = dataUri(input.design);
    const mask = input.mask ? dataUri(input.mask) : null;
    const p = input.placement;
    const w = p.scale * W;
    const r = rng(hash(input.seed));
    const out: ImageBytes[] = [];
    for (let v = 0; v < input.variants; v++) {
      const dx = (r() - 0.5) * 0.012 * W * v;
      const dy = (r() - 0.5) * 0.012 * H * v;
      const rot = p.rotation + (v === 0 ? 0 : (r() - 0.5) * 6);
      const op = Math.max(0.35, p.opacity * (1 - v * 0.08));
      const blur = (0.6 + v * 0.5) * (W / 1024);
      out.push(
        svgBytes(`<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">
<defs>
<filter id="ink" x="-10%" y="-10%" width="120%" height="120%"><feGaussianBlur stdDeviation="${blur.toFixed(2)}"/><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="${v + 3}" result="n"/><feDisplacementMap in="SourceGraphic" in2="n" scale="${(1.5 * W) / 1024}"/></filter>
${mask ? `<mask id="m" maskUnits="userSpaceOnUse" x="0" y="0" width="${W}" height="${H}"><image xlink:href="${mask}" href="${mask}" width="${W}" height="${H}"/></mask>` : ""}
</defs>
<image xlink:href="${photo}" href="${photo}" width="${W}" height="${H}"/>
<g ${mask ? 'mask="url(#m)"' : ""}>
<g transform="translate(${(p.x * W + dx).toFixed(1)} ${(p.y * H + dy).toFixed(1)}) rotate(${rot.toFixed(1)})" opacity="${op.toFixed(2)}" style="mix-blend-mode:multiply" filter="url(#ink)">
<image xlink:href="${design}" href="${design}" x="${(-w / 2).toFixed(1)}" y="${(-w / 2).toFixed(1)}" width="${w.toFixed(1)}" height="${w.toFixed(1)}"/>
</g></g></svg>`),
      );
    }
    return out;
  }
}
