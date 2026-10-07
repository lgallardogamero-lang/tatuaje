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

export function designSvg(seedText: string, style: string, color: "bw" | "color"): string {
  const r = rng(hash(`${seedText}|${style}`));
  const pal = PALETTES[Math.floor(r() * PALETTES.length)]!;
  const ink = color === "bw" ? "#161616" : pal[2]!;
  const accents = color === "bw" ? ["#161616", "#161616"] : [pal[0]!, pal[1]!];
  const thin = style === "fine-line" || style === "minimalista" || style === "geometrico";
  const sw = thin ? 1.6 : style === "blackwork" || style === "old-school" ? 6 : 3.2;
  const rings = style === "minimalista" ? 2 : 4 + Math.floor(r() * 3);
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
    const fill = style === "blackwork" && k % 2 === 0 ? ink : "none";
    body += `<polygon points="${pts}" fill="${fill}" stroke="${ink}" stroke-width="${sw}" stroke-linejoin="round"/>`;
    body += `<circle cx="256" cy="256" r="${(rad * 0.92).toFixed(1)}" fill="none" stroke="${accents[k % 2]}" stroke-width="${sw * 0.8}" ${k % 2 ? 'stroke-dasharray="2 9" stroke-linecap="round"' : ""}/>`;
  }
  for (let i = 0; i < rays; i++) {
    const a = (i / rays) * Math.PI * 2;
    const x1 = 256 + 30 * Math.cos(a);
    const y1 = 256 + 30 * Math.sin(a);
    const x2 = 256 + 215 * Math.cos(a);
    const y2 = 256 + 215 * Math.sin(a);
    body += `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" stroke="${ink}" stroke-width="${sw * 0.6}" stroke-linecap="round" opacity="0.8"/>`;
  }
  body += `<circle cx="256" cy="256" r="${style === "minimalista" ? 8 : 20}" fill="${accents[0]}" stroke="${ink}" stroke-width="${sw}"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="1024" height="1024">${body}</svg>`;
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
