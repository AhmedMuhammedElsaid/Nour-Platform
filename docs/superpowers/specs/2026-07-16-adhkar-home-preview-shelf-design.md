# Adhkar home preview shelf (2026-07-16)

New "Adhkar" row on the home page, all 3 surfaces (web/mobile/extension), mirroring the
existing `RadioPreviewShelf`/`RadioSection` pattern exactly: 5 cards + "Explore more" link.
Placed **after the Radio shelf, before the Library section** — the one slot common to all
3 home layouts.

## 1. Data & ordering

The 6 azkar sets already exist (`scripts/data/adhkar-data.ts` + `seed-adhkar.ts`): Sabah
(morning), Masaa (evening), Sleep, Wake, Mosque, Salah (all `kind: "other"` except the
first two). Public reads already sort by `order` ascending (`findPublishedAzkar`), and
admin already supports drag-drop reordering — same mechanism `RADIO_STATION_ORDER` /
Radio's preview shelf relies on.

**The home shelf shows exactly `[morning, evening, sleep, wake, prayer]` — Mosque is
excluded entirely, not just pushed off the preview slice.**

- Reorder `SETS` in `scripts/seed-adhkar.ts` to
  `[morning, evening, sleep, wake, prayer, mosque]` (swap Salah before Mosque).
- Fix the update-path (existing docs) to also write `order: index`, mirroring the Radio
  precedent (`seed:radio` — "seed NOW writes order on existing rows, was create-only").
  Today's update branch only sets `kind`/titles/`items`, not `order`.
- **Manual step (owner, not automated here):** re-run `pnpm seed:adhkar` against Atlas
  after this ships, or the existing 6 docs keep their old `order` values and the shelf
  shows the wrong 5.
- The shelf component itself just takes `getPublishedAzkar()` (or the equivalent
  `/api/v1/adhkar` fetch) and does `.slice(0, ADHKAR_PREVIEW_COUNT)` — no slug matching,
  no special-casing Mosque in frontend code. Curation lives entirely in `order`.

## 2. Shared constants (`packages/shared-core/src/adhkar/preview.ts`)

New pure module, new `./adhkar/preview` export in `packages/shared-core/package.json`:

```ts
export const ADHKAR_PREVIEW_COUNT = 5;
// Positional, not slug-keyed — coupled to the curated `order` from §1 (same
// single source of truth the whole feature depends on). If that order ever
// changes, update this array to match.
export const ADHKAR_PREVIEW_ICONS = ["🌅", "🌙", "😴", "⏰", "🤲"] as const;
export function previewAdhkarIcon(index: number): string {
  return ADHKAR_PREVIEW_ICONS[index] ?? "📿";
}
```

Rationale: the existing `KIND_EMOJI` map (🌅/🌙/📿) collapses Sleep/Wake/Salah to the same
📿 icon since they share `kind: "other"` — fine on the full `/adhkar` list, but three
identical icons in a 5-card home row defeats the point of a scannable shelf.

## 3. Components (mirrors `RadioPreviewShelf`/`RadioSection` structure 1:1)

| Surface | New file | Data source |
|---|---|---|
| web | `apps/web/features/adhkar/components/adhkar-preview-shelf.tsx` | `getPublishedAzkar()` passed from `app/[locale]/page.tsx` (RSC, same pattern as `listReciters()`/`listStations()`) |
| mobile | `apps/mobile/features/home/components/adhkar-preview-shelf.tsx` | `adhkarListQuery()` (already exists in `lib/queries.ts`) |
| extension | `apps/extension/src/components/adhkar-preview-shelf.tsx` | `fetchAdhkarList()` (already exists in `lib/content.ts`) |

Each: `.slice(0, ADHKAR_PREVIEW_COUNT)`, render a `grid grid-cols-2 sm:grid-cols-3
lg:grid-cols-5` (or RN/ext equivalent) of minimal cards — **icon (positional,
`previewAdhkarIcon(index)`) + title only, no progress bar** — plus a heading + "Explore
more" link matching Radio's header row exactly (`home.adhkar` / `home.adhkarExplore`).

- **Card tap** → that specific set's reader: web `/adhkar/[slug]`, mobile
  `router.push('/adhkar/${slug}')`, extension `navigate({ view: "adhkar-read", slug })`.
- **"Explore more" tap** → the general list: web/mobile `/adhkar`, extension
  `navigate({ view: "adhkar" })`.
- `if (preview.length === 0) return null;` guard, matching Radio/Readers.

## 4. Home page wiring (placement)

Insert directly after the Radio shelf, before the Library/category section, on all 3:

- web `app/[locale]/page.tsx`: after `<RadioPreviewShelf stations={stationViews} />`,
  before `<CategoryFilterBar ... />`
- mobile `app/index.tsx`: after `<RadioPreviewShelf />`, before `{libraryBar}`
- extension `newtab/newtab-page.tsx`: after `<RadioSection ... />`, before
  `<LibrarySection ... />`

## 5. i18n

New keys, mirroring `home.radio`/`home.radioExplore` wording exactly, added to all 3
catalogs:

- `apps/web/messages/{ar,en}.json` → `home.adhkar`, `home.adhkarExplore`
- `apps/mobile/locales/{ar,en}.json` → `home.adhkar`, `home.adhkarExplore`
- `apps/extension/src/lib/i18n.ts` → `home.adhkar`, `home.adhkarExplore`

Card titles come from each set's own `ar.title`/`en.title` (already bilingual data) —
no new per-set i18n keys.

## 6. Tests

- Unit test for `previewAdhkarIcon`/`ADHKAR_PREVIEW_ICONS` (pure, shared-core).
- Component test per surface mirroring the existing `radio-preview-shelf.test.tsx`
  pattern: web Vitest+RTL, mobile jest-expo, extension Vitest — cover the empty-guard,
  the 5-card slice, and that "Explore more" + a card tap navigate correctly.

## Rollout notes

- `pnpm turbo run lint typecheck test build` (full, no `--filter`) before each commit.
- Extension: rebuild both `dist/chrome` + `dist/firefox` after the code lands (reload
  unpacked to verify).
- Mobile: JS-only change → OTA-eligible, no native rebuild.
- **Owner manual step:** re-run `pnpm seed:adhkar` against Atlas so the existing 6 docs
  pick up the corrected `order` (§1) — without this, the shelf shows the wrong 5 sets
  until the reseed runs.
