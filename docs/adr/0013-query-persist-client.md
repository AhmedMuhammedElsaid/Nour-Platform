# ADR 0013: TanStack Query cache persistence for mobile offline-first

## Status

Accepted (2026-07-17)

## Context

Mobile offline-first pass #1 (prayer times, Qibla, adhkar, Quran reading)
needs the adhkar catalog and Quran surah text to survive an app restart with
no network — today `apps/mobile/app/_layout.tsx` builds a plain in-memory
`QueryClient`, so the entire TanStack Query cache is lost on every cold
start, and screens additionally gate on `isError` before checking for cached
data (fixed separately in the same pass).

## Options

1. **`@tanstack/react-query-persist-client` + `@tanstack/query-async-storage-persister`**
   — first-party TanStack packages. `PersistQueryClientProvider` drop-in
   replaces `QueryClientProvider`; the AsyncStorage persister is pure JS
   (`AsyncStorage` is already a dependency). No native code, no rebuild.
2. Roll a custom AsyncStorage read/write layer around `dehydrate`/`hydrate`
   manually. More code to own for exactly the behavior the first-party
   persister already provides (`maxAge`, `buster`, throttled writes).
3. A dedicated offline-cache library (e.g. WatermelonDB, MMKV-backed cache).
   Heavier, several native modules, well beyond what a query-shape cache
   needs.

## Decision

Option 1. Installed pinned to the exact minor/patch already resolved for
`@tanstack/react-query` in this workspace — `5.101.0` for both persist
packages — so their peer-dependency range (`^5.101.0`) matches with no
version-skew warning.

## Consequences

- Pure JS, OTA-eligible — no native rebuild.
- `maxAge` (persisted-cache retention) is set to 30 days and the
  `QueryClient` default `gcTime` is raised to match (`gcTime >= maxAge`,
  otherwise the in-memory client could garbage-collect a query before the
  persisted copy would have expired it anyway).
- `buster` is wired to `app.json`'s `expo.version`, so any future data-shape
  change ships as a version bump and gets a guaranteed-clean cache instead of
  restoring an incompatible shape.
- The persistence key (`nour.query.cache.v1`) is a mobile-only cache bucket,
  not one of the cross-surface `nour.*` device-local contracts — it never
  needs to match web `localStorage` or the extension's `browser.storage`
  shape.
- Bumping `@tanstack/react-query` later requires bumping both persist
  packages to the same minor in the same commit, or the peer-dependency
  warning returns.
