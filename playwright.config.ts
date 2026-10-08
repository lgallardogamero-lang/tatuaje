import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "tests/e2e",
  timeout: 60_000,
  expect: { timeout: 15_000 },
  use: {
    baseURL: "http://localhost:3000",
    launchOptions: { executablePath: process.env.CHROMIUM_PATH ?? "/opt/pw-browsers/chromium", args: ["--no-sandbox"] },
  },
  projects: [
    { name: "escritorio", use: { viewport: { width: 1280, height: 900 } } },
    { name: "movil", use: { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true } },
  ],
});
