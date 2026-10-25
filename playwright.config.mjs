import { defineConfig } from "@playwright/test";

const baseURL = "http://127.0.0.1:4173";

export default defineConfig({
  testDir: "./test/browser",
  testMatch: "**/*.spec.mjs",
  workers: 1,
  forbidOnly: !!process.env.CI,
  globalTimeout: 120_000,
  reporter: "list",
  use: {
    baseURL,
    headless: true,
    viewport: { width: 800, height: 600 },
    deviceScaleFactor: 1,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [{ name: "chromium", use: { browserName: "chromium" } }],
  webServer: {
    command: "npm run build && node test/browser/server.mjs",
    url: baseURL,
    reuseExistingServer: false,
    timeout: 30_000,
    gracefulShutdown: { signal: "SIGTERM", timeout: 1_000 },
  },
});
