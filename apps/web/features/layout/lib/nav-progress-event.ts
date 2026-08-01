// Hoisted out of components/navigation-progress.tsx (Phase 2.2 defer pass) so
// callers that only need to fire an imperative nav-start (e.g. ReadersShelf's
// router.push tap) don't statically pull in the NavigationProgress component
// itself — that component is now lazy-loaded (see
// components/deferred-layout-islands.tsx) to keep it out of the home route's initial
// JS graph. Keep this file component-free; anything imported here is NOT
// code-split.
export const NAV_START_EVENT = "nour:nav-start";

export function startNavigationProgress(): void {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(NAV_START_EVENT));
  }
}
