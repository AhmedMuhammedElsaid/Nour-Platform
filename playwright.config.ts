import { defineConfig, devices } from "@playwright/test";

const webUrl =
  process.env.PLAYWRIGHT_WEB_URL ?? "http://localhost:3000";
const adminUrl =
  process.env.PLAYWRIGHT_ADMIN_URL ?? "http://localhost:3001";

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 30_000,
  retries: process.env.CI ? 1 : 0,
  // Smoke tests run serially — they depend on shared DB state.
  workers: 1,
  use: {
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  // When PLAYWRIGHT_WEB_URL / PLAYWRIGHT_ADMIN_URL are set (CI/preview), skip
  // auto-start. Locally, start both dev servers if they're not already running.
  webServer:
    process.env.PLAYWRIGHT_WEB_URL
      ? undefined
      : [
          {
            command: "pnpm --filter web dev",
            url: webUrl,
            reuseExistingServer: true,
            timeout: 60_000,
          },
          {
            command: "pnpm --filter admin dev",
            url: adminUrl,
            reuseExistingServer: true,
            timeout: 60_000,
          },
        ],
});

export { webUrl, adminUrl };
