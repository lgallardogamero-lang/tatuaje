import { expect, test, type APIRequestContext, type Browser, type Page } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

const foto = fs.readFileSync(path.resolve(import.meta.dirname, "../fixtures/antebrazo.jpg"));
const ADMIN = "lgallardogamero@gmail.com";
const consent = encodeURIComponent(JSON.stringify({ v: 1, analytics: false, marketing: false, ts: Date.now() }));
const options = { zone: "brazo", description: "rosa", style: "old-school", color: "color", size: "mediano", hasReference: false, placement: { x: 0.5, y: 0.5, scale: 0.4, rotation: 0, opacity: 0.9 } };

async function loginAs(page: Page, email: string): Promise<string> {
  await page.goto("/entrar");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Soy mayor de edad.").check();
  await page.getByLabel(/He leído el aviso de privacidad/).check();
  await page.getByRole("button", { name: "Enviarme el enlace" }).click();
  const link = (await page.getByTestId("dev-link").getAttribute("href"))!;
  await page.getByTestId("dev-link").click();
  await page.waitForLoadState("networkidle");
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await expect(page).toHaveURL(/\/crear$/);
  return link;
}

async function actor(browser: Browser, baseURL: string | undefined, email: string) {
  const ctx = await browser.newContext({ baseURL });
  await ctx.addCookies([{ name: "calco_consent", value: consent, url: "http://localhost:3000" }]);
  const page = await ctx.newPage();
  const link = await loginAs(page, email);
  return { ctx, page, req: ctx.request, link };
}

async function crearPrueba(req: APIRequestContext): Promise<string> {
  const r = await req.post("/api/jobs", { multipart: { options: JSON.stringify(options), photo: { name: "f.jpg", mimeType: "image/jpeg", buffer: foto } } });
  expect(r.status(), await r.text()).toBe(201);
  const { id } = (await r.json()) as { id: string };
  for (let i = 0; i < 60; i++) {
    const j = (await (await req.get(`/api/jobs/${id}`)).json()) as { status: string };
    if (j.status === "done") return id;
    await new Promise((res) => setTimeout(res, 500));
  }
  throw new Error("la prueba no terminó");
}

