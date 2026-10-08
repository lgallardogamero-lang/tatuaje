import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import path from "node:path";

const foto = path.resolve(import.meta.dirname, "../fixtures/antebrazo.jpg");
const consent = encodeURIComponent(JSON.stringify({ v: 1, analytics: false, marketing: false, ts: Date.now() }));

test.beforeEach(async ({ context }) => {
  await context.addCookies([{ name: "calco_consent", value: consent, url: "http://localhost:3000" }]);
});

/** Falla ante cualquier problema serio o crítico de WCAG 2.1 A/AA. */
async function auditar(page: Page, donde: string) {
  await page.waitForTimeout(600); // deja terminar las transiciones: axe mide mal el contraste con opacidad parcial
  const r = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  const graves = r.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
  const resumen = graves.map((v) => `${v.id} (${v.impact}): ${v.help}\n  ${v.nodes.slice(0, 3).map((n) => n.target.join(" ")).join("\n  ")}`).join("\n");
  expect(graves, `${donde}\n${resumen}`).toEqual([]);
}

test("accesibilidad: páginas públicas", async ({ page }) => {
  for (const url of ["/", "/entrar", "/estudios", "/directorio", "/privacidad", "/terminos", "/cookies", "/aviso-legal"]) {
    await page.goto(url);
    await page.waitForLoadState("networkidle");
    await auditar(page, url);
  }
});

test("accesibilidad: banner de cookies y su panel", async ({ browser, baseURL }) => {
  const ctx = await browser.newContext({ baseURL });
  const page = await ctx.newPage();
  await page.goto("/");
  await expect(page.getByRole("region", { name: "Aviso de cookies" })).toBeVisible();
  await auditar(page, "banner de cookies");
  await page.getByRole("button", { name: "Configurar" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await auditar(page, "panel de cookies");
  await ctx.close();
});

test("accesibilidad: asistente de creación en sus tres pasos", async ({ page }) => {
  await page.goto("/crear");
  await page.waitForLoadState("networkidle");
  await auditar(page, "/crear paso 1 vacío");
  await page.getByTestId("photo-input").setInputFiles(foto);
  await expect(page.getByText(/Foto lista/)).toBeVisible();
  await auditar(page, "/crear paso 1 con foto");
  await page.getByRole("button", { name: "Continuar con el diseño" }).click();
  await page.getByLabel("Descríbelo").fill("Un lobo geométrico");
  await auditar(page, "/crear paso 2");
  await page.getByRole("button", { name: "Continuar con la colocación" }).click();
  await expect(page.getByRole("application")).toBeVisible();
  await auditar(page, "/crear paso 3");
});

test("accesibilidad: cuenta y resultado", async ({ page }) => {
  test.setTimeout(120_000);
  const email = `axe-${Date.now()}@example.com`;
  await page.goto("/entrar");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Soy mayor de edad.").check();
  await page.getByLabel(/He leído el aviso de privacidad/).check();
  await page.getByRole("button", { name: "Enviarme el enlace" }).click();
  await auditar(page, "/entrar tras enviar el enlace");
  await page.getByTestId("dev-link").click();
  await page.waitForLoadState("networkidle");
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await expect(page).toHaveURL(/\/crear$/);

  await page.goto("/cuenta");
  await auditar(page, "/cuenta");

  // generar para auditar el resultado
  await page.goto("/crear");
  await page.getByTestId("photo-input").setInputFiles(foto);
  await page.getByRole("button", { name: "Continuar con el diseño" }).click();
  await page.getByLabel("Descríbelo").fill("Una rosa");
  await page.getByRole("button", { name: "Continuar con la colocación" }).click();
  await page.getByRole("button", { name: "Generar mi tatuaje" }).click();
  await expect(page.getByRole("heading", { name: "Así te queda" })).toBeVisible({ timeout: 45_000 });
  await page.evaluate(() => Promise.all([...document.querySelectorAll("img")].map((i) => i.decode().catch(() => {}))));
  await auditar(page, "resultado");
});

test("accesibilidad: panel de administración", async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto("/entrar");
  await page.getByLabel("Email").fill("lgallardogamero@gmail.com"); // administrador de ADMIN_EMAILS en .dev.vars
  await page.getByLabel("Soy mayor de edad.").check();
  await page.getByLabel(/He leído el aviso de privacidad/).check();
  await page.getByRole("button", { name: "Enviarme el enlace" }).click();
  await page.getByTestId("dev-link").click();
  await page.waitForLoadState("networkidle");
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await expect(page).toHaveURL(/\/crear$/);
  for (const url of ["/admin", "/admin/usuarios", "/admin/estudios", "/admin/precios", "/admin/registro"]) {
    await page.goto(url);
    await page.waitForLoadState("networkidle");
    await auditar(page, url);
  }
});
