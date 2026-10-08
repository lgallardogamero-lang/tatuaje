import { expect, test, type Browser, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import path from "node:path";

const ADMIN = "lgallardogamero@gmail.com";
const foto = path.resolve(import.meta.dirname, "../fixtures/antebrazo.jpg");
const consent = encodeURIComponent(JSON.stringify({ v: 1, analytics: false, marketing: false, ts: Date.now() }));

async function loginAs(page: Page, email: string) {
  await page.goto("/entrar");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Soy mayor de edad.").check();
  await page.getByLabel(/He leído el aviso de privacidad/).check();
  await page.getByRole("button", { name: "Enviarme el enlace" }).click();
  await page.getByTestId("dev-link").click();
  await page.waitForLoadState("networkidle");
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await expect(page).toHaveURL(/\/crear$/);
}

async function ctxPage(browser: Browser, baseURL: string | undefined) {
  const ctx = await browser.newContext({ baseURL, viewport: { width: 1280, height: 900 } });
  await ctx.addCookies([{ name: "calco_consent", value: consent, url: "http://localhost:3000" }]);
  return { ctx, page: await ctx.newPage() };
}

test("estudio: alta, catálogo, directorio, contacto y generación con el cupo del estudio", async ({ browser, baseURL }, info) => {
  test.setTimeout(180_000);
  const stamp = Date.now();
  const city = `Ciudad${stamp}`;
  const name = `Tinta ${stamp % 100000}`;
  const ownerEmail = `jefe-${info.project.name}-${stamp}@example.com`;
  const clientEmail = `cliente-${info.project.name}-${stamp}@example.com`;

  // 1) el responsable se registra
  const o = await ctxPage(browser, baseURL);
  await loginAs(o.page, ownerEmail);
  expect((await o.page.goto("/estudio"))!.url()).toContain("/estudios"); // aún no tiene estudio

  // 2) el administrador da de alta el estudio con el plan Pro
  const a = await ctxPage(browser, baseURL);
  await loginAs(a.page, ADMIN);
  await a.page.goto("/admin/estudios");
  await a.page.locator("#o-name").fill(name);
  await a.page.locator("#o-city").fill(city);
  await a.page.locator("#o-owner").fill(ownerEmail);
  await a.page.locator("#o-plan").selectOption("pro");
  await a.page.getByRole("button", { name: "Crear estudio" }).click();
  await expect(a.page.getByRole("status")).toContainText("Estudio creado");

  // 3) el responsable ve su panel, sube un diseño y se lista en el directorio
  const p = o.page;
  const errores: string[] = [];
  p.on("pageerror", (e) => errores.push(`pageerror: ${e.message}`));
  // El "status of 400" lo provoca esta misma prueba al intentar guardar un color ilegible (el servidor lo rechaza a propósito).
  // Chromium en modo móvil de Playwright añade `caret-color: transparent` a los campos antes de hidratar: no es de la app.
  p.on("console", (m) => m.type() === "error" && !m.text().includes('caret-color:"transparent"') && !m.text().includes("status of 400") && errores.push(`console: ${m.text()}`));
  await p.goto("/");
  await expect(p.getByRole("link", { name: "Mi estudio" })).toBeVisible();
  await p.goto("/estudio");
  await expect(p.getByRole("heading", { name })).toBeVisible();
  await expect(p.getByText("de 300 generaciones")).toBeVisible();
  await expect(p.getByText(/Plan Pro activo, con 300 generaciones al mes/)).toBeVisible();
  await expect(p.getByText(/Lo ha activado Calco directamente/)).toBeVisible(); // alta manual: sin suscripción de Stripe
  await p.getByLabel("Nombre del diseño").fill("Rosa clásica");
  await p.locator("#fl-file").setInputFiles(foto);
  await p.getByRole("button", { name: "Añadir al catálogo" }).click();
  await expect(p.getByRole("status").first()).toContainText("Diseño añadido");
  await expect(p.getByRole("img", { name: "Rosa clásica" })).toBeVisible();
  await p.getByLabel(/Email de contacto/).fill("hola@tinta.example.com");
  await p.getByLabel("Instagram").fill("@tintaprueba");
  await p.getByRole("button", { name: "Guardar datos" }).click();
  await expect(p.getByRole("status").first()).toContainText("Datos guardados");
  await p.getByLabel(new RegExp(`Aparecer en el directorio de estudios de ${city}`)).check();
  await expect(p.getByRole("status").first()).toContainText("Ya apareces en el directorio");

  // marca blanca: color y logo del estudio
  await p.getByLabel("Color de marca").fill("#ffb347");
  await p.getByRole("button", { name: "Guardar color" }).click();
  await expect(p.getByRole("status").first()).toContainText("Color guardado");
  await p.getByLabel("Color de marca").fill("#101010");
  await p.getByRole("button", { name: "Guardar color" }).click();
  await expect(p.getByRole("status").first()).toContainText("demasiado oscuro"); // un color ilegible se rechaza
  await p.getByLabel("Color de marca").fill("#ffb347");
  await p.locator("#b-logo").setInputFiles(foto);
  await expect(p.getByRole("status").first()).toContainText("Logo guardado");
  await expect(p.getByRole("img", { name: `Logo de ${name}` }).first()).toBeVisible();

  // 4) un cliente encuentra el estudio y le escribe (con consentimiento expreso)
  const c = await ctxPage(browser, baseURL);
  await loginAs(c.page, clientEmail);
  await c.page.goto("/directorio");
  await c.page.getByRole("link", { name: new RegExp(city) }).click();
  await expect(c.page.getByRole("heading", { name })).toBeVisible();
  await c.page.getByRole("button", { name: "Contactar" }).click();
  const dlg = c.page.getByRole("dialog");
  await dlg.getByLabel("Mensaje (opcional)").fill("Quiero esta rosa en el antebrazo");
  await expect(dlg.getByRole("button", { name: "Enviar" })).toBeDisabled(); // sin consentimiento no se envía
  await dlg.getByLabel(/Acepto que Calco comparta mi email/).check();
  await dlg.getByRole("button", { name: "Enviar" }).click();
  await expect(dlg.getByRole("status")).toContainText("recibirá tu mensaje");
  await c.ctx.close();

  // 5) el estudio ve la solicitud
  await p.reload();
  await expect(p.getByText(clientEmail)).toBeVisible();
  await expect(p.getByText("Quiero esta rosa en el antebrazo")).toBeVisible();

  // 6) el responsable genera con el catálogo usando el cupo del estudio
  await p.goto("/crear");
  await p.getByTestId("photo-input").setInputFiles(foto);
  await expect(p.getByText(/Foto lista/)).toBeVisible();
  await p.getByRole("button", { name: "Continuar con el diseño" }).click();
  await p.getByRole("button", { name: new RegExp(`Del catálogo de ${name}`) }).click();
  await p.getByRole("button", { name: /Rosa clásica/ }).click();
  await p.getByRole("button", { name: "Continuar con la colocación" }).click();
  await expect(p.getByLabel(/Usar el cupo de/)).toBeChecked();
  await expect(p.getByText("No gasta tus créditos")).toBeVisible();
  await p.getByRole("button", { name: "Generar mi tatuaje" }).click();
  await expect(p).toHaveURL(/\/crear\/[0-9a-f-]{36}$/, { timeout: 30_000 });
  await expect(p.getByRole("heading", { name: "Así te queda" })).toBeVisible({ timeout: 45_000 });
  // marca blanca en el resultado: nombre, logo y color del estudio
  await expect(p.getByTestId("studio-brand")).toContainText(name);
  await expect(p.getByRole("img", { name: `Logo de ${name}` })).toBeVisible();
  const colorBoton = await p.getByRole("button", { name: "Descargar en alta resolución" }).evaluate((el) => getComputedStyle(el).backgroundColor);
  expect(colorBoton).toBe("rgb(255, 179, 71)"); // #ffb347
  // resultado de estudio: 3 variantes, sin marca de agua y con el stencil incluido
  await expect(p.getByRole("tab")).toHaveCount(3);
  await expect(p.getByRole("button", { name: "Descargar en alta resolución" })).toBeVisible();
  await expect(p.getByRole("button", { name: "Descargar el stencil" })).toBeVisible();
  await p.evaluate(() => Promise.all([...document.querySelectorAll("img")].map((i) => i.decode().catch(() => {}))));
  await p.screenshot({ path: `screenshots/estudio-resultado-${info.project.name}.png` });

  // 7) el cupo se descontó y el saldo personal no
  await p.goto("/estudio");
  await expect(p.getByText("de 300 generaciones").locator("..").getByText("1", { exact: true }).first()).toBeVisible();
  await p.screenshot({ path: `screenshots/estudio-panel-${info.project.name}.png`, fullPage: true });
  expect(errores, errores.join("\n")).toEqual([]);
  await o.ctx.close();
  await a.ctx.close();
});

test("embudo: un estudio solicita el alta y el administrador la aprueba o rechaza", async ({ browser, baseURL }, info) => {
  test.setTimeout(150_000);
  const stamp = Date.now();
  const ownerEmail = `solicita-${info.project.name}-${stamp}@example.com`;
  const name = `Sala ${stamp % 100000}`;

  const o = await ctxPage(browser, baseURL);
  const p = o.page;
  await p.goto("/estudios");
  await expect(p.getByRole("link", { name: "Entrar para solicitarlo" })).toBeVisible(); // sin sesión no hay formulario
  await loginAs(p, ownerEmail);
  await p.goto("/estudios");
  const enviar = p.getByRole("button", { name: "Enviar solicitud" });
  await p.locator("#r-name").fill(name);
  await p.locator("#r-city").fill("Valencia");
  await p.locator("#r-mail").fill("hola@sala.example.com");
  await expect(enviar).toBeDisabled(); // sin la casilla de consentimiento no se envía
  await p.getByLabel(/Acepto que Calco use estos datos/).check();
  await enviar.click();
  await expect(p.getByRole("heading", { name: "Solicitud recibida" })).toBeVisible();
  await p.reload();
  await expect(p.getByRole("heading", { name: "Solicitud recibida" })).toBeVisible(); // persiste

  const a = await ctxPage(browser, baseURL);
  await loginAs(a.page, ADMIN);
  await a.page.goto("/admin/estudios");
  await expect(a.page.getByRole("heading", { name: /Solicitudes pendientes/ })).toBeVisible();
  const tarjeta = a.page.getByRole("listitem").filter({ hasText: name });
  await expect(tarjeta).toContainText("hola@sala.example.com");
  await tarjeta.getByRole("button", { name: "Aprobar" }).click();
  await expect(a.page.getByRole("status").first()).toContainText(`Estudio «${name}» creado`);

  await p.goto("/");
  await expect(p.getByRole("link", { name: "Mi estudio" })).toBeVisible();
  await p.goto("/estudio");
  await expect(p.getByRole("heading", { name })).toBeVisible();
  await p.goto("/estudios");
  await expect(p.getByRole("heading", { name: "Tu estudio ya está en Calco" })).toBeVisible();

  // rechazo: otra persona, mismo flujo
  const o2 = await ctxPage(browser, baseURL);
  const name2 = `Rechazo ${stamp % 100000}`;
  await loginAs(o2.page, `rechazo-${info.project.name}-${stamp}@example.com`);
  await o2.page.goto("/estudios");
  await o2.page.locator("#r-name").fill(name2);
  await o2.page.locator("#r-city").fill("Vigo");
  await o2.page.locator("#r-mail").fill("x@y.example.com");
  await o2.page.getByLabel(/Acepto que Calco use estos datos/).check();
  await o2.page.getByRole("button", { name: "Enviar solicitud" }).click();
  await expect(o2.page.getByRole("heading", { name: "Solicitud recibida" })).toBeVisible();
  await a.page.goto("/admin/estudios");
  a.page.once("dialog", (d) => d.accept("Faltan datos"));
  await a.page.getByRole("listitem").filter({ hasText: name2 }).getByRole("button", { name: "Rechazar" }).click();
  await expect(a.page.getByRole("status").first()).toContainText("Solicitud rechazada");
  await o2.page.goto("/estudios");
  await expect(o2.page.getByText(/no se pudo aprobar/)).toBeVisible();
  await o.ctx.close();
  await a.ctx.close();
  await o2.ctx.close();
});

test("página pública del estudio: marca, recorrido del cliente hasta contactar y estudios ocultos", async ({ browser, baseURL }, info) => {
  test.setTimeout(150_000);
  const stamp = Date.now();
  const name = `Pública ${stamp % 100000}`;
  const ownerEmail = `pub-${info.project.name}-${stamp}@example.com`;

  const o = await ctxPage(browser, baseURL);
  await loginAs(o.page, ownerEmail);
  const a = await ctxPage(browser, baseURL);
  await loginAs(a.page, ADMIN);
  // alta por API (más rápido que por pantalla)
  const alta = await a.page.request.post("/api/admin/orgs", { data: { name, city: "Granada", ownerEmail, plan: "pro" } });
  expect(alta.status()).toBe(201);
  const me = (await (await o.page.request.get("/api/me")).json()) as { studio: { slug: string } };
  const slug = me.studio.slug;

  // oculto mientras no se lista
  const anon = await ctxPage(browser, baseURL);
  expect((await anon.page.goto(`/e/${slug}`))!.status()).toBe(404);
  expect((await anon.page.request.get(`/api/public/studio/${slug}`)).status()).toBe(404);
  expect((await anon.page.request.get(`/api/public/studio/${slug}/logo`)).status()).toBe(404);

  // el responsable lo lista, pone color y logo, y ve su enlace para compartir
  const foto = path.resolve(import.meta.dirname, "../fixtures/antebrazo.jpg");
  expect((await o.page.request.patch("/api/studio", { data: { listed: true, accentColor: "#ffb347", instagram: "publica" } })).status()).toBe(200);
  await o.page.goto("/estudio");
  await o.page.locator("#b-logo").setInputFiles(foto);
  await expect(o.page.getByRole("status").first()).toContainText("Logo guardado");
  await expect(o.page.getByLabel("Enlace de tu página")).toHaveValue(new RegExp(`/e/${slug}$`));

  // la página pública: nombre, logo y color del estudio
  const p = anon.page;
  await p.goto(`/e/${slug}`);
  await expect(p.getByText(name, { exact: true })).toBeVisible();
  await expect(p.getByRole("img", { name: `Logo de ${name}` })).toBeVisible();
  const color = await p.locator("#contenido").getByRole("link", { name: "Probar un tatuaje" }).evaluate((el) => getComputedStyle(el).backgroundColor);
  expect(color).toBe("rgb(255, 179, 71)");
  expect((await p.request.get(`/api/public/studio/${slug}/logo`)).status()).toBe(200);
  await p.waitForTimeout(600);
  const graves = (await new AxeBuilder({ page: p }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze()).violations.filter((v) => v.impact === "serious" || v.impact === "critical");
  expect(graves.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
  await p.screenshot({ path: `screenshots/estudio-publica-${info.project.name}.png` });
  await anon.ctx.close();

  // un cliente llega desde esa página, prueba un tatuaje y contacta con el estudio desde el resultado
  const c = await ctxPage(browser, baseURL);
  await loginAs(c.page, `pubcli-${info.project.name}-${stamp}@example.com`);
  await c.page.goto(`/e/${slug}`);
  await c.page.locator("#contenido").getByRole("link", { name: "Probar un tatuaje" }).click();
  await expect(c.page).toHaveURL(new RegExp(`/crear\\?e=${slug}$`));
  await c.page.getByTestId("photo-input").setInputFiles(foto);
  await expect(c.page.getByText(/Foto lista/)).toBeVisible();
  await c.page.getByRole("button", { name: "Continuar con el diseño" }).click();
  await c.page.getByLabel("Descríbelo").fill("Una rosa fina");
  await c.page.getByRole("button", { name: "Continuar con la colocación" }).click();
  await c.page.getByRole("button", { name: "Generar mi tatuaje" }).click();
  await expect(c.page).toHaveURL(new RegExp(`/crear/[0-9a-f-]{36}\\?e=${slug}$`), { timeout: 30_000 });
  await expect(c.page.getByRole("heading", { name: "Así te queda" })).toBeVisible({ timeout: 45_000 });
  await expect(c.page.getByText(`¿Te gusta? Hazlo en ${name}`)).toBeVisible();
  await c.page.getByRole("button", { name: "Contactar" }).click();
  const dlg = c.page.getByRole("dialog");
  await dlg.getByRole("button", { name: "Quiero reservar" }).click();
  await dlg.getByLabel(/Acepto que Calco comparta mi email/).check();
  await dlg.getByRole("button", { name: "Enviar" }).click();
  await expect(dlg.getByRole("status")).toContainText("recibirá tu mensaje");

  // el estudio ve la solicitud, ligada a esa prueba
  await o.page.goto("/estudio");
  await expect(o.page.getByText(`pubcli-${info.project.name}-${stamp}@example.com`)).toBeVisible();
  await expect(o.page.getByText("Quiere reservar")).toBeVisible();
  for (const x of [o.ctx, a.ctx, c.ctx]) await x.close();
});

test("plan del estudio: sin plan se ofrece contratar con consentimiento; sin Stripe configurado avisa", async ({ browser, baseURL }, info) => {
  test.setTimeout(100_000);
  const stamp = Date.now();
  const ownerEmail = `sinplan-${info.project.name}-${stamp}@example.com`;
  const o = await ctxPage(browser, baseURL);
  await loginAs(o.page, ownerEmail);
  const a = await ctxPage(browser, baseURL);
  await loginAs(a.page, ADMIN);
  expect((await a.page.request.post("/api/admin/orgs", { data: { name: `Sin plan ${stamp % 100000}`, city: "Murcia", ownerEmail, plan: "none" } })).status()).toBe(201);

  const p = o.page;
  await p.goto("/estudio");
  await expect(p.getByText(/no está activo/).first()).toBeVisible();
  await expect(p.getByText(/Elige un plan para usar el modo estudio/)).toBeVisible();
  const contratar = p.getByRole("button", { name: "Contratar Pro" });
  await expect(contratar).toBeDisabled(); // sin consentimiento expreso no se puede pagar
  // el servidor también lo exige aunque se salte la pantalla
  const sinConsentimiento = await p.request.post("/api/studio/subscribe", { data: { plan: "pro" } });
  expect(sinConsentimiento.status()).toBe(400);
  await p.getByLabel(/pierdo el derecho de desistimiento/).check();
  await contratar.click();
  await expect(p.getByRole("alert").filter({ hasText: "pagos aún no están activados" })).toBeVisible(); // en local no hay Stripe
  // un cliente sin estudio no puede contratar planes ni abrir el portal
  const c = await ctxPage(browser, baseURL);
  await loginAs(c.page, `sinplan-cli-${info.project.name}-${stamp}@example.com`);
  expect((await c.page.request.post("/api/studio/subscribe", { data: { plan: "pro", withdrawalConsent: true } })).status()).toBe(403);
  expect((await c.page.request.post("/api/studio/portal")).status()).toBe(403);
  for (const x of [o.ctx, a.ctx, c.ctx]) await x.close();
});
