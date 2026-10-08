// Genera capturas para un recorrido visual: `node scripts/tour.mjs` (con `npm run dev` en marcha y la base local migrada).
import { chromium } from "@playwright/test";
import fs from "node:fs";
import { execSync } from "node:child_process";

const BASE = "http://localhost:3000";
const ADMIN = "lgallardogamero@gmail.com";
const FOTO = "tests/fixtures/antebrazo.jpg";
const OUT = "screenshots/tour";
const stamp = Date.now();
const consent = encodeURIComponent(JSON.stringify({ v: 1, analytics: false, marketing: false, ts: Date.now() }));
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium", args: ["--no-sandbox"] });

async function ctx(w, h, { withConsent = true, scale = 1 } = {}) {
  const c = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: scale, baseURL: BASE });
  if (withConsent) await c.addCookies([{ name: "calco_consent", value: consent, url: BASE }]);
  await c.addInitScript(() => document.addEventListener("DOMContentLoaded", () => { const s = document.createElement("style"); s.textContent = "nextjs-portal{display:none!important} body::before{display:none}"; document.head.append(s); }));
  return c;
}
async function login(page, email) {
  await page.goto("/entrar");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Soy mayor de edad.").check();
  await page.getByLabel(/He leído el aviso de privacidad/).check();
  await page.getByRole("button", { name: "Enviarme el enlace" }).click();
  await page.getByTestId("dev-link").click();
  await page.waitForLoadState("networkidle");
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await page.waitForURL(/\/crear$/);
}
const shot = async (page, name, full = false) => { await page.waitForTimeout(500); await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: full }); console.log("✔", name); };
const decoded = (page) => page.evaluate(() => Promise.all([...document.images].map((i) => i.decode().catch(() => {}))));

// --- datos de ejemplo SOLO en la base local: ventas y uso de los últimos 14 días para el gráfico del panel
const day = (n) => new Date(Date.now() - n * 86400000);
const sql = [];
for (let n = 13; n >= 0; n--) {
  const t = day(n).getTime(); const d = day(n).toISOString().slice(0, 10);
  const ventas = [0, 1, 0, 2, 1, 0, 3, 1, 2, 0, 4, 2, 1, 3][13 - n];
  for (let k = 0; k < ventas; k++) sql.push(`INSERT OR IGNORE INTO purchases (id,user_id,product,amount_cents,status,created_at) SELECT 'demo-${n}-${k}', id, '${k % 2 ? "credits:pack30" : "credits:pack10"}', ${k % 2 ? 999 : 499}, 'paid', ${t} FROM users LIMIT 1`);
  sql.push(`INSERT OR REPLACE INTO usage_daily (day,jobs_done,jobs_failed,images) VALUES ('${d}', ${3 + ventas * 4 + (n % 3)}, ${n % 4 === 0 ? 1 : 0}, ${(3 + ventas * 4 + (n % 3)) * 3})`);
}
fs.writeFileSync("/tmp/tour-demo.sql", sql.join(";\n") + ";\n");

// 1) Web pública
let c = await ctx(1280, 820); let p = await c.newPage();
await p.goto("/", { waitUntil: "networkidle" }); await p.waitForTimeout(5600);
await shot(p, "01-landing"); await shot(p, "02-landing-completa", true);
await c.close();
c = await ctx(390, 844, { scale: 2 }); p = await c.newPage();
await p.goto("/", { waitUntil: "networkidle" }); await p.waitForTimeout(5600); await shot(p, "03-landing-movil");
await c.close();
c = await ctx(390, 844, { withConsent: false, scale: 2 }); p = await c.newPage();
await p.goto("/", { waitUntil: "networkidle" }); await shot(p, "04-cookies-movil");
await c.close();

// 2) Asistente y resultado (usuario nuevo)
c = await ctx(1280, 900); p = await c.newPage();
await login(p, `tour-${stamp}@example.com`);
await p.goto("/crear");
await p.getByTestId("photo-input").setInputFiles(FOTO);
await p.getByText(/Foto lista/).waitFor();
await p.getByRole("button", { name: "Brazo", exact: true }).click();
await shot(p, "05-asistente-foto");
await p.getByRole("button", { name: "Continuar con el diseño" }).click();
await p.getByLabel("Descríbelo").fill("Un lobo geométrico en línea fina, blanco y negro, minimalista");
await p.getByRole("button", { name: "Geométrico" }).click();
await shot(p, "06-asistente-diseno");
await p.getByRole("button", { name: "Continuar con la colocación" }).click();
const ed = p.getByRole("application"); await ed.waitFor();
await p.getByRole("radio", { name: "Pintar zona" }).click();
const b = await ed.boundingBox();
await p.mouse.move(b.x + b.width * 0.3, b.y + b.height * 0.42); await p.mouse.down();
await p.mouse.move(b.x + b.width * 0.62, b.y + b.height * 0.5, { steps: 12 }); await p.mouse.move(b.x + b.width * 0.5, b.y + b.height * 0.62, { steps: 12 }); await p.mouse.up();
await shot(p, "07-asistente-colocacion");
await p.getByRole("radio", { name: "Mover" }).click();
await p.getByRole("button", { name: "Generar mi tatuaje" }).click();
await p.getByRole("heading", { name: "Así te queda" }).waitFor({ timeout: 60000 });
await decoded(p); await shot(p, "08-resultado");
await c.close();

