import { beforeEach, describe, expect, it } from "vitest";
import { addUser, setupEnv, tinyJpeg } from "./helpers";
import { addPurchaseCredits, balance, refund, spend } from "@/lib/credits";
import { createJob, processJob, cancelJob, NoCreditsError, purgeExpired } from "@/lib/jobs";
import { one, all, run } from "@/lib/db";
import type { JobOptions } from "@/lib/schema";

const options: JobOptions = {
  zone: "antebrazo",
  description: "un lobo geométrico",
  style: "geometrico",
  color: "bw",
  size: "mediano",
  hasReference: false,
  placement: { x: 0.5, y: 0.5, scale: 0.4, rotation: 0, opacity: 0.9 },
};
const photo = { bytes: tinyJpeg, contentType: "image/jpeg" };

async function waitDone(id: string) {
  for (let i = 0; i < 100; i++) {
    const j = await one<{ status: string }>("SELECT status FROM jobs WHERE id = ?", id);
    if (j && !["queued", "running"].includes(j.status)) return j.status;
    await new Promise((r) => setTimeout(r, 30));
  }
  throw new Error("el trabajo no terminó");
}

let ctx: ReturnType<typeof setupEnv>;
beforeEach(() => {
  ctx = setupEnv();
  addUser(ctx.DB);
});

describe("libro de créditos", () => {
  it("no permite gastar más de lo que hay", async () => {
    await addPurchaseCredits("u1", 1, "cs_1");
    expect(await spend("u1", 1, "generation", "j1")).toBe(true);
    expect(await spend("u1", 1, "generation", "j2")).toBe(false);
    expect(await balance("u1")).toBe(0);
  });

  it("es idempotente al abonar compras y reembolsos", async () => {
    expect(await addPurchaseCredits("u1", 10, "cs_1")).toBe(true);
    expect(await addPurchaseCredits("u1", 10, "cs_1")).toBe(false);
    expect(await balance("u1")).toBe(10);
    await spend("u1", 1, "generation", "j1");
    expect(await refund("u1", 1, "j1")).toBe(true);
    expect(await refund("u1", 1, "j1")).toBe(false);
    expect(await balance("u1")).toBe(10);
  });

  it("dos gastos concurrentes con saldo 1 solo cobran uno", async () => {
    await addPurchaseCredits("u1", 1, "cs_1");
    const r = await Promise.all([spend("u1", 1, "generation", "ja"), spend("u1", 1, "generation", "jb")]);
    expect(r.filter(Boolean)).toHaveLength(1);
    expect(await balance("u1")).toBe(0);
  });
});

describe("trabajos", () => {
  it("quien ya ha comprado créditos recibe 3 variantes con marca de agua y se cobra 1 crédito", async () => {
    await addPurchaseCredits("u1", 3, "cs_1");
    const id = await createJob({ userId: "u1", options, photo });
    expect(await waitDone(id)).toBe("done");
    const kinds = await all<{ kind: string }>("SELECT kind FROM assets WHERE job_id = ? ORDER BY kind", id);
    expect(kinds.filter((k) => k.kind === "variant")).toHaveLength(3);
    expect(kinds.filter((k) => k.kind === "variant_wm")).toHaveLength(3);
    const wm = await one<{ r2_key: string }>("SELECT r2_key FROM assets WHERE job_id = ? AND kind = 'variant_wm'", id);
    const text = new TextDecoder().decode(ctx.BUCKET.store.get(wm!.r2_key)!.bytes);
    expect(text).toContain("Vista previa");
    expect(await balance("u1")).toBe(2);
  });

  it("las pruebas gratuitas generan una sola variante", async () => {
    ctx.DB.raw.prepare("INSERT INTO credit_ledger (id, user_id, delta, reason, ref, created_at) VALUES ('g','u1',3,'free_grant','u1',?)").run(Date.now());
    const id = await createJob({ userId: "u1", options, photo });
    expect(await waitDone(id)).toBe("done");
    const rows = await all<{ kind: string }>("SELECT kind FROM assets WHERE job_id = ? AND kind = 'variant_wm'", id);
    expect(rows).toHaveLength(1);
    expect(await balance("u1")).toBe(2);
  });

  it("rechaza si no hay créditos y no deja un trabajo a medias", async () => {
    await expect(createJob({ userId: "u1", options, photo })).rejects.toBeInstanceOf(NoCreditsError);
    expect(await all("SELECT 1 FROM jobs")).toHaveLength(0);
  });

  it("cancelar devuelve el crédito una sola vez", async () => {
    await addPurchaseCredits("u1", 1, "cs_1");
    ctx.env.QUEUE_MODE = "manual"; // sin procesamiento automático
    const id = await createJob({ userId: "u1", options, photo });
    expect(await balance("u1")).toBe(0);
    expect(await cancelJob(id, "u1")).toBe(true);
    expect(await cancelJob(id, "u1")).toBe(false);
    expect(await balance("u1")).toBe(1);
  });

  it("si el proveedor falla, el trabajo falla y se reembolsa", async () => {
    await addPurchaseCredits("u1", 1, "cs_1");
    ctx.env.QUEUE_MODE = "manual";
    const id = await createJob({ userId: "u1", options, photo });
    // Foto corrupta en el almacén => el procesado lanza y debe reembolsar
    const a = await one<{ r2_key: string }>("SELECT r2_key FROM assets WHERE job_id = ? AND kind = 'photo'", id);
    ctx.BUCKET.store.delete(a!.r2_key);
    await processJob(id);
    const job = await one<{ status: string; error: string }>("SELECT status, error FROM jobs WHERE id = ?", id);
    expect(job?.status).toBe("failed");
    expect(await balance("u1")).toBe(1);
  });

  it("purgeExpired borra las fotos subidas tras 24 h y conserva el resto hasta caducar", async () => {
    await addPurchaseCredits("u1", 1, "cs_1");
    const id = await createJob({ userId: "u1", options, photo });
    expect(await waitDone(id)).toBe("done");
    await run("UPDATE assets SET created_at = ? WHERE job_id = ?", Date.now() - 25 * 3600_000, id);
    await purgeExpired();
    const left = await all<{ kind: string }>("SELECT kind FROM assets WHERE job_id = ?", id);
    expect(left.some((a) => a.kind === "photo")).toBe(false);
    expect(left.some((a) => a.kind === "variant")).toBe(true);
    await run("UPDATE jobs SET expires_at = ? WHERE id = ?", Date.now() - 1000, id);
    await purgeExpired();
    expect(await all("SELECT 1 FROM jobs WHERE id = ?", id)).toHaveLength(0);
    expect(ctx.BUCKET.store.size).toBe(0);
  });
});
