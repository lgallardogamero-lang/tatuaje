import { beforeEach, describe, expect, it } from "vitest";
import { addUser, setupEnv, tinyJpeg } from "./helpers";
import { addFlash, addMember, createLead, deleteFlash, directory, getMembership, overview, removeMember, requireMember, updateStudioProfile } from "@/lib/studio";
import { createOrg, updateOrg } from "@/lib/admin";
import { createJob, processJob, refundJob } from "@/lib/jobs";
import { all, one, run } from "@/lib/db";
import type { JobOptions } from "@/lib/schema";

const admin = { id: "a1", email: "admin@x.es", role: "admin" as const };
const options: JobOptions = { zone: "brazo", description: "rosa", style: "old-school", color: "color", size: "mediano", hasReference: false, placement: { x: 0.5, y: 0.5, scale: 0.4, rotation: 0, opacity: 0.9 } };
let ctx: ReturnType<typeof setupEnv>;
let orgId: string;

async function waitDone(id: string) {
  for (let i = 0; i < 100; i++) {
    const j = await one<{ status: string }>("SELECT status FROM jobs WHERE id = ?", id);
    if (j && !["queued", "running"].includes(j.status)) return j.status;
    await new Promise((r) => setTimeout(r, 30));
  }
  throw new Error("no terminó");
}

beforeEach(async () => {
  ctx = setupEnv();
  ctx.DB.raw.prepare("INSERT INTO users (id, email, role, created_at) VALUES ('a1','admin@x.es','admin',?)").run(Date.now());
  addUser(ctx.DB, "owner", "jefe@estudio.es");
  addUser(ctx.DB, "artist", "tatuador@estudio.es");
  addUser(ctx.DB, "client", "cliente@x.es");
  orgId = await createOrg(admin, { name: "Tinta Sur", city: "Sevilla", ownerEmail: "jefe@estudio.es", plan: "basic" });
});

describe("miembros", () => {
  it("el responsable añade y quita tatuadores; un tatuador no puede", async () => {
    const owner = await requireMember("owner", true);
    await addMember(owner, "Tatuador@Estudio.es");
    expect((await overview(orgId)).members.map((m) => m.role).sort()).toEqual(["artist", "owner"]);
    await expect(addMember(owner, "tatuador@estudio.es")).rejects.toThrow(/Ya forma parte/);
    await expect(addMember(owner, "nadie@x.es")).rejects.toThrow(/no tiene cuenta/);
    const artist = await requireMember("artist");
    await expect(addMember(artist, "cliente@x.es")).rejects.toThrow(/Solo el responsable/);
    await expect(requireMember("artist", true)).rejects.toThrow(/Solo el responsable/);
    await expect(removeMember(owner, "owner")).rejects.toThrow(/responsable/);
    await removeMember(owner, "artist");
    expect(await getMembership("artist")).toBeNull();
    await expect(requireMember("client")).rejects.toThrow(/ningún estudio/);
  });
});

describe("catálogo de flash", () => {
  it("valida la imagen, guarda en R2 y borra ambos al eliminar", async () => {
    const m = await requireMember("owner");
    await expect(addFlash(m, { name: "x", bytes: new TextEncoder().encode("<svg onload=alert(1)>") })).rejects.toThrow();
    await expect(addFlash(m, { name: "", bytes: tinyJpeg })).rejects.toThrow();
    const id = await addFlash(m, { name: "Rosa clásica", style: "old-school", bytes: tinyJpeg });
    expect(ctx.BUCKET.store.size).toBe(1);
    expect((await overview(orgId)).flash).toHaveLength(1);
    // otro estudio no puede borrar este diseño
    const other = await createOrg(admin, { name: "Otro", city: "Madrid", ownerEmail: "tatuador@estudio.es", plan: "pro" });
    await expect(deleteFlash((await requireMember("artist")), id)).rejects.toThrow(/no encontrado/);
    expect(other).toBeTruthy();
    await deleteFlash(m, id);
    expect(ctx.BUCKET.store.size).toBe(0);
  });
});

