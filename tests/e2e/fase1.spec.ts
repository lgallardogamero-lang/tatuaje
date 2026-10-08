import { expect, test } from "@playwright/test";
import path from "node:path";

const foto = path.resolve(import.meta.dirname, "../fixtures/antebrazo.jpg");

// Partimos de un usuario que ya eligió sobre las cookies (el aviso se prueba en admin.spec.ts)
test.beforeEach(async ({ context }) => {
  await context.addCookies([{ name: "calco_consent", value: encodeURIComponent(JSON.stringify({ v: 1, analytics: false, marketing: false, ts: Date.now() })), url: "http://localhost:3000" }]);
});

test("landing: se ve el hero y los enlaces principales", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Pruébate el tatuaje");
  await expect(page.getByRole("slider", { name: "Comparar antes y después" })).toBeVisible();
  await page.getByRole("link", { name: "Prueba tu tatuaje gratis" }).click();
  await expect(page).toHaveURL(/\/crear$/);
});

test("asistente: foto, diseño y colocación", async ({ page }, info) => {
  const errores: string[] = [];
  page.on("pageerror", (e) => errores.push(e.message));
  page.on("console", (m) => m.type() === "error" && errores.push(m.text()));

  await page.goto("/crear");
  const continuar = page.getByRole("button", { name: "Continuar con el diseño" });
  await expect(continuar).toBeDisabled();

  // Paso 1: foto
  await page.getByTestId("photo-input").setInputFiles(foto);
  await expect(page.getByText(/Foto lista/)).toBeVisible();
  await page.getByRole("button", { name: "Brazo", exact: true }).click();
  await expect(continuar).toBeEnabled();
  await continuar.click();

  // Paso 2: diseño. Sin descripción ni referencia no se puede seguir.
  const siguiente = page.getByRole("button", { name: "Continuar con la colocación" });
  await expect(siguiente).toBeDisabled();
  await page.getByLabel("Descríbelo").fill("Un lobo geométrico en línea fina");
  await page.getByRole("button", { name: "Geométrico" }).click();
  await page.getByRole("button", { name: "Grande (20 cm)" }).click();
  await expect(siguiente).toBeEnabled();
  await siguiente.click();

  // Paso 3: editor
  const editor = page.getByRole("application");
  await expect(editor).toBeVisible();
  await editor.scrollIntoViewIfNeeded();
  const box = (await editor.boundingBox())!;
  const tam = page.getByLabel("Tamaño", { exact: true });
  const antes = Number(await tam.inputValue());

  // arrastrar mueve el diseño (no cambia el tamaño)
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.7, box.y + box.height * 0.4, { steps: 8 });
  await page.mouse.up();
  expect(Number(await tam.inputValue())).toBe(antes);

  // la rueda cambia el tamaño (solo escritorio)
  if (info.project.name === "escritorio") {
    await page.mouse.move(box.x + box.width * 0.7, box.y + box.height * 0.4);
    await page.mouse.wheel(0, -400);
    await expect.poll(async () => Number(await tam.inputValue())).toBeGreaterThan(antes);
  }

  // teclado: el editor se puede mover con flechas
  await editor.focus();
  await page.keyboard.press("ArrowLeft");

  // pintar zona: crea máscara y activa "Limpiar"
  await page.getByRole("radio", { name: "Pintar zona" }).click();
  await page.mouse.move(box.x + box.width * 0.3, box.y + box.height * 0.3);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.55, box.y + box.height * 0.45, { steps: 10 });
  await page.mouse.up();
  const limpiar = page.getByRole("button", { name: "Limpiar la zona pintada" });
  await expect(limpiar).toBeEnabled();
  await page.screenshot({ path: `screenshots/fase1-editor-${info.project.name}.png` });
  await limpiar.click();
  await expect(limpiar).toBeDisabled();

  // descargar la colocación
  await page.getByRole("radio", { name: "Mover" }).click();
  const [descarga] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "Descargar mi colocación" }).click()]);
  expect(descarga.suggestedFilename()).toBe("calco-colocacion.png");

  expect(errores, errores.join("\n")).toEqual([]);
});

test("asistente: rechaza archivos que no son imagen", async ({ page }) => {
  await page.goto("/crear");
  await page.getByTestId("photo-input").setInputFiles({ name: "malo.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.4 hola") });
  await expect(page.locator("p[role=alert]")).toContainText("Formato no válido");
  await expect(page.getByRole("button", { name: "Continuar con el diseño" })).toBeDisabled();
});

