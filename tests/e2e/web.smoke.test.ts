import { test, expect } from "@playwright/test";

import { webUrl } from "../../playwright.config";

test.describe("Web — smoke", () => {
  test("homepage loads and shows playlists heading", async ({ page }) => {
    await page.goto(webUrl);

    // The layout's skip link confirms the shell rendered.
    const skipLink = page.getByRole("link", { name: /skip to main content/i });
    await expect(skipLink).toBeAttached();

    // The homepage heading is always present even when no playlists exist.
    await expect(
      page.getByRole("heading", { name: /playlists/i }),
    ).toBeVisible();
  });

  test("playlist detail page renders track list when given a valid slug", async ({
    page,
  }) => {
    // Navigate to the homepage first to discover a published playlist slug.
    await page.goto(webUrl);

    const firstCard = page.getByRole("link", { name: /listen/i }).first();
    const cardCount = await page
      .getByRole("link", { name: /listen/i })
      .count();

    if (cardCount === 0) {
      // No published playlists in this environment — skip navigation assertion.
      test.skip();
      return;
    }

    const href = await firstCard.getAttribute("href");
    await page.goto(`${webUrl}${href}`);

    // The detail page always renders a Tracks heading once the page loads.
    await expect(page.getByRole("heading", { name: /tracks/i })).toBeVisible();
  });
});
