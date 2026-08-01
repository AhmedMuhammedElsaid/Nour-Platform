"use client";

// Phase 2.2 (defer the client islands): all three of these shelves render
// `null` until device-local data (localStorage) is read on mount — there is
// nothing for them to show during SSR. Code-splitting them out of the home
// route's initial JS graph via next/dynamic({ssr:false}) removes that dead
// weight from the bundle that has to hydrate before the page is interactive.
// dynamic() with ssr:false is illegal in a Server Component
// (app/[locale]/page.tsx), so it's called here instead — see
// deferred-layout-islands.tsx for the same pattern applied to the layout.
import dynamic from "next/dynamic";

import type { Azkar } from "@repo/api/schemas/azkar";
import type { Locale } from "@repo/api/schemas/locale";

// `continue-reading-shelf.tsx` was a near-identical duplicate of
// `continue-reading.tsx` (differing only in a margin class + surahNames
// fallback) — merged during the Phase 2.3 bundle-trim; this island now
// imports the shared component under its home-route alias.
export const ContinueReadingShelf = dynamic(
  () =>
    import("@/features/quran/components/continue-reading").then(
      (m) => m.ContinueReading,
    ),
  { ssr: false },
);

export const ContinueListening = dynamic(
  () =>
    import("@/features/player/components/continue-listening").then(
      (m) => m.ContinueListening,
    ),
  { ssr: false },
);

export const DhikrOfTheDayCard = dynamic<{ sets: Azkar[]; locale: Locale }>(
  () =>
    import("@/features/adhkar/components/dhikr-of-the-day-card").then(
      (m) => m.DhikrOfTheDayCard,
    ),
  { ssr: false },
);