test("acceso por enlace mágico y cuenta", async ({ page }) => {
  const email = `prueba-${Date.now()}-${Math.floor(Math.random() * 1e6)}@example.com`;
  await page.goto("/cuenta");
  await expect(page).toHaveURL(/\/entrar/); // sin sesión redirige

  const enviar = page.getByRole("button", { name: "Enviarme el enlace" });
  await page.getByLabel("Email").fill(email);
  await expect(enviar).toBeDisabled(); // faltan las confirmaciones
  await page.getByLabel("Soy mayor de edad.").check();
  await page.getByLabel(/He leído el aviso de privacidad/).check();
  await enviar.click();

  const enlace = page.getByTestId("dev-link");
  await expect(enlace).toBeVisible();
  await enlace.click();
  await page.waitForLoadState("networkidle"); // esperar a que la página esté lista antes de pulsar
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await expect(page).toHaveURL(/\/crear$/);

  await page.goto("/cuenta");
  await expect(page.getByText("Créditos disponibles")).toBeVisible();
  await expect(page.getByText(email)).toBeVisible();

  // el mismo enlace no se puede usar dos veces
  await page.getByRole("button", { name: "Cerrar sesión" }).click();
  await expect(page).toHaveURL(/\/$/);
});

test("generación completa: entrar, generar, comparar, quitar marca y paywall", async ({ page }, info) => {
  test.setTimeout(120_000);
  const email = `gen-${info.project.name}-${Date.now()}@example.com`;
  await page.goto("/crear");
  await page.getByTestId("photo-input").setInputFiles(foto);
  await expect(page.getByText(/Foto lista/)).toBeVisible();
  await page.getByRole("button", { name: "Continuar con el diseño" }).click();
  await page.getByLabel("Descríbelo").fill("Un lobo geométrico en línea fina");
  await page.getByRole("button", { name: "Continuar con la colocación" }).click();
  await expect(page.getByRole("application")).toBeVisible();

  // Sin sesión: aparece el acceso dentro de la misma pantalla
  await page.getByRole("button", { name: "Generar mi tatuaje" }).click();
  const dialogo = page.getByRole("dialog");
  await expect(dialogo).toBeVisible();
  await dialogo.getByLabel("Email").fill(email);
  await dialogo.getByLabel("Soy mayor de edad.").check();
  await dialogo.getByLabel(/He leído el aviso de privacidad/).check();
  await dialogo.getByRole("button", { name: "Enviarme el enlace" }).click();
  const href = await dialogo.getByTestId("dev-link").getAttribute("href");

  // El enlace se abre en OTRA pestaña; esta detecta la sesión y continúa sola
  const otra = await page.context().newPage();
  await otra.goto(href!);
  await otra.waitForLoadState("networkidle");
  await otra.getByRole("button", { name: "Entrar", exact: true }).click();
  await expect(otra).toHaveURL(/\/crear$/);
  await otra.close();

  await expect(page).toHaveURL(/\/crear\/[0-9a-f-]{36}$/, { timeout: 30_000 });
  await expect(page.getByRole("heading", { name: "Así te queda" })).toBeVisible({ timeout: 45_000 });

  // Pruebas gratis: 1 variante y marca de agua
  await expect(page.getByRole("tab")).toHaveCount(0);
  await expect(page.getByRole("slider", { name: /Comparar tu foto/ })).toBeVisible();
  await expect(page.getByRole("button", { name: "Descargar con marca de agua" })).toBeVisible();
  // las imágenes del resultado deben cargarse de verdad (no solo existir en el DOM)
  await expect
    .poll(() => page.evaluate(() => [...document.querySelectorAll("img")].filter((i) => i.src.includes("/files/")).map((i) => i.complete && i.naturalWidth > 0)))
    .toEqual([true, true]);
  await page.evaluate(() => Promise.all([...document.querySelectorAll("img")].map((i) => i.decode().catch(() => {}))));
  const caja = await page.getByRole("slider", { name: /Comparar tu foto/ }).locator("xpath=..").boundingBox();
  expect(caja!.height, "la zona de comparación debe tener altura").toBeGreaterThan(100);
  await page.screenshot({ path: `screenshots/fase2-resultado-${info.project.name}.png` });

  const [d1] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "Descargar con marca de agua" }).click()]);
  expect(d1.suggestedFilename()).toBe("calco-tatuaje-1.png");

  // Quitar la marca de agua con créditos (2 de los 2 que quedan)
  await page.getByRole("button", { name: "2 créditos" }).first().click();
  await expect(page.getByRole("button", { name: "Descargar en alta resolución" })).toBeVisible();

  // Sin créditos: regenerar abre el paywall; el pago no está configurado en local
  await page.getByRole("button", { name: /Regenerar/ }).click();
  await expect(page.getByRole("dialog")).toContainText("Te has quedado sin créditos");
  // sin consentimiento expreso no se puede pagar
  await expect(page.getByRole("button", { name: /30\s*créditos/ })).toBeDisabled();
  await page.getByRole("dialog").getByLabel(/pierdo el derecho de desistimiento/).check();
  await page.getByRole("button", { name: /30\s*créditos/ }).click();
  await expect(page.getByRole("dialog").getByRole("alert")).toContainText("pagos aún no están activados");
});