test("aislamiento entre usuarios, CSRF, enlaces de un solo uso y bloqueo", async ({ browser, baseURL }, info) => {
  test.setTimeout(180_000);
  const stamp = `${info.project.name}-${Date.now()}`;
  const a = await actor(browser, baseURL, `seg-a-${stamp}@example.com`);
  const b = await actor(browser, baseURL, `seg-b-${stamp}@example.com`);
  const anon = await browser.newContext({ baseURL });

  const jobA = await crearPrueba(a.req);

  // 1) el usuario B no ve ni toca la prueba de A: siempre 404 (sin revelar que existe)
  for (const [method, url] of [
    ["get", `/api/jobs/${jobA}`],
    ["get", `/api/jobs/${jobA}/files/original`],
    ["get", `/api/jobs/${jobA}/files/variant-0`],
    ["get", `/api/jobs/${jobA}/files/design`],
    ["post", `/api/jobs/${jobA}/cancel`],
    ["post", `/api/jobs/${jobA}/regenerate`],
  ] as const) {
    const r = method === "get" ? await b.req.get(url) : await b.req.post(url);
    const esperado = url.endsWith("/cancel") ? 200 : 404; // cancelar con otro dueño no hace nada: devuelve ok:false
    expect(r.status(), `${method} ${url}`).toBe(esperado);
    if (url.endsWith("/cancel")) expect(((await r.json()) as { ok: boolean }).ok).toBe(false);
  }
  expect((await b.req.post(`/api/jobs/${jobA}/unlock`, { data: { kind: "hd", method: "credits" } })).status()).toBe(404);
  // y el listado de B no incluye la de A
  const lista = (await (await b.req.get("/api/jobs")).json()) as { jobs: { id: string }[] };
  expect(lista.jobs.some((j) => j.id === jobA)).toBe(false);
  // la prueba de A sigue intacta
  expect(((await (await a.req.get(`/api/jobs/${jobA}`)).json()) as { status: string }).status).toBe("done");

  // 2) sin sesión no se accede a nada privado
  expect((await anon.request.get("/api/jobs")).status()).toBe(401);
  expect((await anon.request.get(`/api/jobs/${jobA}/files/variant-0`)).status()).toBe(401);
  expect((await anon.request.get("/api/studio")).status()).toBe(401);
  expect((await anon.request.get("/api/me/export")).status()).toBe(401);
  expect(((await (await anon.request.get("/api/me")).json()) as { user: unknown }).user).toBeNull();
  expect((await anon.request.get("/api/admin/pricing")).status()).toBe(401);
  expect((await (await anon.newPage()).goto("/admin"))!.status()).toBe(404);

  // 3) los archivos se sirven sin poder ejecutar nada
  const f = await a.req.get(`/api/jobs/${jobA}/files/variant-0`);
  expect(f.headers()["x-content-type-options"]).toBe("nosniff");
  expect(f.headers()["content-security-policy"]).toContain("sandbox");
  expect(f.headers()["cache-control"]).toContain("no-store");

  // 4) CSRF: una petición que cambia estado desde otro origen se rechaza
  const csrf = await a.req.post(`/api/jobs/${jobA}/regenerate`, { headers: { Origin: "https://sitio-malicioso.example" } });
  expect(csrf.status()).toBe(403);
  expect((await a.req.post("/api/auth/logout", { headers: { Origin: "https://sitio-malicioso.example" } })).status()).toBe(403);
  expect((await a.req.get("/api/me")).ok()).toBe(true); // la sesión sigue viva

  // 5) el enlace de acceso solo sirve una vez
  const token = new URL(a.link).searchParams.get("token")!;
  const reuse = await anon.request.post("/api/auth/verify", { data: { token } });
  expect(reuse.status()).toBe(400);
  expect((await anon.request.post("/api/auth/verify", { data: { token: "x".repeat(43) } })).status()).toBe(400);

  // 6) validación de entradas: imagen falsa, opciones manipuladas y peso excesivo
  const falso = await b.req.post("/api/jobs", { multipart: { options: JSON.stringify(options), photo: { name: "x.jpg", mimeType: "image/jpeg", buffer: Buffer.from("<svg onload=alert(1)></svg>") } } });
  expect(falso.status()).toBe(400);
  const malas = await b.req.post("/api/jobs", { multipart: { options: JSON.stringify({ ...options, placement: { ...options.placement, x: 99 } }), photo: { name: "f.jpg", mimeType: "image/jpeg", buffer: foto } } });
  expect(malas.status()).toBe(400);
  const ajeno = await b.req.post("/api/jobs", { multipart: { options: JSON.stringify(options), studio: "00000000-0000-4000-8000-000000000000", photo: { name: "f.jpg", mimeType: "image/jpeg", buffer: foto } } });
  expect(ajeno.status()).toBe(403); // no pertenece a ese estudio
  const prohibido = await b.req.post("/api/jobs", { multipart: { options: JSON.stringify({ ...options, description: "una foto desnuda" }), photo: { name: "f.jpg", mimeType: "image/jpeg", buffer: foto } } });
  expect(prohibido.status()).toBe(422);

  // 7) webhook de Stripe: sin firma válida no se acepta nada
  const wh = await anon.request.post("/api/stripe/webhook", { data: { id: "evt_x", type: "checkout.session.completed", data: { object: {} } }, headers: { "stripe-signature": "t=1,v1=falsa" } });
  expect([400, 503]).toContain(wh.status());

  // 8) el administrador bloquea a B: su sesión deja de valer al instante
  const admin = await actor(browser, baseURL, ADMIN);
  const lookup = await admin.page.goto(`/admin/usuarios?q=${encodeURIComponent(`seg-b-${stamp}`)}`);
  expect(lookup!.status()).toBe(200);
  await admin.page.getByRole("link", { name: `seg-b-${stamp}@example.com` }).click();
  admin.page.once("dialog", (d) => d.accept());
  await admin.page.getByRole("button", { name: "Bloquear" }).click();
  await expect(admin.page.getByRole("status")).toContainText("Usuario bloqueado");
  expect(((await (await b.req.get("/api/me")).json()) as { user: unknown }).user).toBeNull();
  expect((await b.req.get("/api/jobs")).status()).toBe(401);
  // y no puede volver a entrar
  const again = await anon.request.post("/api/auth/request", { data: { email: `seg-b-${stamp}@example.com`, adult: true, privacy: true } });
  const dev = ((await again.json()) as { devLink?: string }).devLink!;
  const t2 = new URL(dev).searchParams.get("token")!;
  expect((await anon.request.post("/api/auth/verify", { data: { token: t2 } })).status()).toBe(403);

  for (const c of [a.ctx, b.ctx, anon, admin.ctx]) await c.close();
});

