import { expect, test, type Browser, type Page } from "@playwright/test";

const ADMIN = "lgallardogamero@gmail.com"; // definido en ADMIN_EMAILS de .dev.vars

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

async function newPage(browser: Browser, baseURL: string | undefined) {
  const ctx = await browser.newContext({ baseURL, viewport: { width: 1280, height: 900 } });
  await ctx.addCookies([{ name: "calco_consent", value: encodeURIComponent(JSON.stringify({ v: 1, analytics: false, marketing: false, ts: Date.now() })), url: "http://localhost:3000" }]);
  return { ctx, page: await ctx.newPage() };
}

test("cookies: aviso con aceptar y rechazar al mismo nivel, y se puede cambiar después", async ({ page }) => {
  await page.goto("/");
  const aviso = page.getByRole("region", { name: "Aviso de cookies" });
  await expect(aviso).toBeVisible();
  await expect(aviso.getByRole("button", { name: "Rechazar las no necesarias" })).toBeVisible();
  await expect(aviso.getByRole("button", { name: "Aceptar todas" })).toBeVisible();
  // no hay cookie de preferencias hasta que se elige
  expect((await page.context().cookies()).some((c) => c.name === "calco_consent")).toBe(false);

  await aviso.getByRole("button", { name: "Rechazar las no necesarias" }).click();
  await expect(aviso).toBeHidden();
  const saved = (await page.context().cookies()).find((c) => c.name === "calco_consent")!;
  expect(JSON.parse(decodeURIComponent(saved.value))).toMatchObject({ analytics: false, marketing: false });

  await page.reload();
  await expect(page.getByRole("region", { name: "Aviso de cookies" })).toBeHidden();

  await page.getByRole("button", { name: "Gestionar cookies" }).click();
  const dialogo = page.getByRole("dialog");
  await expect(dialogo.getByRole("checkbox", { name: /necesarias, siempre activas/ })).toBeDisabled();
  await dialogo.getByLabel("Analítica").check();
  await dialogo.getByRole("button", { name: "Guardar mi elección" }).click();
  const after = (await page.context().cookies()).find((c) => c.name === "calco_consent")!;
  expect(JSON.parse(decodeURIComponent(after.value))).toMatchObject({ analytics: true, marketing: false });
});

test("las cabeceras de seguridad están presentes", async ({ request }) => {
  const r = await request.get("/");
  const h = r.headers();
  expect(h["x-frame-options"]).toBe("DENY");
  expect(h["x-content-type-options"]).toBe("nosniff");
  expect(h["content-security-policy"]).toContain("frame-ancestors 'none'");
  expect(h["referrer-policy"]).toBeTruthy();
});

test("administración: acceso restringido, créditos, precios y registro", async ({ browser, baseURL }) => {
  test.setTimeout(120_000);
  const userEmail = `cliente-${Date.now()}@example.com`;

  // 1) Un usuario normal se registra y NO ve el panel
  const u = await newPage(browser, baseURL);
  await loginAs(u.page, userEmail);
  const r = await u.page.goto("/admin");
  expect(r!.status()).toBe(404);
  await u.page.goto("/");
  await expect(u.page.getByRole("link", { name: "Administración" })).toHaveCount(0);
  expect((await u.page.request.post("/api/admin/pricing", { data: {} })).status()).toBeGreaterThanOrEqual(400);
  expect((await u.page.request.get("/api/admin/pricing")).status()).toBe(403);
  await u.ctx.close();

  // 2) El administrador entra y gestiona
  const a = await newPage(browser, baseURL);
  const page = a.page;
  await loginAs(page, ADMIN);
  await page.goto("/");
  await expect(page.getByRole("link", { name: "Administración" })).toBeVisible();
  await page.goto("/admin");
  await expect(page.getByRole("heading", { name: "Resumen" })).toBeVisible();
  await expect(page.getByText("Margen")).toBeVisible();
  await page.screenshot({ path: "screenshots/admin-resumen.png", fullPage: true });

  // Regalar créditos a un usuario
  await page.goto(`/admin/usuarios?q=${encodeURIComponent(userEmail)}`);
  await page.getByRole("link", { name: userEmail }).click();
  await expect(page.getByRole("heading", { name: userEmail })).toBeVisible();
  const antes = Number((await page.locator("section").filter({ hasText: /^Créditos/ }).first().locator(".display").innerText()).trim());
  await page.getByLabel("Regalar o quitar créditos").fill("7");
  await page.getByRole("button", { name: "Aplicar" }).click();
  await expect(page.getByRole("status")).toContainText("Créditos actualizados");
  await expect(page.locator("section").filter({ hasText: /^Créditos/ }).first().locator(".display")).toHaveText(String(antes + 7));
  // No se puede dejar el saldo en negativo
  await page.getByLabel("Regalar o quitar créditos").fill("-9999");
  await page.getByRole("button", { name: "Aplicar" }).click();
  await expect(page.getByRole("status")).toContainText(/entre -1000 y 1000|no tiene tantos/);
  await page.screenshot({ path: "screenshots/admin-usuario.png", fullPage: true });

  // Cambiar un precio: la landing lo refleja
  await page.goto("/admin/precios");
  const precio = page.getByLabel("Precio (€ con IVA)").first();
  await precio.fill("5.49");
  await page.getByRole("button", { name: "Guardar cambios" }).click();
  await expect(page.getByRole("status")).toContainText("Precios guardados");
  await page.goto("/");
  await expect(page.getByText(/créditos por 5,49/)).toBeVisible();
  // valores inválidos se rechazan con un mensaje
  await page.goto("/admin/precios");
  await page.getByLabel("Identificador").first().fill("MAL ID");
  await page.getByRole("button", { name: "Guardar cambios" }).click();
  await expect(page.getByRole("status")).toHaveClass(/error/);
  await expect(page.getByRole("status")).toContainText("identificador");
  // restablecer
  await page.goto("/admin/precios");
  page.once("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "Restablecer valores por defecto" }).click();
  await page.waitForLoadState("networkidle");
  await page.goto("/");
  await expect(page.getByText(/créditos por 4,99/)).toBeVisible();

  // Estudios
  await page.goto("/admin/estudios");
  await page.getByLabel("Nombre").fill(`Tinta Prueba ${Date.now() % 10000}`);
  await page.getByLabel("Ciudad").fill("Sevilla");
  await page.getByLabel("Email del responsable").fill(userEmail);
  await page.getByRole("button", { name: "Crear estudio" }).click();
  await expect(page.getByRole("status")).toContainText("Estudio creado");
  await expect(page.getByText("Tinta Prueba").first()).toBeVisible();

  // Registro de auditoría
  await page.goto("/admin/registro");
  await expect(page.getByRole("cell", { name: "user.credits" }).first()).toBeVisible();
  await expect(page.getByRole("cell", { name: "pricing.update" }).first()).toBeVisible();
  await expect(page.getByRole("cell", { name: "org.create" }).first()).toBeVisible();
  await a.ctx.close();
});
