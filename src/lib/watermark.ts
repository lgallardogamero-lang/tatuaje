import { decodePng, encodePng } from "./png";
import { stampWatermark } from "./stamp";
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
  if (img.contentType === "image/png") {
    // Falla cerrado: si la imagen no se puede leer, no se entrega un resultado gratuito sin marca.
    const r = await decodePng(img.bytes);
    stampWatermark(r);
    return { bytes: await encodePng(r), contentType: "image/png" };
  }
  throw new Error(`Marca de agua no disponible para ${img.contentType}`);
}
