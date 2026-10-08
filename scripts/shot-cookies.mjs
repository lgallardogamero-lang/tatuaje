import { chromium } from "@playwright/test";
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium", args: ["--no-sandbox"] });
for (const [name, w, h] of [["cookies-desktop", 1280, 800], ["cookies-mobile", 390, 800]]) {
  const page = await (await browser.newContext({ viewport: { width: w, height: h } })).newPage();
  await page.goto("http://localhost:3000/", { waitUntil: "networkidle" });
  await page.waitForTimeout(800);
  await page.screenshot({ path: `screenshots/${name}.png` });
}
await browser.close();
