// Genera public/og.png (1200x630) a partir de la landing en marcha: `node scripts/og.mjs`
import { chromium } from "@playwright/test";
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium", args: ["--no-sandbox"] });
const ctx = await browser.newContext({ viewport: { width: 1200, height: 630 } });
await ctx.addCookies([{ name: "calco_consent", value: encodeURIComponent(JSON.stringify({ v: 1, analytics: false, marketing: false, ts: Date.now() })), url: "http://localhost:3000" }]);
const page = await ctx.newPage();
await page.goto("http://localhost:3000/", { waitUntil: "networkidle" });
await page.addStyleTag({ content: "header{display:none!important} .wrap{padding-top:3.5rem!important} body::before{display:none} nextjs-portal{display:none!important}" });
await page.waitForTimeout(5600);
await page.screenshot({ path: "public/og.png" });
await browser.close();
