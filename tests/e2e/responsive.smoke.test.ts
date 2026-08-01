import { test, expect, type Locator, type Page } from "@playwright/test";

import { webUrl } from "../../playwright.config";

// Phase 1.1 guardrail (see plans/please-review-the-web-async-moore.md §1.1).
// Runs against every configured project — chromium (desktop) and the mobile
// Pixel 5 project added in playwright.config.ts. The assertion is viewport-
// relative on purpose: desktop stays green, mobile is where the 360px-wide
// audio player overflow (Phase 1.2) actually shows up.

const LOCALES = ["ar", "en"] as const;

// Routes that need no seeded slug. "/" resolves to the locale root.
const ROUTES = [
  "/",
  "/prayer-times",
  "/quran",
  "/quran/1",
  "/radio",
  "/adhkar",
  "/search",
] as const;

function localizedPath(locale: (typeof LOCALES)[number], route: (typeof ROUTES)[number]): string {
  return route === "/" ? `/${locale}` : `/${locale}${route}`;
}

// Readiness signal must be locale-agnostic: the skip link's text is translated,
// so matching it by name only ever works on /en. The layout's <main> landmark
// carries a stable id in both locales.
async function waitForShell(page: Page): Promise<void> {
  await expect(page.locator("#main-content")).toBeAttached();
}

// A position:fixed element is out of flow, so content overflowing it does NOT
// grow document.documentElement.scrollWidth — measured directly: the player bar
// overflows by 104px at 360px while the document reports no overflow at all.
// Fixed chrome therefore needs its own assertion.
async function assertElementFits(locator: Locator, context: string): Promise<void> {
  const { scrollWidth, clientWidth } = await locator.evaluate((el) => ({
    scrollWidth: el.scrollWidth,
    clientWidth: el.clientWidth,
  }));

  expect(
    scrollWidth,
    `${context}: element scrollWidth=${scrollWidth} > clientWidth=${clientWidth}`,
  ).toBeLessThanOrEqual(clientWidth + 1);
}

// Controls pushed outside the viewport are unreachable by touch. Scoped to
// fixed chrome — horizontal shelves (overflow-x-auto) park items offscreen on
// purpose, so this would be wrong to apply page-wide.
async function assertNoControlsOffscreen(locator: Locator, context: string): Promise<void> {
  const offscreen = await locator.evaluate((el) =>
    [...el.querySelectorAll("button, [role=slider], a, input")]
      .filter((c) => {
        const r = c.getBoundingClientRect();
        return r.width > 0 && (r.left < 0 || r.right > window.innerWidth);
      })
      .map((c) => c.getAttribute("aria-label") ?? c.textContent?.trim().slice(0, 24) ?? "?"),
  );

  expect(offscreen, `${context}: controls outside the viewport: ${offscreen.join(", ")}`).toEqual([]);
}

// Playlist cards are <Link>s to /<locale>/playlists/<slug>. Matching on href
// keeps discovery working in both locales.
async function firstPlaylistHref(page: Page): Promise<string | null> {
  const cards = page.locator('a[href*="/playlists/"]');
  if ((await cards.count()) === 0) return null;
  return cards.first().getAttribute("href");
}

async function assertNoHorizontalOverflow(page: Page, context: string): Promise<void> {
  const { scrollWidth, innerWidth } = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    innerWidth: window.innerWidth,
  }));

  expect(
    scrollWidth,
    `${context}: document.documentElement.scrollWidth=${scrollWidth} > window.innerWidth=${innerWidth} (+1px tolerance)`,
  ).toBeLessThanOrEqual(innerWidth + 1);
}

