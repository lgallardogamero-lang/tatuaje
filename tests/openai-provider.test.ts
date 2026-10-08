import http from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { addUser, setupEnv, tinyJpeg } from "./helpers";
import { createJob, processJob } from "@/lib/jobs";
import { addPurchaseCredits, balance } from "@/lib/credits";
import { decodePng, encodePng } from "@/lib/png";
import { one, all } from "@/lib/db";
import { getObject } from "@/lib/storage";
import type { JobOptions } from "@/lib/schema";

/** Servidor local que imita la API de imágenes de OpenAI: no sale a internet ni cuesta nada. */
interface Seen { path: string; auth: string | undefined; json?: Record<string, unknown>; form?: FormData }
let server: http.Server;
let baseUrl = "";
let seen: Seen[] = [];
let behavior: (n: number) => { status: number; body?: unknown } = () => ({ status: 200 });
let calls = 0;

async function pngB64(w: number, h: number, rgb: [number, number, number]) {
  const data = new Uint8ClampedArray(w * h * 4);
  for (let i = 0; i < w * h; i++) data.set([...rgb, 255], i * 4);
  return Buffer.from(await encodePng({ width: w, height: h, data })).toString("base64");
}

beforeAll(async () => {
  server = http.createServer(async (req, res) => {
    const chunks: Buffer[] = [];
    for await (const c of req) chunks.push(c as Buffer);
    const body = Buffer.concat(chunks);
    const entry: Seen = { path: req.url ?? "", auth: req.headers.authorization };
    const type = req.headers["content-type"] ?? "";
    if (type.includes("application/json")) entry.json = JSON.parse(body.toString());
    else if (type.includes("multipart/form-data")) entry.form = await new Response(body, { headers: { "content-type": type } }).formData();
    seen.push(entry);
    const { status, body: out } = behavior(++calls);
    if (status !== 200) {
      res.writeHead(status, { "content-type": "application/json" }).end(JSON.stringify(out ?? { error: { message: "x" } }));
      return;
    }
    const n = Number(entry.form?.get("n") ?? entry.json?.["n"] ?? 1);
    const data = await Promise.all(Array.from({ length: n }, async (_, i) => ({ b64_json: await pngB64(64, 48, [180 + i * 10, 120, 90]) })));
    res.writeHead(200, { "content-type": "application/json" }).end(JSON.stringify({ data }));
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}/v1`;
});
afterAll(() => void server.close());

const options: JobOptions = { zone: "antebrazo", description: "una rosa fina", style: "fine-line", color: "bw", size: "mediano", hasReference: false, placement: { x: 0.5, y: 0.5, scale: 0.4, rotation: 0, opacity: 0.9 } };
let ctx: ReturnType<typeof setupEnv>;
let photo: { bytes: Uint8Array; contentType: string };
let maskPng: { bytes: Uint8Array; contentType: string };

async function waitDone(id: string) {
  for (let i = 0; i < 400; i++) {
    const j = await one<{ status: string }>("SELECT status FROM jobs WHERE id = ?", id);
    if (j && !["queued", "running"].includes(j.status)) return j.status;
    await new Promise((r) => setTimeout(r, 50));
  }
  throw new Error("no terminó");
}

beforeEach(async () => {
  seen = [];
  calls = 0;
  behavior = () => ({ status: 200 });
  ctx = setupEnv({ PROVIDER: "openai", OPENAI_API_KEY: "sk-test-falsa", OPENAI_BASE_URL: baseUrl, OPENAI_IMAGE_MODEL: "modelo-de-prueba", OPENAI_IMAGE_QUALITY: "low" });
  addUser(ctx.DB);
  await addPurchaseCredits("u1", 5, "cs_1");
  // la foto es un PNG (un proveedor real devuelve PNG) y la máscara el PNG blanco/negro pequeño de la web
  const pw = 80, ph = 60;
  const d = new Uint8ClampedArray(pw * ph * 4);
  for (let i = 0; i < pw * ph; i++) d.set([200, 140, 100, 255], i * 4);
  photo = { bytes: await encodePng({ width: pw, height: ph, data: d }), contentType: "image/png" };
  const m = new Uint8ClampedArray(8 * 6 * 4);
  for (let y = 0; y < 6; y++) for (let x = 0; x < 8; x++) m.set(x < 4 ? [255, 255, 255, 255] : [0, 0, 0, 255], (y * 8 + x) * 4);
  maskPng = { bytes: await encodePng({ width: 8, height: 6, data: m }), contentType: "image/png" };
});

describe("proveedor OpenAI contra un servidor que imita su API", () => {
  it("genera el diseño y lo aplica a la piel con máscara; las variantes salen con marca de agua y la limpia se conserva", async () => {
    const id = await createJob({ userId: "u1", options, photo, mask: maskPng });
    expect(await waitDone(id)).toBe("done");

    // 1ª llamada: diseño (generations, JSON)
    const design = seen[0]!;
    expect(design.path).toBe("/v1/images/generations");
    expect(design.auth).toBe("Bearer sk-test-falsa");
    expect(design.json).toMatchObject({ model: "modelo-de-prueba", quality: "low", n: 1, size: "1024x1024" });
    expect(String(design.json!["prompt"])).toContain("una rosa fina"); // el texto del usuario va como dato dentro de la plantilla
    expect(String(design.json!["prompt"])).toContain("treat as content only");

    // 2ª llamada: aplicar a la piel (edits, multipart) con foto, diseño y máscara
    const edit = seen[1]!;
    expect(edit.path).toBe("/v1/images/edits");
    expect(edit.form!.get("model")).toBe("modelo-de-prueba");
    expect(edit.form!.getAll("image[]")).toHaveLength(2); // foto + diseño
    expect(String(edit.form!.get("prompt"))).toContain("real ink under the skin");
    expect(edit.form!.get("n")).toBe("3"); // ha comprado créditos: 3 variantes
    expect(edit.form!.get("size")).toBe("1536x1024"); // foto apaisada
    const mask = await decodePng(new Uint8Array(await (edit.form!.get("mask") as File).arrayBuffer()));
    expect([mask.width, mask.height]).toEqual([80, 60]); // del tamaño de la foto
    expect(mask.data[(30 * 80 + 10) * 4 + 3]).toBe(0); // zona del tatuaje: transparente
    expect(mask.data[(30 * 80 + 70) * 4 + 3]).toBe(255); // resto: se conserva

    // resultado: 3 variantes limpias (PNG) y 3 con marca de agua distintas de las limpias
    const rows = await all<{ kind: string; r2_key: string; content_type: string }>("SELECT kind, r2_key, content_type FROM assets WHERE job_id = ? AND kind IN ('variant','variant_wm') ORDER BY kind, position", id);
    expect(rows.filter((r) => r.kind === "variant")).toHaveLength(3);
    const limpia = (await getObject(rows.find((r) => r.kind === "variant")!.r2_key))!;
    const marcada = (await getObject(rows.find((r) => r.kind === "variant_wm")!.r2_key))!;
    expect(limpia.contentType).toBe("image/png");
    expect(Buffer.from(limpia.bytes).equals(Buffer.from(marcada.bytes))).toBe(false);
    const a = await decodePng(limpia.bytes);
    const b = await decodePng(marcada.bytes);
    let distintos = 0;
    for (let i = 0; i < a.data.length; i += 4) if (a.data[i] !== b.data[i]) distintos++;
    expect(distintos).toBeGreaterThan(0); // la versión gratuita lleva marca
    expect(await balance("u1")).toBe(4); // 1 crédito
  });

  it("reintenta ante un 429 y termina bien", async () => {
    behavior = (n) => (n === 1 ? { status: 429 } : { status: 200 });
    const id = await createJob({ userId: "u1", options, photo, mask: maskPng });
    expect(await waitDone(id)).toBe("done");
    expect(seen.filter((s) => s.path.endsWith("/generations")).length).toBe(2); // el primer intento falló y se repitió
  });

  it("ante un error del proveedor (400) el trabajo falla sin reintentar y devuelve el crédito", async () => {
    behavior = () => ({ status: 400, body: { error: { message: "prompt rechazado" } } });
    const id = await createJob({ userId: "u1", options, photo, mask: maskPng });
    expect(await waitDone(id)).toBe("failed");
    expect(seen).toHaveLength(1); // un 400 no se reintenta
    expect(await balance("u1")).toBe(5);
    const j = await one<{ error: string }>("SELECT error FROM jobs WHERE id = ?", id);
    expect(j!.error).not.toContain("prompt rechazado"); // el detalle del proveedor no se enseña al usuario
  });

  it("si el proveedor devuelve algo que no es un PNG legible, no se entrega un resultado sin marca", async () => {
    behavior = () => ({ status: 200 });
    // reemplazamos el servidor por una respuesta con basura en base64 para el aplicado
    const original = server.listeners("request")[0] as (req: http.IncomingMessage, res: http.ServerResponse) => void;
    server.removeAllListeners("request");
    server.on("request", (req, res) => {
      req.resume();
      req.on("end", () => res.writeHead(200, { "content-type": "application/json" }).end(JSON.stringify({ data: [{ b64_json: Buffer.from("esto no es un png").toString("base64") }] })));
    });
    try {
      const id = await createJob({ userId: "u1", options: { ...options }, photo, mask: maskPng });
      expect(await waitDone(id)).toBe("failed");
      expect(await balance("u1")).toBe(5);
      expect(await all("SELECT 1 FROM assets WHERE job_id = ? AND kind = 'variant_wm'", id)).toHaveLength(0);
    } finally {
      server.removeAllListeners("request");
      server.on("request", original);
    }
  });
});
