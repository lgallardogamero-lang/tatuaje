/**
 * Lector y escritor de PNG en TypeScript puro (sin dependencias nativas), para poder poner la marca de agua
 * a las imágenes que devuelve un proveedor de IA dentro de un Worker de Cloudflare.
 * Admite PNG de 8 bits sin entrelazar (gris, gris+alfa, RGB, RGBA y paleta), que es lo que devuelven los proveedores.
 * Todo lo demás se rechaza con un error: es preferible fallar a entregar una imagen sin marca.
 */
export interface Raster {
  width: number;
  height: number;
  /** RGBA, 4 bytes por píxel. */
  data: Uint8ClampedArray;
}

const SIGNATURE = [137, 80, 78, 71, 13, 10, 26, 10];
export const MAX_PIXELS = 16_000_000;

async function pipe(bytes: Uint8Array, stream: { writable: WritableStream; readable: ReadableStream }): Promise<Uint8Array> {
  const w = stream.writable.getWriter();
  void w.write(bytes as BufferSource).then(() => w.close()).catch(() => {});
  return new Uint8Array(await new Response(stream.readable).arrayBuffer());
}
const inflate = (b: Uint8Array) => pipe(b, new DecompressionStream("deflate"));
const deflate = (b: Uint8Array) => pipe(b, new CompressionStream("deflate"));

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(bytes: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]!) & 0xff]! ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

const CHANNELS: Record<number, number> = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 };

export async function decodePng(bytes: Uint8Array): Promise<Raster> {
  for (let i = 0; i < 8; i++) if (bytes[i] !== SIGNATURE[i]) throw new Error("No es un PNG");
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let pos = 8;
  let width = 0;
  let height = 0;
  let bitDepth = 0;
  let colorType = -1;
  let interlace = 0;
  let palette: Uint8Array | null = null;
  let trns: Uint8Array | null = null;
  const idat: Uint8Array[] = [];
  while (pos + 12 <= bytes.length) {
    const len = dv.getUint32(pos);
    const type = String.fromCharCode(bytes[pos + 4]!, bytes[pos + 5]!, bytes[pos + 6]!, bytes[pos + 7]!);
    const body = bytes.subarray(pos + 8, pos + 8 + len);
    if (body.length < len) throw new Error("PNG truncado");
    if (type === "IHDR") {
      width = dv.getUint32(pos + 8);
      height = dv.getUint32(pos + 12);
      bitDepth = bytes[pos + 16]!;
      colorType = bytes[pos + 17]!;
      interlace = bytes[pos + 20]!;
    } else if (type === "PLTE") palette = body;
    else if (type === "tRNS") trns = body;
    else if (type === "IDAT") idat.push(body);
    else if (type === "IEND") break;
    pos += 12 + len;
  }
  if (!width || !height) throw new Error("PNG sin cabecera");
  if (width * height > MAX_PIXELS) throw new Error("Imagen demasiado grande");
  if (bitDepth !== 8) throw new Error(`PNG de ${bitDepth} bits no admitido`);
  if (interlace !== 0) throw new Error("PNG entrelazado no admitido");
  const ch = CHANNELS[colorType];
  if (!ch) throw new Error("Tipo de color PNG no admitido");
  if (colorType === 3 && !palette) throw new Error("PNG de paleta sin PLTE");

  const total = idat.reduce((n, c) => n + c.length, 0);
  const joined = new Uint8Array(total);
  let o = 0;
  for (const c of idat) {
    joined.set(c, o);
    o += c.length;
  }
  const raw = await inflate(joined);
  const stride = width * ch;
  if (raw.length < height * (stride + 1)) throw new Error("PNG corrupto");

  // Quitar los filtros fila a fila
  const px = new Uint8Array(height * stride);
  for (let y = 0; y < height; y++) {
    const ft = raw[y * (stride + 1)]!;
    const src = y * (stride + 1) + 1;
    const dst = y * stride;
    for (let x = 0; x < stride; x++) {
      const v = raw[src + x]!;
      const a = x >= ch ? px[dst + x - ch]! : 0;
      const b = y > 0 ? px[dst - stride + x]! : 0;
      const c = x >= ch && y > 0 ? px[dst - stride + x - ch]! : 0;
      let r: number;
      switch (ft) {
        case 0: r = v; break;
        case 1: r = v + a; break;
        case 2: r = v + b; break;
        case 3: r = v + ((a + b) >> 1); break;
        case 4: {
          const p = a + b - c;
          const pa = Math.abs(p - a);
          const pb = Math.abs(p - b);
          const pc = Math.abs(p - c);
          r = v + (pa <= pb && pa <= pc ? a : pb <= pc ? b : c);
          break;
        }
        default: throw new Error("Filtro PNG desconocido");
      }
      px[dst + x] = r & 255;
    }
  }

  // A RGBA
  const out = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < width * height; i++) {
    const s = i * ch;
    const d = i * 4;
    if (colorType === 6) { out[d] = px[s]!; out[d + 1] = px[s + 1]!; out[d + 2] = px[s + 2]!; out[d + 3] = px[s + 3]!; }
    else if (colorType === 2) { out[d] = px[s]!; out[d + 1] = px[s + 1]!; out[d + 2] = px[s + 2]!; out[d + 3] = 255; }
    else if (colorType === 0) { out[d] = out[d + 1] = out[d + 2] = px[s]!; out[d + 3] = 255; }
    else if (colorType === 4) { out[d] = out[d + 1] = out[d + 2] = px[s]!; out[d + 3] = px[s + 1]!; }
    else {
      const idx = px[s]!;
      out[d] = palette![idx * 3] ?? 0;
      out[d + 1] = palette![idx * 3 + 1] ?? 0;
      out[d + 2] = palette![idx * 3 + 2] ?? 0;
      out[d + 3] = trns && idx < trns.length ? trns[idx]! : 255;
    }
  }
  return { width, height, data: out };
}

function chunk(type: string, body: Uint8Array): Uint8Array {
  const out = new Uint8Array(12 + body.length);
  const dv = new DataView(out.buffer);
  dv.setUint32(0, body.length);
  for (let i = 0; i < 4; i++) out[4 + i] = type.charCodeAt(i);
  out.set(body, 8);
  dv.setUint32(8 + body.length, crc32(out.subarray(4, 8 + body.length)));
  return out;
}

/** Codifica RGBA 8 bits con filtro "Sub" (comprime bien y es barato de calcular). */
export async function encodePng(r: Raster): Promise<Uint8Array> {
  const { width, height, data } = r;
  const stride = width * 4;
  const raw = new Uint8Array(height * (stride + 1));
  for (let y = 0; y < height; y++) {
    const row = y * (stride + 1);
    raw[row] = 1;
    for (let x = 0; x < stride; x++) {
      const a = x >= 4 ? data[y * stride + x - 4]! : 0;
      raw[row + 1 + x] = (data[y * stride + x]! - a) & 255;
    }
  }
  const ihdr = new Uint8Array(13);
  const dv = new DataView(ihdr.buffer);
  dv.setUint32(0, width);
  dv.setUint32(4, height);
  ihdr[8] = 8; // profundidad
  ihdr[9] = 6; // RGBA
  const parts = [new Uint8Array(SIGNATURE), chunk("IHDR", ihdr), chunk("IDAT", await deflate(raw)), chunk("IEND", new Uint8Array(0))];
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return out;
}
