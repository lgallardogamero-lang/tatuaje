import { beforeEach, describe, expect, it } from "vitest";
import { addUser, setupEnv, tinyJpeg } from "./helpers";
import { balance } from "@/lib/credits";
import { grantEntitlement, handleStripeEvent, hasEntitlement, unlockWithCredits } from "@/lib/billing";
import { verifyStripeSignature } from "@/lib/stripe";
import { hmacHex } from "@/lib/ids";
import { all, one, run } from "@/lib/db";

let ctx: ReturnType<typeof setupEnv>;
beforeEach(() => {
  ctx = setupEnv();
  addUser(ctx.DB);
});

const ev = (id: string, session = "cs_1", meta: Record<string, string> = { kind: "credits", packId: "pack10" }) => ({
  id,
  type: "checkout.session.completed",
  data: { object: { id: session, payment_status: "paid", client_reference_id: "u1", metadata: meta, mode: "payment" } },
});

describe("webhook de Stripe", () => {
  it("suma créditos una sola vez aunque el evento llegue repetido o con otro id", async () => {
    expect(await handleStripeEvent(ev("evt_1"))).toBe("processed");
    expect(await handleStripeEvent(ev("evt_1"))).toBe("duplicate");
    await handleStripeEvent(ev("evt_2")); // misma sesión, otro evento
    expect(await balance("u1")).toBe(10);
  });

  it("no se fía de la cantidad que venga en los metadatos", async () => {
    await handleStripeEvent(ev("evt_1", "cs_x", { kind: "credits", packId: "pack10", credits: "9999" }));
    expect(await balance("u1")).toBe(10);
  });

  it("ignora pagos no completados", async () => {
    const e = ev("evt_3");
    (e.data.object as Record<string, unknown>)["payment_status"] = "unpaid";
    expect(await handleStripeEvent(e)).toBe("ignored");
    expect(await balance("u1")).toBe(0);
  });
});

describe("firma de Stripe", () => {
  it("acepta la firma válida y rechaza manipulaciones o repeticiones tardías", async () => {
    const body = '{"id":"evt"}';
    const t = 1_700_000_000;
    const sig = await hmacHex("whsec_x", `${t}.${body}`);
    expect(await verifyStripeSignature(body, `t=${t},v1=${sig}`, "whsec_x", t + 10)).toBe(true);
    expect(await verifyStripeSignature(body + " ", `t=${t},v1=${sig}`, "whsec_x", t + 10)).toBe(false);
    expect(await verifyStripeSignature(body, `t=${t},v1=${sig}`, "whsec_x", t + 4000)).toBe(false);
    expect(await verifyStripeSignature(body, null, "whsec_x", t)).toBe(false);
  });
});

describe("derechos de descarga", () => {
  async function doneJob() {
    await run(
      "INSERT INTO jobs (id, user_id, status, options, created_at, updated_at, expires_at) VALUES ('j1','u1','done','{}',?,?,?)",
      Date.now(),
      Date.now(),
      Date.now() + 1000,
    );
  }
  it("pagar con créditos concede el derecho una vez y alarga la retención", async () => {
    await doneJob();
    await handleStripeEvent(ev("evt_1"));
    expect(await unlockWithCredits("u1", "j1", "hd")).toBe("ok");
    expect(await unlockWithCredits("u1", "j1", "hd")).toBe("already");
    expect(await balance("u1")).toBe(8);
    const j = await one<{ expires_at: number }>("SELECT expires_at FROM jobs WHERE id = 'j1'");
    expect(j!.expires_at).toBeGreaterThan(Date.now() + 29 * 86400_000);
  });
  it("sin saldo no concede nada", async () => {
    await doneJob();
    expect(await unlockWithCredits("u1", "j1", "stencil")).toBe("no_credits");
    expect(await hasEntitlement("j1", "stencil")).toBe(false);
  });
  it("un usuario no puede desbloquear el trabajo de otro", async () => {
    await doneJob();
    addUser(ctx.DB, "u2", "c@d.co");
    await expect(grantEntitlement("u2", "j1", "hd")).rejects.toThrow();
    expect(await all("SELECT 1 FROM entitlements")).toHaveLength(0);
  });
});

