import { beforeEach, describe, expect, it } from "vitest";
import { addUser, setupEnv } from "./helpers";
import { createOrg, dashboard, listOrgs, listUsers, recentLog, updateOrg, userAction } from "@/lib/admin";
import { balance } from "@/lib/credits";
import { all, one, run } from "@/lib/db";
import { DEFAULT_PRICING, getPricing, resetPricing, savePricing } from "@/lib/pricing";
import { handleStripeEvent } from "@/lib/billing";

const admin = { id: "a1", email: "admin@x.es", role: "admin" as const };
let ctx: ReturnType<typeof setupEnv>;

beforeEach(() => {
  ctx = setupEnv();
  ctx.DB.raw.prepare("INSERT INTO users (id, email, role, created_at) VALUES ('a1','admin@x.es','admin',?)").run(Date.now());
  addUser(ctx.DB, "u1", "cliente@x.es");
});

describe("acciones sobre usuarios", () => {
  it("regalar y retirar créditos queda en el registro de auditoría", async () => {
    await userAction(admin, "u1", { action: "credits", amount: 5 });
    await userAction(admin, "u1", { action: "credits", amount: -2 });
    expect(await balance("u1")).toBe(3);
    const log = await recentLog();
    expect(log.map((l) => l.action)).toEqual(["user.credits", "user.credits"]);
    expect(log[0]!.admin_email).toBe("admin@x.es");
    expect(log[0]!.target).toBe("cliente@x.es");
  });

  it("no deja retirar más créditos de los que tiene ni cantidades absurdas", async () => {
    await userAction(admin, "u1", { action: "credits", amount: 2 });
    await expect(userAction(admin, "u1", { action: "credits", amount: -5 })).rejects.toThrow();
    await expect(userAction(admin, "u1", { action: "credits", amount: 0 })).rejects.toThrow();
    await expect(userAction(admin, "u1", { action: "credits", amount: 99999 })).rejects.toThrow();
    expect(await balance("u1")).toBe(2);
  });

  it("bloquear cierra sesiones; el admin no puede bloquearse, ni cambiarse el rol, ni borrar a otro admin", async () => {
    ctx.DB.raw.prepare("INSERT INTO sessions (token_hash, user_id, expires_at, created_at) VALUES ('h','u1',?,?)").run(Date.now() + 1e6, Date.now());
    await userAction(admin, "u1", { action: "ban" });
    expect(await all("SELECT 1 FROM sessions WHERE user_id = 'u1'")).toHaveLength(0);
    expect((await one<{ banned_at: number | null }>("SELECT banned_at FROM users WHERE id = 'u1'"))!.banned_at).not.toBeNull();
    await userAction(admin, "u1", { action: "unban" });
    await expect(userAction(admin, "a1", { action: "ban" })).rejects.toThrow(/ti mismo/);
    await expect(userAction(admin, "a1", { action: "role", role: "user" })).rejects.toThrow();
    addUser(ctx.DB, "a2", "otro-admin@x.es");
    await userAction(admin, "a2", { action: "role", role: "admin" });
    await expect(userAction(admin, "a2", { action: "delete" })).rejects.toThrow(/administrador/);
    await expect(userAction(admin, "a2", { action: "ban" })).rejects.toThrow(/administrador/);
  });

  it("borrar un usuario elimina sus fotos y anonimiza el email", async () => {
    await userAction(admin, "u1", { action: "delete" });
    const u = await one<{ email: string; deleted_at: number | null }>("SELECT email, deleted_at FROM users WHERE id = 'u1'");
    expect(u!.deleted_at).not.toBeNull();
    expect(u!.email).toMatch(/^borrado-/);
    expect((await listUsers()).rows.find((r) => r.id === "u1")).toBeUndefined();
  });

  it("la búsqueda de usuarios no se deja inyectar comodines", async () => {
    expect((await listUsers("%")).rows.length).toBe((await listUsers("")).rows.length);
    expect((await listUsers("cliente")).rows.map((r) => r.email)).toEqual(["cliente@x.es"]);
  });
});

