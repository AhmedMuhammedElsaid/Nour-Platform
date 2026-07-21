# Skeleton loading audit — close remaining gaps (2026-07-21)

## Context

The top-of-page navigation loading bar is already live on all 3 surfaces (web `4d8ce0f`, mobile `25fc77a`, extension `4dd2781`, 2026-07-17) — no work needed there.

Skeleton (placeholder) loading UI exists but is incomplete:

- **Web**: `loading.tsx` Suspense fallbacks exist for home, search, adhkar (list + detail), playlist detail. Missing for quran (list, reader, bookmarks), radio, qibla, prayer-times.
- **Mobile**: shared `<Skeleton>` component (`apps/mobile/components/ui/skeleton.tsx`) exists but per its own doc-comment is only wired into Home and Playlist Detail. Missing for quran (list, reader, bookmarks), radio, adhkar detail, prayer-times, qibla, downloads.
- **Extension**: no skeleton pattern exists anywhere. The newtab SPA (`apps/extension/src/newtab/newtab-page.tsx` + its view components) fetches all content client-side via `getJson` with no placeholder while in flight.

## Goal

Fill these gaps by propagating each surface's own existing convention — no new cross-platform abstraction, since mobile (React Native/NativeWind) cannot share DOM components with web/extension (React DOM/Tailwind), and inventing a shared kit for a mechanical fill-in task would be over-engineering.

## Non-goals

- No changes to the top progress bar (already shipped).
- No shimmer/animation upgrade to mobile's `<Skeleton>` — it is deliberately animation-free today (test-friendly, no running timers); that upgrade is explicitly deferred to a future "Phase 10 polish" per its own comment and is out of scope here.
- No skeleton work in extension popup/options — both are synchronous local-storage reads with no async gap to cover.
- No new test files for the static `loading.tsx` fallbacks (matches existing convention — none of the 5 current ones have a test sibling).

## Design

### 1. Web — 6 new `loading.tsx` files

Next.js Suspense fallback convention, one per route, each a server component marked `aria-hidden="true"`, built from `animate-pulse` + `bg-surface-2` divs shaped to mirror that route's real layout (same recipe as the 5 existing files — see `apps/web/app/[locale]/loading.tsx` and `apps/web/app/[locale]/adhkar/loading.tsx` for the pattern).

| Route | New file |
|---|---|
| Quran surah list | `apps/web/app/[locale]/quran/loading.tsx` |
| Quran reader | `apps/web/app/[locale]/quran/[surah]/loading.tsx` |
| Quran bookmarks | `apps/web/app/[locale]/quran/bookmarks/loading.tsx` |
| Radio | `apps/web/app/[locale]/radio/loading.tsx` |
| Qibla | `apps/web/app/[locale]/qibla/loading.tsx` |
| Prayer times | `apps/web/app/[locale]/prayer-times/loading.tsx` |

Each file's shape is derived by reading its corresponding `page.tsx` at implementation time (e.g. surah list → grid of surah cards; reader → stacked ayah-line blocks; radio → station grid; qibla → compass circle + status text; prayer-times → row list of 5 prayer rows + countdown header).

### 2. Mobile — wire the existing `<Skeleton>` into 8 screens

Reuse `apps/mobile/components/ui/skeleton.tsx` as-is (no changes to the component itself). Each screen gates a set of `<Skeleton className="...">` blocks — shaped to that screen's real content — on its existing TanStack Query `isPending`/`isLoading` state, matching the precedent in Home (`apps/mobile/app/index.tsx`) and Playlist Detail (`apps/mobile/app/playlist/[slug].tsx`, which already gates on `detail.isPending`).

Screens to update: `apps/mobile/app/quran/index.tsx`, `apps/mobile/app/quran/[surah].tsx`, `apps/mobile/app/quran/bookmarks.tsx`, `apps/mobile/app/radio/index.tsx`, `apps/mobile/app/qibla/index.tsx`, `apps/mobile/app/prayer-times/index.tsx`, `apps/mobile/app/adhkar/[slug].tsx`, `apps/mobile/app/downloads.tsx`.

### 3. Extension — new `Skeleton` primitive + wiring into newtab views

New file `apps/extension/src/components/skeleton.tsx`: a single component taking a `className` prop, rendering `<div className={cn("animate-pulse rounded-md bg-surface-2", className)} aria-hidden="true" />`. Safe to build directly on `bg-surface-2`/tokens since `apps/extension/src/styles/tailwind.css` already mirrors `packages/ui/src/styles/tokens.css` 1:1 (confirmed — same token names, same `@theme inline` mapping).

Wire into the newtab view components that fetch via `getJson` and currently render nothing (or a blank flash) while in flight, gating on each view's own existing loading flag (most already track a `data === null` / in-flight boolean locally — no new state pattern introduced):

- `RadioSection` / `RadioPage`
- `AdhkarLanding`, `AdhkarPreviewShelf`, and the `DhikrWidget` in `newtab-page.tsx`
- `QuranLanding`, `QuranReader`, `BookmarksList`
- `PlaylistDetail`
- `SearchView`
- `PrayerPage`

### Testing

- Web: no new tests (matches existing `loading.tsx` convention — untested static fallbacks).
- Mobile: jest-expo, extend each touched screen's existing test (if one exists) to assert the skeleton renders while `isPending`/`isLoading` is true and disappears once data resolves. New screens without an existing test file are left as-is (no test-coverage regression, but not required to add one for a presentational-only change per CLAUDE.md §9 — flag as "no new coverage" per file, not blocking).
- Extension: Vitest unit test for the new `Skeleton` primitive only (pure render, `apps/extension/src/components/skeleton.test.tsx`) — matches CLAUDE.md §9 "Extension logic" bar of testing pure, non-SW pieces. View-level wiring is not independently unit-tested (same rationale as web/mobile: presentational gating on existing, already-tested loading flags).

### Commit plan (per CLAUDE.md §5.1 — one commit per concern)

Three commits, one per surface: `[fix]: web - skeleton loading for quran/radio/qibla/prayer-times routes`, `[fix]: mobile - wire skeleton into remaining screens`, `[feat]: extension - skeleton primitive + newtab loading states`.

### Device/browser verify

Mobile screens and extension newtab views are only visually confirmed on-device/in-browser — same "device-verify pending" flag as other recent mobile/ext work per `APP_CONTEXT.md` convention.