test.describe("Responsive — no horizontal overflow", () => {
  for (const locale of LOCALES) {
    for (const route of ROUTES) {
      test(`${locale} ${route} has no horizontal overflow`, async ({ page }) => {
        const path = localizedPath(locale, route);
        await page.goto(`${webUrl}${path}`);

        await waitForShell(page);

        await assertNoHorizontalOverflow(page, path);
      });
    }
  }

  // /playlists/<slug> needs a seeded, published playlist. Discover one by href
  // rather than by link text — the card's accessible name is translated, so a
  // /listen/i match silently finds nothing on /ar and skips the test.
  for (const locale of LOCALES) {
    test(`${locale} playlist detail has no horizontal overflow`, async ({ page }) => {
      await page.goto(`${webUrl}/${locale}`);
      await waitForShell(page);

      const href = await firstPlaylistHref(page);
      if (!href) {
        test.skip(true, "no published playlist seeded in this environment");
        return;
      }

      await page.goto(`${webUrl}${href}`);
      await waitForShell(page);

      await assertNoHorizontalOverflow(page, `${locale} playlist detail (${href})`);
    });
  }
});

test.describe("Responsive — Quran reader list layout", () => {
  // DEFAULT_PREFS.layout is "mushaf" (features/quran/lib/quran-prefs.ts), so a
  // fresh context renders ZERO AyahRow components and the route cases above
  // never exercise them — the per-ayah controls were the smallest targets in
  // the app and were entirely uncovered. Seed the pref to force list layout.
  for (const locale of LOCALES) {
    test(`${locale} /quran/1 in list layout has no horizontal overflow`, async ({ page }) => {
      await page.addInitScript(() => {
        window.localStorage.setItem(
          "nour.quran.prefs",
          JSON.stringify({ layout: "list", showTranslation: true }),
        );
      });

      await page.goto(`${webUrl}/${locale}/quran/1`);
      await waitForShell(page);

      // Confirm we are actually testing what we think we are.
      const ayahControls = page.getByRole("button", { name: /tafsir|التفسير/i });
      await ayahControls.first().waitFor({ state: "visible", timeout: 15_000 });

      await assertNoHorizontalOverflow(page, `${locale} /quran/1 (list layout)`);
    });
  }
});

test.describe("Responsive — audio player bar", () => {
  // The critical case (plan §1.1): load a track into the shared player, then
  // assert no overflow. Expected RED on the mobile project until Phase 1.2
  // fixes packages/ui/src/blocks/audio-player/audio-player.tsx — the bar's
  // unshrinkable content (~408px) exceeds the usable width at 360px (~312px).
  test("player bar with a loaded track has no horizontal overflow", async ({ page }) => {
    await page.goto(`${webUrl}/ar`);
    await waitForShell(page);

    const href = await firstPlaylistHref(page);
    if (!href) {
      test.skip(true, "no published playlist seeded in this environment");
      return;
    }

    await page.goto(`${webUrl}${href}`);
    await waitForShell(page);

    // "▶ Play all" is currently hardcoded English in track-list-player.tsx, so
    // this matches on /ar too. If that string is ever translated, this locator
    // must move to a testid or the test will start skipping silently.
    // Must waitFor, not count(): TrackListPlayer is a client island, so an
    // immediate count() reads 0 while it is still hydrating. That made this
    // test skip in a full run but fail when run alone.
    const playAll = page.getByRole("button", { name: /play all/i });
    try {
      await playAll.waitFor({ state: "visible", timeout: 10_000 });
    } catch {
      // Genuinely no playable tracks (every srcUrl null) — skip rather than
      // assert on a bar that never loads.
      test.skip(true, "playlist has no playable tracks");
      return;
    }

    await playAll.click();

    // Wait for the bar to actually be visible (aria-hidden flips false, it
    // slides in) before measuring — see audio-player.tsx's `hasQueue` gate.
    const playerBar = page.getByRole("region", { name: "Audio player" });
    await expect(playerBar).toBeVisible();

    await assertNoHorizontalOverflow(page, "player bar with track playing");
    await assertElementFits(playerBar, "audio player bar");
    await assertNoControlsOffscreen(playerBar, "audio player bar");
  });
});
