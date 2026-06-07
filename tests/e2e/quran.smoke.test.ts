import { test, expect } from "@playwright/test";

/*
 * Quran reader smoke test. Requires the Quran seed (`pnpm seed:quran`) to have
 * run against the database the dev server points at — otherwise the surah list
 * is empty. Skip in CI until the seed is wired into the test fixture.
 */
test("quran index lists surahs and the reader renders an ayah", async ({ page }) => {
  await page.goto("/ar/quran");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

  // Open Al-Fatihah (surah 1).
  await page.getByRole("link", { name: /Al-Fatihah/i }).click();
  await expect(page).toHaveURL(/\/quran\/1/);

  // First ayah article is present.
  await expect(page.locator("#ayah-1")).toBeVisible();
});