describe("modo estudio: cupo mensual", () => {
  it("cobra del cupo del estudio, no de los créditos del usuario, y devuelve al fallar o cancelar", async () => {
    await updateOrg(admin, orgId, { monthlyQuota: 2 });
    const photo = { bytes: tinyJpeg, contentType: "image/jpeg" };
    const j1 = await createJob({ userId: "owner", orgId, options, photo });
    expect(await waitDone(j1)).toBe("done");
    expect((await one<{ variants: number }>("SELECT variants FROM jobs WHERE id = ?", j1))!.variants).toBe(3); // el estudio recibe las 3 variantes
    expect((await overview(orgId)).org.used).toBe(1);
    expect(await all("SELECT 1 FROM credit_ledger WHERE user_id = 'owner'")).toHaveLength(0);

    ctx.env.QUEUE_MODE = "manual";
    const j2 = await createJob({ userId: "owner", orgId, options, photo });
    expect((await overview(orgId)).org.used).toBe(2);
    await expect(createJob({ userId: "owner", orgId, options, photo })).rejects.toThrow(/agotado/);
    await refundJob(j2);
    await refundJob(j2); // idempotente
    expect((await overview(orgId)).org.used).toBe(1);
  });

  it("un estudio sin suscripción activa no puede generar", async () => {
    await updateOrg(admin, orgId, { status: "inactive" });
    await expect(createJob({ userId: "owner", orgId, options, photo: { bytes: tinyJpeg, contentType: "image/jpeg" } })).rejects.toThrow(/suscripción activa/);
  });

  it("generar con un diseño del catálogo no gasta imágenes de IA para el diseño", async () => {
    const m = await requireMember("owner");
    const flashId = await addFlash(m, { name: "Rosa", bytes: tinyJpeg });
    // el catálogo usa el diseño tal cual (aquí un JPEG mínimo; el proveedor simulado lo compone igual)
    const id = await createJob({ userId: "owner", orgId, options: { ...options, description: "", flashId }, photo: { bytes: tinyJpeg, contentType: "image/jpeg" } });
    expect(await waitDone(id)).toBe("done");
    expect((await one<{ images: number }>("SELECT images FROM jobs WHERE id = ?", id))!.images).toBe(3);
    expect((await one<{ tried_count: number }>("SELECT tried_count FROM flash_designs WHERE id = ?", flashId))!.tried_count).toBe(1);
  });
});

describe("directorio y contactos", () => {
  it("solo aparecen estudios activos y visibles, destacados primero", async () => {
    expect((await directory()).studios).toHaveLength(0); // basic no se lista solo
    await updateStudioProfile(await requireMember("owner"), { listed: true });
    const d = await directory();
    expect(d.studios.map((s) => s.name)).toEqual(["Tinta Sur"]);
    expect(d.cities).toEqual([{ city: "Sevilla", slug: "sevilla", count: 1 }]);
    expect((await directory("madrid")).studios).toHaveLength(0);
    await updateOrg(admin, orgId, { status: "inactive" });
    expect((await directory()).studios).toHaveLength(0);
  });

  it("no se puede listar sin plan activo", async () => {
    await updateOrg(admin, orgId, { status: "inactive" });
    await expect(updateStudioProfile(await requireMember("owner"), { listed: true })).rejects.toThrow(/plan activo/);
  });

  it("el contacto exige consentimiento, se registra y tiene límites", async () => {
    await updateStudioProfile(await requireMember("owner"), { listed: true });
    await expect(createLead({ userId: "client", orgId, kind: "contact", consent: false })).rejects.toThrow(/aceptar compartir/);
    const id = await createLead({ userId: "client", orgId, kind: "contact", message: "Quiero este diseño en el antebrazo", consent: true });
    expect(id).toBeTruthy();
    await expect(createLead({ userId: "client", orgId, kind: "contact", consent: true })).rejects.toThrow(/Ya has contactado/);
    const o = await overview(orgId);
    expect(o.leadsTotal).toBe(1);
    expect(o.leads[0]).toMatchObject({ email: "cliente@x.es", kind: "contact" });
    expect((await one<{ consent_at: number }>("SELECT consent_at FROM leads WHERE id = ?", id))!.consent_at).toBeGreaterThan(0);
    await expect(createLead({ userId: "client", orgId: "no-existe", kind: "contact", consent: true })).rejects.toThrow(/no está disponible/);
  });

  it("rechaza mensajes con contenido no permitido y pruebas ajenas", async () => {
    await updateStudioProfile(await requireMember("owner"), { listed: true });
    await expect(createLead({ userId: "client", orgId, kind: "contact", message: "foto desnuda", consent: true })).rejects.toThrow(/mensaje/);
    await run("INSERT INTO jobs (id, user_id, status, options, created_at, updated_at, expires_at) VALUES ('j','owner','done','{}',?,?,?)", Date.now(), Date.now(), Date.now() + 1e6);
    await expect(createLead({ userId: "client", orgId, jobId: "j", kind: "booking", consent: true })).rejects.toThrow(/no es tuya/);
  });
});

