# i18n Embedded Locale Refactor

**Date:** 2026-05-27  
**Status:** Approved  
**Scope:** Playlist, Track, Category — all three content types

---

## Problem

Current architecture stores AR and EN as separate MongoDB documents linked by `contentId`. This doubles document count, adds a `contentId` join concept everywhere, and complicates the admin authoring flow (create AR doc → separately create EN doc → link them).

---

## Decision

Collapse each content type into a single document. Translated fields live in nested locale objects `ar` and `en`. Shared fields stay flat.

---

## Data Shape

```ts
// Playlist
{
  _id, status, coverMediaId, categoryIds, createdAt, updatedAt,
  ar: { title, slug, description? },
  en: { title, slug, description? },
}

// Track
{
  _id, mediaId, playlistId, order, durationSecs?, createdAt, updatedAt,
  ar: { title, slug, description? },
  en: { title, slug, description? },
}

// Category
{
  _id, coverMediaId?, createdAt, updatedAt,
  ar: { name, slug, description? },
  en: { name, slug, description? },
}
```

`playlistId` replaces `playlistContentId` (plain `_id` reference, no more contentId concept).  
`categoryIds` on Playlist now hold category `_id`s (not contentIds).

---

## Indexes

| Collection  | Old                              | New                                      |
|-------------|----------------------------------|------------------------------------------|
| playlists   | `{contentId,locale}` unique      | `{"ar.slug":1}` unique, `{"en.slug":1}` unique |
| tracks      | `{contentId,locale}` unique      | `{"ar.slug":1,"playlistId":1}` unique, `{"en.slug":1,"playlistId":1}` unique |
| categories  | `{contentId,locale}` unique      | `{"ar.slug":1}` unique, `{"en.slug":1}` unique |

---

## Zod Schemas

Add a shared `localeContentSchema` helper:

```ts
const localeContentSchema = z.object({
  title: z.string().min(1).max(200),   // or `name` for Category
  slug: slugSchema,
  description: z.string().max(2000).optional(),
})
```

`playlistSchema` uses `ar: localeContentSchema, en: localeContentSchema` + shared flat fields.  
Same pattern for Track and Category.

---

## Services

- All service methods drop `locale` param on mutations.
- Read methods accept `locale: 'ar' | 'en'` only to build the DTO: `title: doc[locale].title`.
- `createPlaylist` / `createTrack` / `createCategory` no longer mint or accept `contentId`.
- Slug uniqueness: service derives `ar.slug` from `ar.title` and `en.slug` from `en.title` via `slugify()`.
- `playlist.service.ts` `categoryIds` now stores category `_id`s.

---

## Admin (apps/admin)

- Remove locale `<select>` from all forms.
- Both locale sections always visible: `ar.title`, `en.title`, `ar.description`, `en.description` etc.
- Remove "Add EN/AR translation" link from list pages.
- Remove `contentId` column from tables.
- `PlaylistForm`, `CategoryForm`, `TrackList` updated accordingly.

---

## Web (apps/web)

- RSC pages receive `locale` from `[locale]` route segment.
- Read localized fields as `playlist[locale].title`, `playlist[locale].slug`.
- URL routing: `/ar/playlists/[slug]` queries `{"ar.slug": slug}`, `/en/playlists/[slug]` queries `{"en.slug": slug}`.
- `generateMetadata` picks `playlist[locale].title`.
- `CategoryFilterBar` resolves `?category=<slug>` against `ar.slug` or `en.slug` per locale.

---

## Cache Tags

Remove locale-scoped tag helpers (`playlistsHomeTag(locale)` etc.).  
Replace with simple constants: `PLAYLISTS`, `PLAYLIST:${id}`, `CATEGORIES`, `CATEGORY:${id}`.

---

## Migration (`0005-embedded-locale`)

For each collection:
1. Load all documents grouped by `contentId`.
2. For each pair — merge AR doc fields into `ar: {}` and EN doc fields into `en: {}` on the AR doc.
3. Delete the EN doc.
4. Rename `playlistContentId` → `playlistId` on Track documents.
5. Re-link `playlist.categoryIds` from category contentIds → category `_id`s.
6. Drop old indexes, create new ones (handled by `ensureIndexes` after migration).

---

## Tests

- API unit tests: update mocks to use new shape; remove locale-param cases.
- Admin RTL tests: update form interactions (two title inputs instead of locale select).
- Web: update RSC page tests to pass locale and check `doc[locale].title`.
- E2E: update slug lookup assertions.

---

## What Does NOT Change

- `next-intl` messages (`ar.json` / `en.json`) — UI strings only, untouched.
- `useDir()` hook, RTL audio player, hreflang — untouched.
- Upload / Media pipeline — untouched.
- Auth / RBAC — untouched.
