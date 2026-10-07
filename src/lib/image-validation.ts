import { MAX_IMAGE_BYTES } from "./config";

export type ImageType = "image/jpeg" | "image/png" | "image/webp";

/** Detecta el tipo real por los primeros bytes; el Content-Type que envía el cliente no se fía. */
export function sniffImageType(b: Uint8Array): ImageType | "heic" | null {
  if (b.length < 12) return null;
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return "image/png";
  const riff = String.fromCharCode(b[0]!, b[1]!, b[2]!, b[3]!);
  const webp = String.fromCharCode(b[8]!, b[9]!, b[10]!, b[11]!);
  if (riff === "RIFF" && webp === "WEBP") return "image/webp";
  const ftyp = String.fromCharCode(b[4]!, b[5]!, b[6]!, b[7]!);
  if (ftyp === "ftyp") return "heic";
  return null;
}

export type Validation = { ok: true; type: ImageType } | { ok: false; error: string };

export function validateImage(b: Uint8Array): Validation {
  if (b.length === 0) return { ok: false, error: "El archivo está vacío" };
  if (b.length > MAX_IMAGE_BYTES) return { ok: false, error: "La imagen pesa demasiado (máximo 12 MB)" };
  const t = sniffImageType(b);
  if (t === "heic") return { ok: false, error: "Formato HEIC no admitido en el servidor. La web lo convierte antes de subirlo" };
  if (!t) return { ok: false, error: "Formato no válido. Usa JPG, PNG, WEBP o HEIC" };
  return { ok: true, type: t };
}

/** Lee ancho y alto de JPEG/PNG/WEBP sin decodificar la imagen. */
export function imageSize(b: Uint8Array): { width: number; height: number } | null {
  const t = sniffImageType(b);
  const dv = new DataView(b.buffer, b.byteOffset, b.byteLength);
  if (t === "image/png") return { width: dv.getUint32(16), height: dv.getUint32(20) };
  if (t === "image/jpeg") {
    let i = 2;
    while (i + 9 < b.length) {
      if (b[i] !== 0xff) {
        i++;
        continue;
      }
      const marker = b[i + 1]!;
      if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
        return { height: dv.getUint16(i + 5), width: dv.getUint16(i + 7) };
      }
      i += 2 + dv.getUint16(i + 2);
    }
    return null;
  }
  if (t === "image/webp") {
    const fmt = String.fromCharCode(b[12]!, b[13]!, b[14]!, b[15]!);
    if (fmt === "VP8X") return { width: 1 + (b[24]! | (b[25]! << 8) | (b[26]! << 16)), height: 1 + (b[27]! | (b[28]! << 8) | (b[29]! << 16)) };
    if (fmt === "VP8 ") return { width: dv.getUint16(26, true) & 0x3fff, height: dv.getUint16(28, true) & 0x3fff };
    if (fmt === "VP8L") {
      const bits = dv.getUint32(21, true);
      return { width: (bits & 0x3fff) + 1, height: ((bits >> 14) & 0x3fff) + 1 };
    }
  }
  return null;
}
