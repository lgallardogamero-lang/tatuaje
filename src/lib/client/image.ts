import { MAX_IMAGE_BYTES, MAX_IMAGE_SIDE } from "../config";

const OK_TYPES = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"];

export interface Prepared {
  blob: Blob;
  width: number;
  height: number;
  bitmap: ImageBitmap;
}

function isHeic(f: File) {
  return /heic|heif/i.test(f.type) || /\.(heic|heif)$/i.test(f.name);
}

/**
 * Prepara una imagen subida: valida, convierte HEIC, corrige la orientación EXIF,
 * reduce a `maxSide` y comprime a JPEG. Lanza errores con mensajes para el usuario.
 */
export async function prepareImage(file: File, maxSide = MAX_IMAGE_SIDE): Promise<Prepared> {
  if (file.size > 40 * 1024 * 1024) throw new Error("La imagen pesa demasiado (máximo 40 MB)");
  if (!OK_TYPES.includes(file.type) && !isHeic(file)) throw new Error("Formato no válido. Usa JPG, PNG, WEBP o HEIC");
  let source: Blob = file;
  if (isHeic(file)) {
    try {
      const { default: heic2any } = await import("heic2any");
      const out = await heic2any({ blob: file, toType: "image/jpeg", quality: 0.9 });
      source = Array.isArray(out) ? out[0]! : out;
    } catch {
      throw new Error("No hemos podido leer esa foto HEIC. Prueba a exportarla como JPG");
    }
  }
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(source, { imageOrientation: "from-image" });
  } catch {
    throw new Error("No hemos podido abrir la imagen. Prueba con otra foto");
  }
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(bitmap, 0, 0, width, height);
  let quality = 0.9;
  let blob = await toBlob(canvas, "image/jpeg", quality);
  while (blob.size > MAX_IMAGE_BYTES * 0.9 && quality > 0.4) {
    quality -= 0.1;
    blob = await toBlob(canvas, "image/jpeg", quality);
  }
  const final = await createImageBitmap(canvas);
  return { blob, width, height, bitmap: final };
}

export function toBlob(canvas: HTMLCanvasElement, type: string, quality?: number): Promise<Blob> {
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("No se pudo crear la imagen"))), type, quality));
}

export async function loadImage(url: string): Promise<HTMLImageElement> {
  const img = new Image();
  img.decoding = "async";
  img.src = url;
  await img.decode();
  return img;
}

/** Convierte un SVG (u otra imagen) del servidor a PNG para descargarlo. */
export async function toPngBlob(url: string, opts: { background?: string } = {}): Promise<Blob> {
  const res = await fetch(url);
  if (!res.ok) throw new Error("No se pudo descargar el archivo");
  const blob = await res.blob();
  if (blob.type === "image/png") return blob;
  const objUrl = URL.createObjectURL(blob);
  try {
    const img = await loadImage(objUrl);
    const w = img.naturalWidth || 1024;
    const h = img.naturalHeight || 1024;
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d")!;
    if (opts.background) {
      ctx.fillStyle = opts.background;
      ctx.fillRect(0, 0, w, h);
    }
    ctx.drawImage(img, 0, 0, w, h);
    return await toBlob(canvas, "image/png");
  } finally {
    URL.revokeObjectURL(objUrl);
  }
}

/** Stencil: líneas negras sobre blanco puro, listo para imprimir y transferir. Se calcula en el navegador. */
export async function makeStencil(url: string): Promise<Blob> {
  const png = await toPngBlob(url, { background: "#ffffff" });
  const objUrl = URL.createObjectURL(png);
  try {
    const img = await loadImage(objUrl);
    const canvas = document.createElement("canvas");
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const ctx = canvas.getContext("2d")!;
    ctx.drawImage(img, 0, 0);
    const data = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const px = data.data;
    for (let i = 0; i < px.length; i += 4) {
      const lum = 0.299 * px[i]! + 0.587 * px[i + 1]! + 0.114 * px[i + 2]!;
      const v = lum < 170 ? 0 : 255;
      px[i] = px[i + 1] = px[i + 2] = v;
      px[i + 3] = 255;
    }
    ctx.putImageData(data, 0, 0);
    return await toBlob(canvas, "image/png");
  } finally {
    URL.revokeObjectURL(objUrl);
  }
}

export function downloadBlob(blob: Blob, filename: string) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}

/** Añade el logo del estudio (abajo a la derecha, sobre una pastilla oscura para que se lea en cualquier foto). */
export async function withLogo(png: Blob, logoUrl: string): Promise<Blob> {
  const base = URL.createObjectURL(png);
  try {
    const [img, logo] = await Promise.all([loadImage(base), loadImage(logoUrl)]);
    const canvas = document.createElement("canvas");
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const ctx = canvas.getContext("2d")!;
    ctx.drawImage(img, 0, 0);
    const pad = Math.round(canvas.width * 0.025);
    const w = Math.max(90, Math.round(canvas.width * 0.16));
    const h = Math.round(w * (logo.naturalHeight / logo.naturalWidth));
    const x = canvas.width - w - pad * 2;
    const y = canvas.height - h - pad * 2;
    ctx.fillStyle = "rgba(14,16,20,0.72)";
    ctx.beginPath();
    ctx.roundRect(x - pad / 2, y - pad / 2, w + pad, h + pad, pad / 2);
    ctx.fill();
    ctx.drawImage(logo, x, y, w, h);
    return await toBlob(canvas, "image/png");
  } finally {
    URL.revokeObjectURL(base);
  }
}
