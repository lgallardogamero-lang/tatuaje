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
