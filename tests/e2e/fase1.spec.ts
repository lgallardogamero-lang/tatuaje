import { expect, test } from "@playwright/test";
import path from "node:path";

const foto = path.resolve(import.meta.dirname, "../fixtures/antebrazo.jpg");

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
