# ADR 0002 — Allow Unicode (Arabic) slugs

- Status: Accepted
- Date: 2026-05-27
- Deciders: Ahmed (solo)
- Wave: i18n-A (see `localization.md`)

## Context

Content (playlists, categories, tracks) becomes bilingual via per-locale documents
(`DATABASE.md §3`). Each locale's document has its own `slug`, unique per `(locale, slug)`.

The current `slugify()` — duplicated identically in `playlist.service.ts`,
`category.service.ts`, and `track.service.ts` — strips everything outside `[a-z0-9]`:

```ts
title.toLowerCase().trim().replace(/[^a-z0-9\s-]/g, "")...
```

For an Arabic title (e.g. `سورة البقرة`) this produces an **empty string**, which then
fails the `slug` Zod validation / DB `required` constraint. Arabic content cannot be saved.
This is a hard bug introduced the moment Arabic content exists.

## Decision

**Allow Unicode slugs** — keep letters/numbers of any script, collapse whitespace to single
hyphens, no transliteration.

- The shared `slugSchema` regex widens to Unicode property escapes:
  `/^[\p{L}\p{N}]+(?:-[\p{L}\p{N}]+)*$/u` (any letter, any number, hyphen-separated).
- The shared `slugify()` (de-duplicated into `packages/utils` in Phase 2) keeps Latin
  lowercasing and whitespace→hyphen normalization, but no longer strips non-ASCII letters.
- **Fallback:** when normalization yields an empty string (e.g. a title of only punctuation),
  fall back to a short suffix of the document's `contentId` so a valid, unique slug always exists.
- Arabic slugs are percent-encoded in the URL path by the browser/Next.js — this is standard,
  SEO-correct behaviour for non-Latin URLs (Wikipedia, major Arabic sites do the same).

## Consequences

- No new dependency (rejected transliteration libraries — see below).
- Slugs are human-readable in both scripts; Arabic URLs display decoded in modern browsers.
- The `slug` regex no longer enforces lowercase for non-Latin scripts (Arabic has no case);
  Latin slugs are still lowercased by `slugify()` before they reach the DB.
- Per-locale uniqueness means the same logical content can have `surat-al-baqarah` (en) and
  `سورة-البقرة` (ar) as distinct slugs — handled by the `(locale, slug)` unique index.

## Alternatives considered

- **Transliteration** (Arabic → Latin via a lib like `slugify`/`arabic-transliterate`) —
  adds a dependency, produces lossy/ugly Latin slugs Arabic users don't recognize, and still
  needs a fallback. Rejected.
- **contentId-only slugs** (opaque ids) — kills SEO and readability. Rejected.
- **Keep ASCII-only** — blocks Arabic content entirely. Rejected (this is the bug).