test("estudios: un estudio no puede ver ni tocar el catálogo, el equipo ni los datos de otro", async ({ browser, baseURL }, info) => {
  test.setTimeout(180_000);
  const stamp = `${info.project.name}-${Date.now()}`;
  const admin = await actor(browser, baseURL, ADMIN);
  const dueñoA = await actor(browser, baseURL, `seg-ja-${stamp}@example.com`);
  const dueñoB = await actor(browser, baseURL, `seg-jb-${stamp}@example.com`);
  const cliente = await actor(browser, baseURL, `seg-c-${stamp}@example.com`);

  for (const [n, email] of [[`Sur ${stamp}`, `seg-ja-${stamp}@example.com`], [`Norte ${stamp}`, `seg-jb-${stamp}@example.com`]]) {
    await admin.page.goto("/admin/estudios");
    await admin.page.locator("#o-name").fill(n!);
    await admin.page.locator("#o-city").fill("Sevilla");
    await admin.page.locator("#o-owner").fill(email!);
    await admin.page.locator("#o-plan").selectOption("pro");
    await admin.page.getByRole("button", { name: "Crear estudio" }).click();
    await expect(admin.page.getByRole("status").first()).toContainText("Estudio creado");
  }

  // A sube un diseño; B intenta verlo y borrarlo
  const sube = await dueñoA.req.post("/api/studio/flash", { multipart: { name: "Rosa", file: { name: "r.jpg", mimeType: "image/jpeg", buffer: foto } } });
  expect(sube.status()).toBe(201);
  const { id: flashId } = (await sube.json()) as { id: string };
  expect((await dueñoA.req.get(`/api/studio/flash/${flashId}/image`)).status()).toBe(200);
  expect((await dueñoB.req.get(`/api/studio/flash/${flashId}/image`)).status()).toBe(404);
  expect((await dueñoB.req.delete(`/api/studio/flash/${flashId}`)).status()).toBe(404);
  expect((await cliente.req.get(`/api/studio/flash/${flashId}/image`)).status()).toBe(403); // no es de ningún estudio
  expect((await cliente.req.get("/api/studio")).status()).toBe(403);
  expect((await cliente.req.post("/api/studio/flash", { multipart: { name: "x", file: { name: "r.jpg", mimeType: "image/jpeg", buffer: foto } } })).status()).toBe(403);
  expect((await dueñoA.req.get(`/api/studio/flash/${flashId}/image`)).status()).toBe(200); // sigue intacto

  // B no puede usar el diseño de A al generar con su estudio
  const dueñoBinfo = (await (await dueñoB.req.get("/api/me")).json()) as { studio: { id: string } };
  const usa = await dueñoB.req.post("/api/jobs", { multipart: { options: JSON.stringify({ ...options, description: "", flashId }), studio: dueñoBinfo.studio.id, photo: { name: "f.jpg", mimeType: "image/jpeg", buffer: foto } } });
  expect(usa.status()).toBe(400);

  // un artista o un cliente no pueden cambiar datos del estudio, ni añadir gente
  expect((await cliente.req.patch("/api/studio", { data: { city: "Madrid" } })).status()).toBe(403);
  expect((await cliente.req.post("/api/studio/members", { data: { email: `seg-c-${stamp}@example.com` } })).status()).toBe(403);
  expect((await dueñoB.req.post("/api/studio/logo", { multipart: { file: { name: "l.svg", mimeType: "image/svg+xml", buffer: Buffer.from('<svg onload="alert(1)"/>') } } })).status()).toBe(400);

  // los datos de contacto: un usuario no puede dejar un contacto en un estudio que no está en el directorio
  const orgA = (await (await dueñoA.req.get("/api/me")).json()) as { studio: { id: string } };
  expect((await cliente.req.post("/api/leads", { data: { orgId: orgA.studio.id, kind: "contact", consent: true } })).status()).toBe(404);

  // el panel de administración y sus APIs son inaccesibles para dueños de estudio
  expect((await dueñoA.req.get("/api/admin/pricing")).status()).toBe(403);
  expect((await dueñoA.req.post("/api/admin/orgs", { data: { name: "x", city: "y", ownerEmail: "a@b.co", plan: "pro" } })).status()).toBe(403);
  expect((await dueñoA.req.post(`/api/admin/studio-requests/${flashId}`, { data: { action: "approve", plan: "pro" } })).status()).toBe(403);

  for (const c of [admin.ctx, dueñoA.ctx, dueñoB.ctx, cliente.ctx]) await c.close();
});