// resultado en móvil
c = await ctx(390, 844, { scale: 2 }); p = await c.newPage();
await login(p, `tour-m-${stamp}@example.com`);
await p.goto("/crear");
await p.getByTestId("photo-input").setInputFiles(FOTO); await p.getByText(/Foto lista/).waitFor();
await p.getByRole("button", { name: "Continuar con el diseño" }).click();
await p.getByLabel("Descríbelo").fill("Una rosa fina");
await p.getByRole("button", { name: "Continuar con la colocación" }).click();
await (p.getByRole("application")).waitFor(); await shot(p, "09-colocacion-movil");
await p.getByRole("button", { name: "Generar mi tatuaje" }).click();
await p.getByRole("heading", { name: "Así te queda" }).waitFor({ timeout: 60000 }); await decoded(p); await shot(p, "10-resultado-movil");
await c.close();

// 3) Estudio y administración
const ctxs = {};
const mk = async (k, email, w = 1280, h = 900) => { const cc = await ctx(w, h); const pp = await cc.newPage(); await login(pp, email); ctxs[k] = { c: cc, p: pp }; return pp; };
const owner = await mk("owner", `tour-estudio-${stamp}@example.com`);
const admin = await mk("admin", ADMIN);
const nombre = "Tinta & Hierro";
const alta = await admin.request.post("/api/admin/orgs", { data: { name: nombre, city: "Sevilla", ownerEmail: `tour-estudio-${stamp}@example.com`, plan: "pro" } });
if (alta.status() !== 201) throw new Error("alta " + alta.status() + await alta.text());
const me = await (await owner.request.get("/api/me")).json(); const slug = me.studio.slug;
await owner.request.patch("/api/studio", { data: { listed: true, accentColor: "#ffb347", instagram: "tintayhierro", contactEmail: "hola@tintayhierro.example.com" } });
await owner.goto("/estudio");
await owner.locator("#b-logo").setInputFiles(FOTO); await owner.getByRole("status").first().waitFor();
for (const [n, st] of [["Rosa clásica", "old-school"], ["Daga y rosa", "neotradicional"], ["Mandala", "geometrico"]]) {
  const r = await owner.request.post("/api/studio/flash", { multipart: { name: n, style: st, file: { name: "f.jpg", mimeType: "image/jpeg", buffer: fs.readFileSync(FOTO) } } });
  if (r.status() !== 201) throw new Error("flash " + r.status());
}
// generar en modo estudio con el catálogo, por API, y ver el resultado
const flash = (await (await owner.request.get("/api/studio/flash")).json()).flash;
const opts = { zone: "antebrazo", description: "", style: "old-school", color: "color", size: "mediano", hasReference: false, flashId: flash[0].id, placement: { x: 0.5, y: 0.5, scale: 0.35, rotation: -8, opacity: 0.92 } };
const job = await owner.request.post("/api/jobs", { multipart: { options: JSON.stringify(opts), studio: me.studio.id, photo: { name: "f.jpg", mimeType: "image/jpeg", buffer: fs.readFileSync(FOTO) } } });
const { id: jobId } = await job.json();
await owner.goto(`/crear/${jobId}?e=${slug}`);
await owner.getByRole("heading", { name: "Así te queda" }).waitFor({ timeout: 60000 }); await decoded(owner);
await shot(owner, "11-resultado-estudio");
await owner.goto("/estudio"); await owner.waitForLoadState("networkidle"); await decoded(owner); await shot(owner, "12-panel-estudio", true);
// un cliente contacta para que haya una solicitud
const cli = await mk("cli", `tour-cliente-${stamp}@example.com`);
await cli.request.post("/api/leads", { data: { orgId: me.studio.id, kind: "booking", message: "Me encanta la rosa clásica, ¿tenéis hueco el sábado?", consent: true } });
await owner.goto("/estudio"); await owner.waitForLoadState("networkidle"); await decoded(owner); await shot(owner, "12-panel-estudio", true);

const pub = await ctx(1280, 820); const pp = await pub.newPage();
await pp.goto(`/e/${slug}`, { waitUntil: "networkidle" }); await decoded(pp); await shot(pp, "13-pagina-estudio");
await pp.goto("/directorio/sevilla", { waitUntil: "networkidle" }); await shot(pp, "14-directorio");
await pub.close();

try { execSync("npx wrangler d1 execute tatuaje --local --file /tmp/tour-demo.sql", { stdio: "ignore" }); } catch { console.log("(sin datos de ejemplo)"); }
await admin.goto("/admin"); await admin.waitForLoadState("networkidle"); await admin.waitForTimeout(800); await shot(admin, "15-admin-resumen", true);
await admin.goto("/admin/estudios"); await admin.waitForLoadState("networkidle"); await shot(admin, "16-admin-estudios", true);
await admin.goto("/admin/precios"); await admin.waitForLoadState("networkidle"); await shot(admin, "17-admin-precios", true);
for (const k of Object.keys(ctxs)) await ctxs[k].c.close();
await browser.close();
console.log("listo");
