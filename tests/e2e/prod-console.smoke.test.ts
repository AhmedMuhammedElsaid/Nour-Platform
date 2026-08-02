import { test, expect, type Page } from "@playwright/test";

// Phase 4 guardrail (plans/please-review-the-web-async-moore.md §4.4).
//
// Loads the key public routes against a REAL deployed origin (prod, or a
// preview) and fails on anything the browser logs as an error — both
// `console` (`page.on("console")`, filtered to type "error") and
// `pageerror` (uncaught exceptions). The `pageerror` channel matters on its
// own: per the React #418 hydration investigation (project_web_hydration_418
// in memory), a hydration text mismatch in production React does NOT always
// surface as a console.error — it can throw and arrive only as `pageerror`.
// A check that only listens to `console` would have missed the exact bug
// this repo already shipped and fixed once.
//
// Deliberately NOT wired into the default `pnpm test:e2e` / CI run: it needs
// a real deployed origin. Hitting production on every PR is either flaky
// (deploy-in-progress, transient network) or too late (the code is already
// live by the time it could fail). Run it by hand after a deploy:
//
//   PROD_CONSOLE_URL=https://nour.example.com pnpm exec playwright test prod-console.smoke.test.ts
//
// If PROD_CONSOLE_URL is unset, every case in this file skips (loudly, via
// test.skip with a reason — not a silent pass) rather than pointing at
// localhost and asserting nothing meaningful.

const BASE_URL = process.env.PROD_CONSOLE_URL;

const LOCALES = ["ar", "en"] as const;
const ROUTES = ["/", "/prayer-times", "/quran", "/radio", "/adhkar", "/search"] as const;

// The ONE known, documented, dev-only false positive (see
// features/seo/components/json-ld.tsx): browsers blank an inline <script>'s
// `nonce` IDL property back to "" once the CSP nonce has been consumed, so
// React's dev-mode hydration-mismatch check for the `nonce` prop logs a
// warning that is never present in a production build (React strips that
// check's detailed message in prod). Matched narrowly — BOTH "nonce" and a
// mismatch/hydration keyword must be present — so it can never swallow an
// unrelated error that merely mentions "nonce" or "hydrate".
function isKnownNonceHydrationWarning(text: string): boolean {
  const lower = text.toLowerCase();
  return lower.includes("nonce") && (lower.includes("did not match") || lower.includes("hydrat"));
}

async function collectPageErrors(
  page: Page,
): Promise<{ consoleErrors: string[]; pageErrors: string[] }> {
  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];

  page.on("console", (msg) => {
    if (msg.type() !== "error") return;
    const text = msg.text();
    if (isKnownNonceHydrationWarning(text)) return;
    consoleErrors.push(text);
  });

  page.on("pageerror", (err) => {
    const text = err.message ?? String(err);
    if (isKnownNonceHydrationWarning(text)) return;
    pageErrors.push(text);
  });

  return { consoleErrors, pageErrors };
}

test.describe("Prod console smoke", () => {
  test.skip(!BASE_URL, "PROD_CONSOLE_URL is not set — see file header for how to run this manually.");

  for (const locale of LOCALES) {
    for (const route of ROUTES) {
      const path = route === "/" ? `/${locale}` : `/${locale}${route}`;

      test(`${path} has a clean console (no console errors, no pageerror)`, async ({ page }) => {
        const { consoleErrors, pageErrors } = await collectPageErrors(page);

        const response = await page.goto(`${BASE_URL}${path}`, { waitUntil: "networkidle" });
        expect(response?.ok(), `${path}: navigation response not ok (status ${response?.status()})`).toBe(true);

        // Settle any late microtask/async errors (e.g. a rejected promise
        // from a client island that mounts just after networkidle).
        await page.waitForTimeout(500);

        expect(pageErrors, `${path}: uncaught pageerror(s)`).toEqual([]);
        expect(consoleErrors, `${path}: console.error(s)`).toEqual([]);
      });
    }
  }
});