describe("panel: cuentas", () => {
  it("calcula ingresos sin IVA, coste de IA y margen", async () => {
    await run("INSERT INTO purchases (id, user_id, product, amount_cents, status, created_at) VALUES ('p1','u1','credits:pack30',1210,'paid',?)", Date.now());
    await run("INSERT INTO purchases (id, user_id, product, amount_cents, status, created_at) VALUES ('p2','u1','credits:pack10',499,'pending',?)", Date.now());
    await run("INSERT INTO usage_daily (day, jobs_done, jobs_failed, images) VALUES (?, 3, 1, 10)", new Date().toISOString().slice(0, 10));
    const d = await dashboard();
    expect(d.revenue.totalCents).toBe(1210); // lo pendiente no cuenta
    expect(d.revenue.netTotalCents).toBe(1000); // 1210 / 1,21
    expect(d.ai.images).toBe(10);
    expect(d.ai.costCents).toBe(Math.round(10 * DEFAULT_PRICING.aiUnitCostCents));
    expect(d.marginCents).toBe(1000 - d.ai.costCents);
    expect(d.series).toHaveLength(14);
    expect(d.series.at(-1)!.jobs).toBe(3);
    expect(d.series.at(-1)!.revenueCents).toBe(1210);
  });
});

describe("precios editables", () => {
  it("usa los valores por defecto hasta que se guardan otros, y valida lo guardado", async () => {
    expect((await getPricing()).packs).toHaveLength(3);
    await savePricing({ ...DEFAULT_PRICING, freeCredits: 5, packs: [{ id: "mini", credits: 5, priceCents: 299, label: "Mini" }] });
    expect((await getPricing()).freeCredits).toBe(5);
    expect((await getPricing()).packs[0]!.id).toBe("mini");
    await expect(savePricing({ ...DEFAULT_PRICING, packs: [{ id: "MAL ID", credits: 5, priceCents: 299, label: "x" }] })).rejects.toThrow();
    await expect(savePricing({ ...DEFAULT_PRICING, packs: [{ id: "aa", credits: 0, priceCents: 299, label: "x" }] })).rejects.toThrow();
    await resetPricing();
    expect((await getPricing()).packs).toHaveLength(3);
  });

  it("un pago iniciado con el precio antiguo se abona aunque el pack haya cambiado", async () => {
    await run("INSERT INTO purchases (id, user_id, product, amount_cents, stripe_session_id, status, meta, created_at) VALUES ('p','u1','credits:old',499,'cs_old','pending',?,?)", JSON.stringify({ credits: "10" }), Date.now());
    await savePricing({ ...DEFAULT_PRICING, packs: [{ id: "nuevo", credits: 99, priceCents: 999, label: "Nuevo" }] });
    await handleStripeEvent({
      id: "evt_old",
      type: "checkout.session.completed",
      data: { object: { id: "cs_old", payment_status: "paid", client_reference_id: "u1", metadata: { kind: "credits", packId: "old" }, mode: "payment" } },
    });
    expect(await balance("u1")).toBe(10);
  });
});

describe("estudios", () => {
  it("crear un estudio exige un responsable con cuenta y activa el plan elegido", async () => {
    await expect(createOrg(admin, { name: "Tinta Sur", city: "Sevilla", ownerEmail: "nadie@x.es", plan: "pro" })).rejects.toThrow(/cuenta/);
    const id = await createOrg(admin, { name: "Tinta Sur", city: "Sevilla", ownerEmail: "cliente@x.es", plan: "premium" });
    const [org] = await listOrgs();
    expect(org).toMatchObject({ id, plan: "premium", subscription_status: "active", listed: 1, featured: 1, members: 1 });
    await updateOrg(admin, id, { monthlyQuota: 50, featured: false });
    expect((await listOrgs())[0]).toMatchObject({ monthly_quota: 50, featured: 0 });
    await updateOrg(admin, id, { plan: "none" });
    expect((await listOrgs())[0]).toMatchObject({ plan: "none", subscription_status: "inactive", monthly_quota: 0 });
    expect((await recentLog()).map((l) => l.action)).toContain("org.create");
  });
});
