// Graba una escena HTML fotograma a fotograma y la convierte en MP4 vertical (1080x1920, H.264).
//   node marketing/build/render-video.mjs v1-satisfactorio            -> marketing/salida/videos/v1-satisfactorio.mp4
//   node marketing/build/render-video.mjs v1-satisfactorio --at 1,4,9  -> solo guarda esos instantes como PNG para revisarlos
import { chromium } from "@playwright/test";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const [name, ...rest] = process.argv.slice(2);
if (!name) { console.error("Uso: render-video.mjs <escena> [--at 1,2,3] [--fps 30]"); process.exit(1); }
const at = rest.includes("--at") ? rest[rest.indexOf("--at") + 1].split(",").map(Number) : null;
const fps = rest.includes("--fps") ? Number(rest[rest.indexOf("--fps") + 1]) : 30;
const root = path.resolve(import.meta.dirname, "..");
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium", args: ["--no-sandbox", "--allow-file-access-from-files"] });
const page = await (await browser.newContext({ viewport: { width: 540, height: 960 }, deviceScaleFactor: 2 })).newPage();
page.on("pageerror", (e) => console.error("Error en la escena:", e.message));
await page.goto(`file://${root}/escenas/${name}.html`);
await page.evaluate(() => document.fonts.ready);
await page.waitForFunction(() => typeof window.render === "function");
const duration = await page.evaluate(() => window.DURATION);

if (at) {
  const dir = path.resolve(root, "..", "screenshots", "marketing");
  fs.mkdirSync(dir, { recursive: true });
  for (const t of at) {
    await page.evaluate((t) => window.render(t), t);
    await page.screenshot({ path: `${dir}/${name}-${String(t).replace(".", "_")}s.png` });
  }
  console.log("instantes guardados en", dir);
  await browser.close();
  process.exit(0);
}

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "calco-frames-"));
const frames = Math.round(duration * fps);
const t0 = Date.now();
for (let i = 0; i < frames; i++) {
  await page.evaluate((t) => window.render(t), i / fps);
  await page.screenshot({ path: `${tmp}/f${String(i).padStart(5, "0")}.jpg`, type: "jpeg", quality: 93 });
  if (i % 60 === 0) console.log(`  ${i}/${frames} (${((Date.now() - t0) / 1000).toFixed(0)} s)`);
}
await browser.close();
const out = `${root}/salida/videos/${name}.mp4`;
const r = spawnSync("ffmpeg", ["-y", "-loglevel", "error", "-framerate", String(fps), "-i", `${tmp}/f%05d.jpg`, "-c:v", "libx264", "-preset", "slow", "-crf", "20", "-pix_fmt", "yuv420p", "-movflags", "+faststart", out], { stdio: "inherit" });
fs.rmSync(tmp, { recursive: true, force: true });
if (r.status !== 0) process.exit(1);
console.log(`✔ ${out} (${duration} s, ${fps} fps, ${(fs.statSync(out).size / 1024 / 1024).toFixed(1)} MB)`);