describe("perfil del estudio", () => {
  it("valida ciudad, email e Instagram", async () => {
    const m = await requireMember("owner");
    await expect(updateStudioProfile(m, { contactEmail: "no-es-email" })).rejects.toThrow();
    await expect(updateStudioProfile(m, { instagram: "con espacios!" })).rejects.toThrow();
    await updateStudioProfile(m, { contactEmail: "hola@tintasur.es", instagram: "@tintasur", city: "Córdoba" });
    const o = (await overview(orgId)).org;
    expect(o).toMatchObject({ contact_email: "hola@tintasur.es", instagram: "tintasur", city: "Córdoba" });
    await addMember(m, "tatuador@estudio.es");
    await expect(updateStudioProfile(await requireMember("artist"), { city: "Madrid" })).rejects.toThrow(/responsable/);
  });
});

describe("marca blanca", () => {
  it("rechaza colores ilegibles o con formato incorrecto y acepta los claros", async () => {
    const { checkBrandColor, contrast } = await import("@/lib/color");
    expect(checkBrandColor("rojo").ok).toBe(false);
    expect(checkBrandColor("#000000").ok).toBe(false); // negro: se confunde con el fondo
    expect(checkBrandColor("#2a3a8f").ok).toBe(false); // azul oscuro: el texto del botón no se lee
    expect(checkBrandColor("#a58bff").ok).toBe(true); // el violeta de la marca
    expect(checkBrandColor("#ffb347").ok).toBe(true);
    expect(contrast("#ffffff", "#000000")).toBeCloseTo(21, 0);
    const m = await requireMember("owner");
    await expect(updateStudioProfile(m, { accentColor: "#111111" })).rejects.toThrow(/oscuro|fondo/);
    await updateStudioProfile(m, { accentColor: "#FFB347" });
    expect((await overview(orgId)).org.accent_color).toBe("#ffb347");
    await addMember(m, "tatuador@estudio.es");
    await expect(updateStudioProfile(await requireMember("artist"), { accentColor: "#ffb347" })).rejects.toThrow(/responsable/);
  });

  it("el logo solo admite imágenes pequeñas reales (nunca SVG) y se puede quitar", async () => {
    const { setLogo, removeLogo, logoOf, MAX_LOGO_BYTES } = await import("@/lib/studio");
    const m = await requireMember("owner");
    await expect(setLogo(m, new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"></svg>'))).rejects.toThrow();
    await expect(setLogo(m, new Uint8Array(MAX_LOGO_BYTES + 1))).rejects.toThrow(/pesa demasiado/);
    await setLogo(m, tinyJpeg);
    expect(ctx.BUCKET.store.has(`org/${orgId}/logo`)).toBe(true);
    expect((await overview(orgId)).org.has_logo).toBe(true);
    expect(await logoOf(orgId)).not.toBeNull();
    await addMember(m, "tatuador@estudio.es");
    await expect(setLogo(await requireMember("artist"), tinyJpeg)).rejects.toThrow(/responsable/);
    await removeLogo(m);
    expect(ctx.BUCKET.store.has(`org/${orgId}/logo`)).toBe(false);
    expect((await overview(orgId)).org.has_logo).toBe(false);
  });
});

describe("página pública del estudio", () => {
  it("solo se muestra si el estudio está activo y en el directorio", async () => {
    const { publicStudio } = await import("@/lib/studio");
    expect(await publicStudio("sevilla")).toBeNull();
    const [row] = await all<{ slug: string }>("SELECT slug FROM organizations WHERE id = ?", orgId);
    expect(await publicStudio(row!.slug)).toBeNull(); // existe pero no está en el directorio
    await updateStudioProfile(await requireMember("owner"), { listed: true, instagram: "tintasur", accentColor: "#ffb347" });
    expect(await publicStudio(row!.slug)).toMatchObject({ id: orgId, name: "Tinta Sur", city: "Sevilla", instagram: "tintasur", accent: "#ffb347", hasLogo: false });
    await updateOrg(admin, orgId, { status: "inactive" });
    expect(await publicStudio(row!.slug)).toBeNull(); // sin plan activo desaparece
    expect(await publicStudio("no-existe")).toBeNull();
  });
});
