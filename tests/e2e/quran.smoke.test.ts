import { test, expect } from "@playwright/test";

import { webUrl } from "../../playwright.config";

/*
 * Quran reader smoke test. Requires the Quran seed (`pnpm seed:quran`) to have
 * run against the database the dev server points at — otherwise the surah list
 * is empty. Skip in CI until the seed is wired into the test fixture.
 */
test("quran index lists surahs and the reader renders an ayah", async ({ page }) => {
  await page.goto(`${webUrl}/ar/quran`);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

  // Open Al-Fatihah (surah 1). The quran.com seed romanizes it as "Al-Faatiha".
  await page.getByRole("link", { name: /Al-Faatiha/i }).click();
  await expect(page).toHaveURL(/\/quran\/1/);

  // First ayah article is present.
  await expect(page.locator("#ayah-1")).toBeVisible();
});

test("opening tafsir and bookmarking an ayah works", async ({ page }) => {
  await page.goto(`${webUrl}/en/quran/1`);
  await expect(page.locator("#ayah-1")).toBeVisible();
  // Open tafsir for the first ayah.
  await page.locator("#ayah-1").getByRole("button", { name: /tafsir/i }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  // Close, bookmark, and verify it shows on the bookmarks page.
  await page.keyboard.press("Escape");
  await page.locator("#ayah-1").getByRole("button", { name: /bookmark/i }).click();
  await page.goto(`${webUrl}/en/quran/bookmarks`);
  await expect(page.getByRole("link", { name: "1" })).toBeVisible();
});
