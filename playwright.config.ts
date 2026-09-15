import { availableParallelism } from "node:os";
import { defineConfig, devices } from "@playwright/test";

function configuredWorkers(): number | string | undefined {
  const value = process.env.PLAYWRIGHT_WORKERS;
  if (value === undefined || /^\d+%$/.test(value)) return value;

  const workers = Number(value);
  if (Number.isSafeInteger(workers) && workers > 0) return workers;

  throw new Error(
    "PLAYWRIGHT_WORKERS must be a positive integer or a percentage such as 50%",
  );
}

export default defineConfig({
  testDir: "./tests/browser",
  globalSetup: "./tests/browser/global-setup.ts",
  fullyParallel: true,
  workers:
    configuredWorkers() ??
    (process.env.CI
      ? "50%"
      : Math.min(4, Math.max(1, Math.floor(availableParallelism() / 2)))),
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: "http://127.0.0.1:4173",
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
