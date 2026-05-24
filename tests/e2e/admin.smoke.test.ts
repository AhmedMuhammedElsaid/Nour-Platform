import { test, expect } from "@playwright/test";

import { adminUrl } from "../../playwright.config";

const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? "admin@example.com";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? "change-me";

test.describe("Admin — smoke", () => {
  test("login → playlists list → new playlist form renders", async ({
    page,
  }) => {
    // ── Login ──────────────────────────────────────────────────────────────
    await page.goto(`${adminUrl}/login`);

    await page.getByLabel("Email").fill(ADMIN_EMAIL);
    await page.getByLabel("Password").fill(ADMIN_PASSWORD);
    await page.getByRole("button", { name: /sign in/i }).click();

    // After login the admin is redirected to /playlists (or /).
    await expect(page).toHaveURL(/playlists|\/$/);
    await expect(
      page.getByRole("heading", { name: /playlists/i }),
    ).toBeVisible();

    // ── Navigate to new playlist ───────────────────────────────────────────
    await page.getByRole("link", { name: /new playlist/i }).click();

    await expect(page).toHaveURL(/playlists\/new/);
    await expect(
      page.getByRole("heading", { name: /new playlist/i }),
    ).toBeVisible();

    // The title field must be focusable and accept input.
    const titleInput = page.getByLabel(/title/i);
    await titleInput.fill("Smoke Test Playlist");
    await expect(titleInput).toHaveValue("Smoke Test Playlist");

    // ── Submit the form (creates the playlist) ─────────────────────────────
    await page.getByRole("button", { name: /create playlist/i }).click();

    // A successful create redirects to the edit page for the new playlist.
    await expect(page).toHaveURL(/playlists\/.+\/edit/, { timeout: 10_000 });

    // The track uploader section must be present on the edit page.
    await expect(
      page.getByRole("heading", { name: /tracks/i }),
    ).toBeVisible();
  });

  test("admin can create a category and it appears in the categories list", async ({
    page,
  }) => {
    // ── Login ──────────────────────────────────────────────────────────────
    await page.goto(`${adminUrl}/login`);

    await page.getByLabel("Email").fill(ADMIN_EMAIL);
    await page.getByLabel("Password").fill(ADMIN_PASSWORD);
    await page.getByRole("button", { name: /sign in/i }).click();

    await expect(page).toHaveURL(/playlists|\/$/);

    // ── Navigate to /categories/new ────────────────────────────────────────
    await page.goto(`${adminUrl}/categories/new`);

    await expect(page).toHaveURL(/categories\/new/);
    await expect(
      page.getByRole("heading", { name: /new category/i }),
    ).toBeVisible();

    // ── Fill name; leave slug auto-derived ─────────────────────────────────
    const nameInput = page.getByLabel(/name/i);
    await nameInput.fill("Test Category");
    await expect(nameInput).toHaveValue("Test Category");

    // The slug field must have been auto-derived from the name.
    await expect(page.getByLabel(/slug/i)).toHaveValue("test-category");

    // ── Submit ─────────────────────────────────────────────────────────────
    await page.getByRole("button", { name: /create category/i }).click();

    // A successful create redirects to /categories.
    await expect(page).toHaveURL(/\/categories$/, { timeout: 10_000 });

    // The newly created category must appear in the list.
    await expect(page.getByText("Test Category")).toBeVisible();
  });
});
