/** Utilidades de color para el color de marca de un estudio. */
export const HEX_RE = /^#[0-9a-fA-F]{6}$/;

function lin(c: number) {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
}
export function luminance(hex: string): number {
  const n = parseInt(hex.slice(1), 16);
  return 0.2126 * lin((n >> 16) & 255) + 0.7152 * lin((n >> 8) & 255) + 0.0722 * lin(n & 255);
}
export function contrast(a: string, b: string): number {
  const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p);
  return (x! + 0.05) / (y! + 0.05);
}

/** Texto de los botones (oscuro) y fondo de la web: el color de marca debe leerse con ambos. */
export const BUTTON_TEXT = "#14102b";
export const PAGE_BG = "#0e1014";

export function checkBrandColor(hex: string): { ok: true } | { ok: false; error: string } {
  if (!HEX_RE.test(hex)) return { ok: false, error: "El color debe tener el formato #RRGGBB" };
  if (contrast(hex, BUTTON_TEXT) < 4.5) return { ok: false, error: "Ese color es demasiado oscuro: el texto de los botones no se leería. Elige uno más claro" };
  if (contrast(hex, PAGE_BG) < 3) return { ok: false, error: "Ese color se confunde con el fondo de la web. Elige uno más claro" };
  return { ok: true };
}
