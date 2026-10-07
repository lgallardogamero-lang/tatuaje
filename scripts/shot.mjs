// Uso: node scripts/shot.mjs <ruta> <nombre> [ancho] [alto] [espera_ms]
import { chromium } from "@playwright/test";
const [, , route = "/", name = "shot", w = "1280", h = "900", wait = "5200"] = process.argv;
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium", args: ["--no-sandbox"] });
const page = await browser.newPage({ viewport: { width: +w, height: +h } });
const logs = [];
page.on("console", (m) => ["error", "warning"].includes(m.type()) && logs.push(`${m.type()}: ${m.text()}`));
page.on("pageerror", (e) => logs.push(`pageerror: ${e.message}`));
await page.goto(`http://localhost:3000${route}`, { waitUntil: "networkidle" });
await page.waitForTimeout(+wait);
await page.screenshot({ path: `screenshots/${name}.png`, fullPage: process.env.FULL === "1" });
console.log(logs.join("\n") || "sin errores de consola");
await browser.close();
