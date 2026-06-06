import { test, expect } from "@playwright/test";

import { webUrl } from "../../playwright.config";

test.describe("Adhkar — smoke", () => {
  test("adhkar: landing → reader → count persists on reload", async ({
    page,
  }) => {
    // Navigate to the AR adhkar landing page.
    await page.goto(`${webUrl}/ar/adhkar`);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

    // Click the first adhkar set card link.
    const cardCount = await page.getByRole("link").count();
    if (cardCount === 0) {
      // No adhkar sets in this environment — skip navigation assertion.
      test.skip();
      return;
    }

    const firstCard = page.getByRole("link").first();
    await firstCard.click();
    await expect(page).toHaveURL(/\/ar\/adhkar\/.+/);

    // The counter is visible and starts at zero.
    const counter = page.getByTestId("counter");
    await expect(counter).toBeVisible();
    await expect(counter).toContainText("0");

    // Tap once — count increments.
    await counter.click();
    await expect(counter).toContainText("1");

    // Reload and confirm count persisted (device-local via localStorage).
    await page.reload();
    await expect(page.getByTestId("counter")).toContainText("1");
  });
});
