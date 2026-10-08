import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { decodePng, encodePng, MAX_PIXELS } from "@/lib/png";
import { DEFAULT_STAMP, stampWatermark } from "@/lib/stamp";
import { applyWatermark } from "@/lib/watermark";

const fx = (n: string) => new Uint8Array(fs.readFileSync(path.resolve(import.meta.dirname, "fixtures/png", n)));
const W = 97;
const H = 61;
const at = (r: { width: number; data: Uint8ClampedArray }, x: number, y: number) => [...r.data.subarray((y * r.width + x) * 4, (y * r.width + x) * 4 + 4)];

describe("lector de PNG (contra imágenes creadas con otra herramienta)", () => {
  it("RGB con filtros adaptativos", async () => {
    const r = await decodePng(fx("rgb.png"));
    expect([r.width, r.height]).toEqual([W, H]);
    for (const [x, y] of [[0, 0], [1, 0], [50, 30], [96, 60], [13, 59], [96, 0]] as const) {
      expect(at(r, x, y), `${x},${y}`).toEqual([(x * 5 + y) % 256, (y * 7 + x * 2) % 256, (x * y) % 256, 255]);
    }
  });
  it("RGBA, gris y paleta", async () => {
    const a = await decodePng(fx("rgba.png"));
    for (const [x, y] of [[0, 0], [20, 40], [96, 60]] as const) expect(at(a, x, y)).toEqual([(x * 3) % 256, (y * 4) % 256, (x + y) % 256, (x * 2 + y) % 256]);
    const g = await decodePng(fx("gray.png"));
    for (const [x, y] of [[0, 0], [33, 7], [96, 60]] as const) {
      const v = (x * y + x) % 256;
      expect(at(g, x, y)).toEqual([v, v, v, 255]);
    }
    const p = await decodePng(fx("palette.png"));
    for (const [x, y] of [[0, 0], [10, 10], [96, 60]] as const) {
      const i = (x + y * 3) % 200;
      expect(at(p, x, y)).toEqual([i, 255 - i, (i * 3) % 256, 255]);
    }
  });
  it("codificar y volver a leer devuelve exactamente lo mismo", async () => {
    const r = await decodePng(fx("rgba.png"));
    const again = await decodePng(await encodePng(r));
    expect(again.width).toBe(r.width);
    expect(Buffer.from(again.data).equals(Buffer.from(r.data))).toBe(true);
  });
  it("rechaza lo que no sabe tratar con un error, nunca lo deja pasar", async () => {
    await expect(decodePng(fx("interlaced.png"))).rejects.toThrow(/entrelazado/);
    await expect(decodePng(fx("deep16.png"))).rejects.toThrow(/bits/);
    await expect(decodePng(new TextEncoder().encode("<svg onload=alert(1)></svg>"))).rejects.toThrow(/No es un PNG/);
    const ok = fx("rgb.png");
    await expect(decodePng(ok.subarray(0, ok.length - 400))).rejects.toThrow();
    // una imagen declarada enorme no debe reservar memoria
    const bomba = new Uint8Array(ok);
    new DataView(bomba.buffer).setUint32(16, 100_000);
    new DataView(bomba.buffer).setUint32(20, 100_000);
    await expect(decodePng(bomba)).rejects.toThrow(/grande/);
    expect(MAX_PIXELS).toBeLessThan(100_000 * 100_000);
  });
});

