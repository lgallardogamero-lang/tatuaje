import type { Raster } from "./png";

// Fuente de mapa de bits 5x7 con solo las letras que necesita la marca de agua.
const GLYPHS: Record<string, string[]> = {
  A: ["01110", "10001", "10001", "11111", "10001", "10001", "10001"],
  C: ["01110", "10001", "10000", "10000", "10000", "10001", "01110"],
  E: ["11111", "10000", "10000", "11110", "10000", "10000", "11111"],
  I: ["01110", "00100", "00100", "00100", "00100", "00100", "01110"],
  L: ["10000", "10000", "10000", "10000", "10000", "10000", "11111"],
  O: ["01110", "10001", "10001", "10001", "10001", "10001", "01110"],
  P: ["11110", "10001", "10001", "11110", "10000", "10000", "10000"],
  R: ["11110", "10001", "10001", "11110", "10100", "10010", "10001"],
  S: ["01111", "10000", "10000", "01110", "00001", "00001", "11110"],
  T: ["11111", "00100", "00100", "00100", "00100", "00100", "00100"],
  V: ["10001", "10001", "10001", "10001", "10001", "01010", "00100"],
  "·": ["00000", "00000", "00000", "00100", "00000", "00000", "00000"],
  " ": ["00000", "00000", "00000", "00000", "00000", "00000", "00000"],
};

export const DEFAULT_STAMP = "CALCO · VISTA PREVIA";

/** Estampa el texto en diagonal y repetido por toda la imagen (blanco semitransparente con sombra oscura). Modifica el raster. */
export function stampWatermark(r: Raster, text = DEFAULT_STAMP): void {
  const glyphs = [...text.toUpperCase()].map((c) => GLYPHS[c] ?? GLYPHS[" "]!);
  const cell = Math.max(2, Math.round(r.width / 230)); // tamaño de cada "punto" de la letra
  const charW = 6 * cell;
  const textW = glyphs.length * charW;
  const tileW = textW + 8 * charW;
  const tileH = 7 * cell + 12 * cell;
  const ang = (-28 * Math.PI) / 180;
  const cos = Math.cos(ang);
  const sin = Math.sin(ang);

  const lit = (lu: number, lv: number): boolean => {
    if (lv < 0 || lv >= 7 * cell || lu < 0 || lu >= textW) return false;
    const gi = Math.floor(lu / charW);
    const gx = Math.floor((lu % charW) / cell);
    const gy = Math.floor(lv / cell);
    return gx < 5 && glyphs[gi]![gy]![gx] === "1";
  };

  const { width, height, data } = r;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      // coordenadas giradas; cada fila de baldosas se desplaza media baldosa para que no quede en rejilla
      const u = x * cos + y * sin;
      const v = -x * sin + y * cos;
      const row = Math.floor(v / tileH);
      const lv = v - row * tileH;
      let lu = (u + (row % 2 ? tileW / 2 : 0)) % tileW;
      if (lu < 0) lu += tileW;
      let alpha = 0;
      let shade = 255;
      if (lit(lu, lv)) alpha = 0.36;
      else if (lit(lu - cell * 0.8, lv - cell * 0.8)) {
        alpha = 0.26;
        shade = 0;
      }
      if (alpha > 0) {
        const i = (y * width + x) * 4;
        data[i] = data[i]! * (1 - alpha) + shade * alpha;
        data[i + 1] = data[i + 1]! * (1 - alpha) + shade * alpha;
        data[i + 2] = data[i + 2]! * (1 - alpha) + shade * alpha;
      }
    }
  }
}
