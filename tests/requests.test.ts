import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { addUser, setupEnv } from "./helpers";
import { approveRequest, createRequest, listRequests, myLatestRequest, pendingCount, rejectRequest } from "@/lib/studio-requests";
import { createLead, getMembership, updateStudioProfile, requireMember } from "@/lib/studio";
import { one } from "@/lib/db";

const admin = { id: "a1", email: "admin@x.es", role: "admin" as const };
const input = { name: "Tinta Norte", city: "Bilbao", contactEmail: "hola@tintanorte.es", instagram: "@tintanorte", plan: "pro" as const, message: "Somos 5 tatuadores" };
let logs: string[];
let spy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  setupEnv({ ADMIN_EMAILS: "admin@x.es, otro@x.es" });
  const ctx = setupEnv({ ADMIN_EMAILS: "admin@x.es, otro@x.es" });
  ctx.DB.raw.prepare("INSERT INTO users (id, email, role, created_at) VALUES ('a1','admin@x.es','admin',?)").run(Date.now());
  addUser(ctx.DB, "u1", "jefe@tintanorte.es");
  addUser(ctx.DB, "u2", "cliente@x.es");
  logs = [];
  spy = vi.spyOn(console, "log").mockImplementation((...a: unknown[]) => void logs.push(a.join(" ")));
});
afterEach(() => spy.mockRestore());

describe("solicitudes de alta de estudio", () => {
  it("valida los datos y solo admite una solicitud pendiente por usuario", async () => {
    await expect(createRequest({ id: "u1", email: "jefe@tintanorte.es" }, { ...input, name: "x" })).rejects.toThrow(/nombre/);
    await expect(createRequest({ id: "u1", email: "jefe@tintanorte.es" }, { ...input, contactEmail: "no-email" })).rejects.toThrow(/email/);
    await expect(createRequest({ id: "u1", email: "jefe@tintanorte.es" }, { ...input, instagram: "con espacios!" })).rejects.toThrow(/Instagram/);
    await expect(createRequest({ id: "u1", email: "jefe@tintanorte.es" }, { ...input, message: "fotos de desnudos" })).rejects.toThrow(/texto/);
    await createRequest({ id: "u1", email: "jefe@tintanorte.es" }, input);
    await expect(createRequest({ id: "u1", email: "jefe@tintanorte.es" }, input)).rejects.toThrow(/en revisión/);
    expect(await pendingCount()).toBe(1);
    expect((await myLatestRequest("u1"))!.status).toBe("pending");
  });

  it("avisa por email a todos los administradores", async () => {
    await createRequest({ id: "u1", email: "jefe@tintanorte.es" }, input);
    const mails = logs.filter((l) => l.includes("[correo simulado]"));
    expect(mails.some((m) => m.includes("admin@x.es"))).toBe(true);
    expect(mails.some((m) => m.includes("otro@x.es"))).toBe(true);
    expect(mails[0]).toContain("Tinta Norte");
  });

  it("al aprobar se crea el estudio con quien lo pidió como responsable y con sus datos de contacto", async () => {
    const id = await createRequest({ id: "u1", email: "jefe@tintanorte.es" }, input);
    const orgId = await approveRequest(admin, id, "pro");
    const m = await getMembership("u1");
    expect(m).toMatchObject({ orgId, role: "owner", name: "Tinta Norte", city: "Bilbao", plan: "pro", active: true, quota: 300 });
    const org = await one<{ contact_email: string; instagram: string }>("SELECT contact_email, instagram FROM organizations WHERE id = ?", orgId);
    expect(org).toEqual({ contact_email: "hola@tintanorte.es", instagram: "tintanorte" });
    expect(await pendingCount()).toBe(0);
    expect(logs.some((l) => l.includes("jefe@tintanorte.es") && l.includes("ya está en Calco"))).toBe(true);
    // no se puede aprobar dos veces ni rechazar lo ya resuelto
    await expect(approveRequest(admin, id, "pro")).rejects.toThrow(/ya está resuelta/);
    await expect(rejectRequest(admin, id)).rejects.toThrow(/ya está resuelta/);
    // quien ya está en un estudio no puede pedir otro
    await expect(createRequest({ id: "u1", email: "jefe@tintanorte.es" }, input)).rejects.toThrow(/Ya perteneces/);
  });

  it("dos aprobaciones simultáneas crean un solo estudio", async () => {
    const id = await createRequest({ id: "u1", email: "jefe@tintanorte.es" }, input);
    const r = await Promise.allSettled([approveRequest(admin, id, "basic"), approveRequest(admin, id, "basic")]);
    expect(r.filter((x) => x.status === "fulfilled")).toHaveLength(1);
    expect((await one<{ n: number }>("SELECT COUNT(*) AS n FROM organizations"))!.n).toBe(1);
  });

  it("rechazar deja constancia, avisa al solicitante y permite volver a pedir", async () => {
    const id = await createRequest({ id: "u1", email: "jefe@tintanorte.es" }, input);
    await rejectRequest(admin, id, "Faltan datos del estudio");
    expect(logs.some((l) => l.includes("Faltan datos del estudio"))).toBe(true);
    expect((await myLatestRequest("u1"))!.status).toBe("rejected");
    expect(await listRequests("rejected")).toHaveLength(1);
    await createRequest({ id: "u1", email: "jefe@tintanorte.es" }, input); // vuelve a pedir
    expect(await pendingCount()).toBe(1);
  });

  it("si crear el estudio falla, la solicitud vuelve a la cola", async () => {
    const id = await createRequest({ id: "u1", email: "jefe@tintanorte.es" }, input);
    await expect(approveRequest(admin, id, "pro")).resolves.toBeTruthy(); // ok
    const id2 = await createRequest({ id: "u2", email: "cliente@x.es" }, { ...input, name: "Z" + "x".repeat(2) });
    // el usuario de la solicitud desaparece (borrado) → createOrg falla por no encontrar responsable
    (await import("@/lib/db")).db().prepare("UPDATE users SET deleted_at = 1 WHERE id = 'u2'").run();
    await expect(approveRequest(admin, id2, "pro")).rejects.toThrow();
    expect((await listRequests("pending")).map((r) => r.id)).toContain(id2);
  });
});

describe("aviso al estudio cuando un cliente le escribe", () => {
  it("envía un email al contacto del estudio con el mensaje y el email del cliente (que lo aceptó)", async () => {
    const id = await createRequest({ id: "u1", email: "jefe@tintanorte.es" }, input);
    const orgId = await approveRequest(admin, id, "pro");
    await updateStudioProfile(await requireMember("u1"), { listed: true });
    logs.length = 0;
    await createLead({ userId: "u2", orgId, kind: "booking", message: "Quiero reservar el sábado", consent: true });
    const mail = logs.find((l) => l.includes("[correo simulado]"))!;
    expect(mail).toContain("hola@tintanorte.es");
    expect(mail).toContain("cliente@x.es");
    expect(mail).toContain("Quiero reservar el sábado");
  });

  it("sin consentimiento no se envía nada", async () => {
    const id = await createRequest({ id: "u1", email: "jefe@tintanorte.es" }, input);
    const orgId = await approveRequest(admin, id, "pro");
    await updateStudioProfile(await requireMember("u1"), { listed: true });
    logs.length = 0;
    await expect(createLead({ userId: "u2", orgId, kind: "contact", consent: false })).rejects.toThrow();
    expect(logs.filter((l) => l.includes("cliente@x.es"))).toHaveLength(0);
  });
});