describe("marca de agua en PNG", () => {
  const lienzo = (w: number, h: number): { width: number; height: number; data: Uint8ClampedArray } => {
    const data = new Uint8ClampedArray(w * h * 4);
    for (let i = 0; i < w * h; i++) data.set([200, 140, 100, 255], i * 4); // tono de piel
    return { width: w, height: h, data };
  };
  const cambiados = (a: Uint8ClampedArray, b: Uint8ClampedArray) => {
    let n = 0;
    for (let i = 0; i < a.length; i += 4) if (a[i] !== b[i] || a[i + 1] !== b[i + 1] || a[i + 2] !== b[i + 2]) n++;
    return n / (a.length / 4);
  };

  it("cubre una parte pequeña pero repartida por toda la imagen, sin tocar el canal alfa", () => {
    const r = lienzo(1024, 1536);
    const orig = new Uint8ClampedArray(r.data);
    stampWatermark(r, DEFAULT_STAMP);
    const f = cambiados(orig, r.data);
    expect(f).toBeGreaterThan(0.03); // se nota
    expect(f).toBeLessThan(0.35); // sin tapar la imagen
    for (let i = 3; i < r.data.length; i += 4) expect(r.data[i]).toBe(255);
    // reparto: los cuatro cuartos de la imagen llevan marca
    const cuartos = [[0, 0], [512, 0], [0, 768], [512, 768]].map(([x0, y0]) => {
      const a = new Uint8ClampedArray(512 * 768 * 4);
      const b = new Uint8ClampedArray(512 * 768 * 4);
      for (let y = 0; y < 768; y++) for (let x = 0; x < 512; x++) {
        const s = ((y0! + y) * 1024 + (x0! + x)) * 4;
        a.set(orig.subarray(s, s + 4), (y * 512 + x) * 4);
        b.set(r.data.subarray(s, s + 4), (y * 512 + x) * 4);
      }
      return cambiados(a, b);
    });
    for (const c of cuartos) expect(c).toBeGreaterThan(0.02);
  });

  it("applyWatermark sobre un PNG real devuelve un PNG válido de las mismas dimensiones y distinto del original", async () => {
    const src = fx("rgb.png");
    const out = await applyWatermark({ bytes: src, contentType: "image/png" });
    expect(out.contentType).toBe("image/png");
    const r = await decodePng(out.bytes);
    expect([r.width, r.height]).toEqual([W, H]);
    expect(Buffer.from(out.bytes).equals(Buffer.from(src))).toBe(false);
  });

  it("falla cerrado si la imagen no se puede leer o no es un tipo conocido", async () => {
    await expect(applyWatermark({ bytes: fx("interlaced.png"), contentType: "image/png" })).rejects.toThrow();
    await expect(applyWatermark({ bytes: new Uint8Array([1, 2, 3]), contentType: "image/png" })).rejects.toThrow();
    await expect(applyWatermark({ bytes: new Uint8Array([1, 2, 3]), contentType: "image/gif" })).rejects.toThrow(/no disponible/);
  });
});

describe("máscara para el proveedor de IA", () => {
  it("pasa de blanco/negro pequeño a transparente-donde-se-edita del tamaño de la foto", async () => {
    const { toProviderMask } = await import("@/lib/mask");
    // máscara 8x4: mitad izquierda blanca (zona del tatuaje), mitad derecha negra
    const data = new Uint8ClampedArray(8 * 4 * 4);
    for (let y = 0; y < 4; y++) for (let x = 0; x < 8; x++) data.set(x < 4 ? [255, 255, 255, 255] : [0, 0, 0, 255], (y * 8 + x) * 4);
    const mask = await encodePng({ width: 8, height: 4, data });
    const out = await decodePng(await toProviderMask(mask, 40, 20));
    expect([out.width, out.height]).toEqual([40, 20]);
    expect(at(out, 2, 2)[3]).toBe(0); // blanco → transparente (editar)
    expect(at(out, 19, 10)[3]).toBe(0); // justo antes del borde
    expect(at(out, 20, 10)[3]).toBe(255); // negro → opaco (conservar)
    expect(at(out, 39, 19)[3]).toBe(255);
  });
  it("rechaza tamaños absurdos y máscaras que no son PNG", async () => {
    const { toProviderMask } = await import("@/lib/mask");
    await expect(toProviderMask(new Uint8Array([1, 2, 3]), 10, 10)).rejects.toThrow();
    await expect(toProviderMask(fx("gray.png"), 0, 10)).rejects.toThrow(/no válido/);
    await expect(toProviderMask(fx("gray.png"), 100_000, 100_000)).rejects.toThrow(/no válido/);
  });
});
