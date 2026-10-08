import { decodePng, encodePng, MAX_PIXELS, type Raster } from "./png";

/**
 * Convierte la máscara de la web (PNG en blanco y negro, blanco = zona del tatuaje, más pequeña que la foto)
 * al formato que piden los proveedores de edición de imagen: mismo tamaño que la foto, y TRANSPARENTE donde se debe editar.
 */
export async function toProviderMask(maskPng: Uint8Array, width: number, height: number): Promise<Uint8Array> {
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1 || width * height > MAX_PIXELS) throw new Error("Tamaño de máscara no válido");
  const m: Raster = await decodePng(maskPng);
  const out = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) {
    const sy = Math.min(m.height - 1, Math.floor((y * m.height) / height));
    for (let x = 0; x < width; x++) {
      const sx = Math.min(m.width - 1, Math.floor((x * m.width) / width));
      const s = (sy * m.width + sx) * 4;
      const lum = (m.data[s]! + m.data[s + 1]! + m.data[s + 2]!) / 3;
      const d = (y * width + x) * 4;
      // negro opaco = conservar; transparente = editar
      out[d + 3] = lum > 127 ? 0 : 255;
    }
  }
  return encodePng({ width, height, data: out });
}