describe("suscripciones de estudios (webhook)", () => {
  const ev = (id: string, type: string, object: Record<string, unknown>) => ({ id, type, data: { object } });
  async function org() {
    await run("INSERT INTO organizations (id, name, slug, city, created_at) VALUES ('o1','Tinta','tinta-sevilla','Sevilla',?)", Date.now());
    return (await one<Record<string, unknown>>("SELECT * FROM organizations WHERE id = 'o1'"))!;
  }
  const checkout = (id: string, plan = "pro") =>
    ev(id, "checkout.session.completed", { id: `cs_${id}`, mode: "subscription", payment_status: "paid", client_reference_id: "u1", customer: "cus_1", subscription: "sub_1", metadata: { kind: "subscription", orgId: "o1", plan } });

  it("al pagar la suscripción se activa el plan con su cupo y se guardan los datos de Stripe", async () => {
    await org();
    expect(await handleStripeEvent(checkout("e1"))).toBe("processed");
    const o = (await one<Record<string, unknown>>("SELECT plan, subscription_status, monthly_quota, stripe_customer_id, stripe_subscription_id FROM organizations WHERE id = 'o1'"))!;
    expect(o).toMatchObject({ plan: "pro", subscription_status: "active", monthly_quota: 300, stripe_customer_id: "cus_1", stripe_subscription_id: "sub_1" });
    expect(await handleStripeEvent(checkout("e1"))).toBe("duplicate"); // un reenvío no hace nada
  });

  it("el plan Premium además lo muestra y destaca en el directorio", async () => {
    await org();
    await handleStripeEvent(checkout("e2", "premium"));
    expect(await one("SELECT 1 FROM organizations WHERE id = 'o1' AND listed = 1 AND featured = 1")).toBeTruthy();
  });

  it("un plan que no existe o un estudio inexistente no activan nada", async () => {
    await org();
    expect(await handleStripeEvent(checkout("e3", "gratis"))).toBe("ignored");
    expect((await one<{ subscription_status: string }>("SELECT subscription_status FROM organizations WHERE id = 'o1'"))!.subscription_status).toBe("inactive");
  });

  it("si falla un cobro el estudio se pausa, y si se cancela pierde plan y cupo", async () => {
    await org();
    await handleStripeEvent(checkout("e4"));
    await handleStripeEvent(ev("e5", "invoice.payment_failed", { subscription: "sub_1" }));
    expect((await one<{ subscription_status: string }>("SELECT subscription_status FROM organizations WHERE id = 'o1'"))!.subscription_status).toBe("past_due");
    // pausado: no puede generar con el cupo (la cobranza exige estado 'active')
    const { createJob, QuotaError } = await import("@/lib/jobs");
    await expect(createJob({ userId: "u1", orgId: "o1", options: { zone: "brazo", description: "x", style: "old-school", color: "bw", size: "mediano", hasReference: false, placement: { x: 0.5, y: 0.5, scale: 0.4, rotation: 0, opacity: 1 } }, photo: { bytes: tinyJpeg, contentType: "image/jpeg" } })).rejects.toBeInstanceOf(QuotaError);
    // se recupera al pagar
    await handleStripeEvent(ev("e6", "customer.subscription.updated", { id: "sub_1", status: "active" }));
    expect((await one<{ subscription_status: string }>("SELECT subscription_status FROM organizations WHERE id = 'o1'"))!.subscription_status).toBe("active");
    await handleStripeEvent(ev("e7", "customer.subscription.deleted", { id: "sub_1" }));
    expect(await one<Record<string, unknown>>("SELECT plan, subscription_status, monthly_quota FROM organizations WHERE id = 'o1'")).toMatchObject({ plan: "none", subscription_status: "canceled", monthly_quota: 0 });
  });
});
