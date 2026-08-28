import { defineConfig, devices } from "@playwright/test";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineBddConfig } from "playwright-bdd";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const e2ePort = process.env.E2E_PORT ?? "3005";
const baseURL = process.env.E2E_BASE_URL ?? `http://127.0.0.1:${e2ePort}`;

const testDir = defineBddConfig({
  features: "features/**/*.feature",
  steps: "features/steps/**/*.ts",
});

export default defineConfig({
  testDir,
  outputDir: path.join(__dirname, "test-results"),
  snapshotPathTemplate: path.join(
    __dirname,
    "snapshots",
    "{testFileName}",
    "{arg}{-projectName}{ext}",
  ),
  globalSetup: "./global-setup.ts",
  fullyParallel: false,
  workers: 1,
  timeout: 60_000,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: [
    ["list"],
    ["html", { open: "never", outputFolder: path.join(__dirname, "playwright-report") }],
  ],
  use: {
    baseURL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    // Use vite binary directly — pnpm/rtk shims can hang under Playwright's webServer runner
    command: `node e2e/start-web-server.mjs`,
    url: baseURL,
    // Always start a fresh e2e server with the fixture app DB
    reuseExistingServer: false,
    timeout: 180_000,
    cwd: path.join(__dirname, ".."),
  },
});
