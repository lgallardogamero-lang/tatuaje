import { beforeEach, describe, expect, it } from "vitest";
import { addUser, setupEnv, tinyJpeg } from "./helpers";
import { handleQueue, handleScheduled } from "@/lib/worker-handlers";
import { addPurchaseCredits } from "@/lib/credits";
import { createJob } from "@/lib/jobs";
import { setTestEnv } from "@/lib/env";
import { all, one, run } from "@/lib/db";
import type { JobOptions } from "@/lib/schema";

const options: JobOptions = { zone: "brazo", description: "rosa", style: "old-school", color: "color", size: "mediano", hasReference: false, placement: { x: 0.5, y: 0.5, scale: 0.4, rotation: 0, opacity: 0.9 } };
let ctx: ReturnType<typeof setupEnv>;
const waits: Promise<unknown>[] = [];
const fakeCtx = { waitUntil: (p: Promise<unknown>) => void waits.push(p) };

beforeEach(() => {
  ctx = setupEnv();
  addUser(ctx.DB);
});

describe("consumidor de la cola", () => {
  it("procesa los trabajos aunque no haya contexto de petición web, y reconoce el mensaje", async () => {
    await addPurchaseCredits("u1", 1, "cs_1");
    ctx.env.QUEUE_MODE = "queue"; // el trabajo se encola y NO se procesa solo
    const sent: { jobId: string }[] = [];
    ctx.env.JOBS = { send: async (m: { jobId: string }) => void sent.push(m) } as never;
    const id = await createJob({ userId: "u1", options, photo: { bytes: tinyJpeg, contentType: "image/jpeg" } });
    expect(sent).toEqual([{ jobId: id }]);
    expect((await one<{ status: string }>("SELECT status FROM jobs WHERE id = ?", id))!.status).toBe("queued");

    const env = ctx.env;
    setTestEnv(null); // fuera de una petición web: solo `withEnv` proporciona el entorno
    let acked = 0;
    await handleQueue({ messages: [{ body: { jobId: id }, ack: () => acked++, retry: () => { throw new Error("no debería reintentar"); } }] }, env, fakeCtx);
    setTestEnv(env);
    expect(acked).toBe(1);
    expect((await one<{ status: string }>("SELECT status FROM jobs WHERE id = ?", id))!.status).toBe("done");
  });

  it("procesar dos veces el mismo mensaje no duplica el trabajo ni el coste", async () => {
    await addPurchaseCredits("u1", 1, "cs_1");
    ctx.env.QUEUE_MODE = "manual";
    const id = await createJob({ userId: "u1", options, photo: { bytes: tinyJpeg, contentType: "image/jpeg" } });
    const msg = { body: { jobId: id }, ack: () => {}, retry: () => {} };
    await handleQueue({ messages: [msg, msg] }, ctx.env, fakeCtx);
    expect((await all("SELECT 1 FROM assets WHERE job_id = ? AND kind = 'variant'", id)).length).toBe(3); // 3 variantes (ha comprado créditos), una sola vez
    expect((await one<{ jobs_done: number }>("SELECT jobs_done FROM usage_daily"))!.jobs_done).toBe(1);
  });
});

describe("tarea horaria", () => {
  it("borra lo caducado", async () => {
    await run("INSERT INTO jobs (id, user_id, status, options, created_at, updated_at, expires_at) VALUES ('j','u1','done','{}',?,?,?)", Date.now(), Date.now(), Date.now() - 1000);
    await run("INSERT INTO magic_links (token_hash, email, expires_at, created_at) VALUES ('t','a@b.co',?,?)", Date.now() - 3 * 86400_000, Date.now() - 3 * 86400_000);
    const r = await handleScheduled(ctx.env, fakeCtx);
    expect(r.purgedJobs).toBe(1);
    expect(await all("SELECT 1 FROM jobs")).toHaveLength(0);
    expect(await all("SELECT 1 FROM magic_links")).toHaveLength(0);
  });
});
