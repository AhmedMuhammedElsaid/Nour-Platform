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
    {
      // Phone-width guardrail. Scoped to the responsive spec on purpose: the
      // other suites (incl. the admin CMS, which is desktop-only) have no
      // phone-specific assertions, so running them here would only add noise.
      name: "mobile-chromium",
      // Pixel 5 for a real mobile UA / touch / DPR, but the viewport is pinned
      // to 360px — the narrowest width in common Android use, and the width the
      // responsive work targets. Pixel 5's own 393px would let 360-only
      // regressions through.
      use: { ...devices["Pixel 5"], viewport: { width: 360, height: 800 } },
      testMatch: /responsive\.smoke\.test\.ts/,
    },
  ],
  // When PLAYWRIGHT_WEB_URL / PLAYWRIGHT_ADMIN_URL are set (CI/preview), skip
  // auto-start. Locally, start both dev servers if they're not already running.
  // PROD_CONSOLE_URL also skips it: that run targets a deployed origin, so
  // booting two local dev servers costs up to two minutes and, on a machine
  // without MONGODB_URI, fails the run outright before it can reach prod.
  webServer:
    process.env.PLAYWRIGHT_WEB_URL || process.env.PROD_CONSOLE_URL
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
