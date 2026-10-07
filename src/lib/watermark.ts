import { getEnv } from "./env";
import type { ImageBytes } from "./providers/types";

/**
 * Marca de agua discreta para resultados gratuitos. Se aplica en el servidor;
 * la imagen limpia solo se sirve a quien tenga el derecho de descarga HD.
 */
export async function applyWatermark(img: ImageBytes, label = "Vista previa · tatuaje"): Promise<ImageBytes> {
  if (img.contentType === "image/svg+xml") {
    const svg = new TextDecoder().decode(img.bytes);
    const m = svg.match(/viewBox="0 0 (\d+(?:\.\d+)?) (\d+(?:\.\d+)?)"/);
    const W = Number(m?.[1] ?? 1024);
    const H = Number(m?.[2] ?? 1024);
    const fs = Math.max(14, Math.round(W / 38));
    const tile = Math.round(fs * 11);
    const marks = `<defs><pattern id="wm" width="${tile}" height="${tile}" patternUnits="userSpaceOnUse" patternTransform="rotate(-28)"><text x="0" y="${fs}" font-family="sans-serif" font-size="${fs}" fill="#fff" fill-opacity="0.34" stroke="#000" stroke-opacity="0.18" stroke-width="0.6">${label}</text></pattern></defs><rect width="${W}" height="${H}" fill="url(#wm)"/>`;
    return { bytes: new TextEncoder().encode(svg.replace(/<\/svg>\s*$/, `${marks}</svg>`)), contentType: img.contentType };
  }
  const images = getEnv().IMAGES as { input: (s: ReadableStream) => unknown } | undefined;
  if (!images) {
    // Falla cerrado: sin marca de agua no se entrega un resultado gratuito.
    throw new Error("Marca de agua no disponible para imágenes rasterizadas: falta el binding IMAGES");
  }
  // SIN PROBAR: dibujar el PNG de marca de agua con Cloudflare Images (env.IMAGES.input(...).draw(...)).
  throw new Error("Marca de agua rasterizada pendiente de implementar con Cloudflare Images");
}
