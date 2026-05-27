# Localization (Arabic + English) — Nour Platform

## Context

The platform is an Islamic content site for which Arabic is the natural primary language, yet today it is single-locale and English-only: both apps hardcode `<html lang="en">`, there is no `dir` attribute, no Arabic font, no i18n library, and all content (playlist/category/track titles + descriptions) is stored as single plain strings. The repo docs already prescribe the target shape — **ARCHITECTURE.md §7** (sub-path `/ar` `/en`, `dir` on `<html>` + Tailwind `rtl:` variants, a `packages/ui/hooks/useDir`) and **DATABASE.md §3** (per-locale content documents linked by a shared `contentId`) — but none of it is built. i18n was always planned as "Phase 2-F" (CLAUDE.md §15.3).

**Product decisions locked for this work:**
1. **Scope:** UI chrome **+ bilingual content** (a real data-model migration, not just string extraction).
2. **Apps:** Only `apps/web` (public) gets full localization — routing, RTL, translated chrome. `apps/admin` **chrome stays English**, but admin must be able to **author both AR and EN versions** of every content item.
3. **Default + routing:** Arabic is the default locale; URLs are **always prefixed** (`/ar/...`, `/en/...`); root `/` redirects by `Accept-Language`.

**Outcome:** visitors browse a fully Arabic-or-English, RTL-correct public site; content exists independently per locale (AR can publish before EN); the admin authors both languages from an English CMS.

**Recommended dependency:** `next-intl` (file-based JSON messages, App Router-native, RSC `getTranslations` + client `useTranslations`). This **replaces** the DB `translations` collection sketched in DATABASE.md §4.12 — ~30 static strings don't justify a DB round-trip. Record this in an ADR.

This is large; ship it as **two sub-waves** (backend first, then frontend) — the data model must land and be verified before the public UI is meaningful.

---

## Model per phase (CLAUDE.md §15)

Run **one phase per session/prompt** (§15.5) and switch models per phase — don't commit to one model for the whole wave. If a Sonnet phase stalls twice, escalate that phase to Opus rather than re-prompting (§15.4).

| Phase | Model | Why |
|---|---|---|
| 0 — ADRs | **Opus** | §15.1 writing decisions the repo depends on |
| 1 — Schemas + models + migration | **Opus** | §15.1 first migration of its kind; destructive data migration |
| 2 — Services/repos locale-aware | **Sonnet**, *track refactor → Opus* | locale threading is mechanical; `trackIds` removal changes a public contract |
| 3 — Admin authoring | **Sonnet** | §15.2 forms on existing sibling pattern |
| 4 — Web routing + RTL + CSP-proxy | **Opus** | §15.1 first-of-kind routing + auth/CSP-sensitive proxy |
| 5 — SEO/hreflang | **Sonnet** | standard `generateMetadata` |
| 6 — Tests | **Sonnet** (Haiku for mechanical churn) | §15.2/§15.3 |

---

## Core data-model decision (load-bearing)

Adopt DATABASE.md §3 **per-locale documents**, but only for *narrative* collections. Media stays locale-neutral and is referenced by `_id` (an AR playlist and its EN translation are the **same audio program** with translated metadata — never re-upload audio per locale).

| Collection | Per-locale? | Change |
|---|---|---|
| `playlists` | **Yes** | add `contentId` + `locale`; `categoryIds[]` stores category **contentIds** (locale-agnostic links); `coverMediaId` stays `_id`; **drop `trackIds[]`** (see ordering below) |
| `tracks` | **Yes** | add `contentId` + `locale`; `playlistId` → `playlistContentId`; `mediaId` stays `_id` (shared audio) |
| `categories` | **Yes** | add `contentId` + `locale` |
| `media` | **No** | unchanged |
| `users` | **No** | optional `locale` UI-pref deferred |

**Ordering:** today there are two sources of truth — `Playlist.trackIds[]` (model comment calls it authoritative) **and** `Track.order` — kept in sync by `reorderTracks`. Across locales that sync is untenable. Post-migration, `Track.order` is the sole authority and the player queue is `tracks.find({ playlistContentId, locale }).sort({ order: 1 })`. **This is the single riskiest refactor** — it changes a contract the public detail page and admin reorder UI both depend on.

**Slug uniqueness:** changes from global-unique to compound `{ locale, slug }` unique (tracks: `{ playlistContentId, locale, slug }`).

**Arabic slug bug:** the three identical `slugify()` functions (`playlist.service.ts:71-79`, `category.service.ts:56-64`, `track.service.ts:72-80`) strip to `[a-z0-9]` → **empty slug for any pure-Arabic title**. Fix by allowing Unicode slugs (widen regex, keep Arabic letters, URL-encoded in path) with a `contentId`-suffix fallback when normalization is empty. No new dependency. De-duplicate the function into `packages/utils` (ARCHITECTURE.md monorepo layout already reserves `utils/` for slug/i18n).

---

## Wave i18n-A — Backend (independently shippable)

### Phase 0 — ADRs (blocking; no `docs/adr/` exists yet)
- `docs/adr/0001-next-intl.md` — adopt next-intl for chrome; reject the DB `translations` collection.
- `docs/adr/0002-arabic-slugs.md` — allow Unicode slugs + contentId fallback (no transliteration dep).

### Phase 1 — Schemas, models, migration (Opus — first migration of its kind)
- `packages/api/src/schemas/locale.ts` **(new)** — `localeSchema = z.enum(['ar','en'])`, `DEFAULT_LOCALE='ar'`, `LOCALES`. Single source, imported by apps + services.
- `schemas/playlist.ts`, `schemas/category.ts`, `schemas/track.ts` — add `locale` + `contentId`; widen slug schema to Unicode; track `playlistId` → `playlistContentId`.
- `db/models/playlist.model.ts` — add `locale`/`contentId`; remove `unique:true` on `slug` (line 18) + the `{status,slug}` index (line 38); add `{locale,slug}` unique, `{contentId,locale}` unique, `{status,locale,updatedAt:-1}`; drop `trackIds` (line 32).
- `db/models/Category.model.ts`, `db/models/track.model.ts` — mirror (track: `{playlistContentId,locale,slug}` unique, `{playlistContentId,locale,order}`).
- `db/migrations/0003-i18n-backfill.ts` **(new)** — idempotent data migration: set `locale='ar'`, assign a fresh `contentId` per item, set track `playlistContentId` from parent, `$unset` `trackIds`. Skip docs already migrated.
- `db/migrations/0004-i18n-indexes.ts` **(new)** — drop old unique slug indexes, build new compound ones. **Must run after 0003** (build `{locale,slug}` unique only once `locale` is backfilled, else dup-null failure).
- Register both: `scripts/migrate.ts` (imports lines 5-6, array line 27) **and** `packages/api/package.json` `exports` (mirror existing 0001/0002 entries) — omitting either breaks the runner.
- Tests: unit on 0003 backfill shape (contentId assigned, locale=ar, trackIds unset).

### Phase 2 — Services & repos locale-aware (Sonnet; track refactor = Opus)
- `cache/tags.ts` — make tags locale-scoped: `playlistsHome(locale)`, `playlist(locale,slug)`, `categories(locale)`; update every `revalidateTag` callsite.
- `repositories/playlist.repo.ts` — read methods take `locale`; **delete `appendTrackId`/`removeTrackId` (lines 82-107)**; category filter matches by contentId.
- `repositories/category.repo.ts`, `repositories/track.repo.ts` — locale param; tracks keyed by `playlistContentId`+`locale`.
- `services/playlist.service.ts`, `category.service.ts`, `track.service.ts` — thread `locale` through public reads + mutations; category cross-checks by contentId; cascade `$pull` by category contentId across both locales; **`track.service.reorderTracks` writes only `Track.order`** (drop trackIds-mirror sync); use shared Unicode `slugify` from `packages/utils`.
- Tests (CLAUDE.md §9): locale-filter cases; regression that an Arabic-only title yields a non-empty slug; same-slug-different-locale collision allowed.

### Phase 3 — Admin authoring, chrome stays English (Sonnet)
- **UX: "create translation" flow** (not side-by-side — that fights the single-locale TanStack form). Admin edits one locale at a time; playlist/category **list** pages group rows by `contentId` and show locale-completeness badges (ar ✓ / en —) with an "Add English"/"Add Arabic" action opening the same form pre-seeded with `contentId` + target `locale`.
- `apps/admin/features/playlists/components/playlist-form.tsx` (+ category form) — add `locale`/`contentId` props threaded through; chrome labels unchanged (English).
- `*-form.schema.ts` + `create-*/update-*.action.ts` — carry `locale`/`contentId`; reuse existing `contentId` on translation create.
- Admin list pages — group by `contentId`, render badges (main net-new admin UI).
- Tests: RTL component test for locale-aware form; action integration asserting contentId reuse.

---

## Wave i18n-B — Frontend (depends on A)

### Phase 4 — Web routing, RTL, fonts, chrome (Opus — routing + CSP interaction)
- Restructure `apps/web/app/*` under `apps/web/app/[locale]/` (homepage + `playlists/[slug]`); both keep `dynamic = "force-dynamic"`. Pass `locale` to services; keep the slug→ObjectId category resolution in the RSC but against `listCategories(locale)`.
- `apps/web/app/[locale]/layout.tsx` **(new)** — `<html lang={locale} dir={...}>`; load an Arabic font (recommend **IBM Plex Sans Arabic** or **Noto Naskh Arabic** via `next/font/google`) alongside Inter/Fraunces with a CSS-var swap; wrap `NextIntlClientProvider` + `setRequestLocale`. Move the `lang` hardcode out of the slimmed root `app/layout.tsx`.
- **`apps/web/proxy.ts` — COMPOSE, do not replace.** Keep the per-request nonce + CSP logic; call next-intl's routing handler inside the same `proxy()` and attach the CSP header to the response it returns (including the root `/`→locale redirect). Matcher unchanged. **Verify the redirect response still carries the CSP header.**
- `packages/ui/src/hooks/use-dir.ts` **(new)** — returns `'rtl'|'ltr'` (ARCHITECTURE.md §7 promises it; `packages/ui/src/hooks/` is currently empty); add ui export entry. Server render sets `dir` directly; hook is for client islands (audio player).
- RTL audit: CLAUDE.md §4.3 already mandates `ms-`/`me-`, so RTL is mostly free — audit the audio-player block + any literal `left/right`/`pl-`/`pr-` and convert to logical + `rtl:` variants where truly directional.
- `apps/web/messages/ar.json` + `en.json` **(new)** — ~30 keys namespaced (`common`/`nav`/`player`/`playlist`); extract hardcoded strings (skip-link, "Playlists", empty states, "Tracks"/"track(s)", header/footer). Convert components to `useTranslations`/`getTranslations`. Fix `toLocaleDateString("en-US")` in `playlists/[slug]/page.tsx` to be locale-aware.
- `apps/web/i18n/routing.ts` + `i18n/request.ts` **(new)**; wrap `apps/web/next.config.ts` with `createNextIntlPlugin`.

### Phase 5 — SEO + hreflang (Sonnet)
- `generateMetadata` in `[locale]/playlists/[slug]/page.tsx` + `[locale]/page.tsx` — add `alternates.languages` (hreflang), per-locale `canonical`, `openGraph.locale`. **Slugs differ per locale**, so hreflang can't path-swap — add a service helper `getSlugForLocale(contentId, locale)` (or return both slugs from `getPlaylistBySlug`). Use `env.NEXT_PUBLIC_WEB_URL`. Emit both locales in `sitemap` if present. SEO_Plan.md already deferred and seamed this.

### Phase 6 — Tests & verification (consolidated)
- Update the existing 34 API tests for the `locale` param + `trackIds` removal (expected churn).
- Playwright happy paths: `/`→`/ar` redirect, both locales render, `dir="rtl"` on `/ar`, locale switcher, admin create-translation flow.
- Lighthouse a11y >95 on `/ar` and `/en` (CLAUDE.md §11 DoD).

---

## Critical files
- `packages/api/src/db/models/playlist.model.ts` — slug-unique + `trackIds` (lines 18, 32, 38)
- `packages/api/src/services/track.service.ts` — the trackIds-mirror/reorder refactor
- `scripts/migrate.ts` (lines 5-6, 27) + `packages/api/package.json` `exports` — migration registration
- `apps/web/proxy.ts` — CSP-nonce that must be composed with next-intl middleware
- `apps/web/app/layout.tsx` → new `apps/web/app/[locale]/layout.tsx`

## Riskiest steps
1. `trackIds` removal + re-link tracks by `playlistContentId` — mistakes silently drop tracks from playlists.
2. Migration `0003`→`0004` order — backfill `locale` before the `{locale,slug}` unique index. **Dry-run (`pnpm migrate --dry-run`) against a restored snapshot first.**
3. next-intl middleware ⊕ CSP-nonce proxy — naive replacement drops the nonce and breaks CSP on every page.
4. Per-locale slug divergence breaks hreflang — needs contentId→sibling-slug resolution.

## Authoring-burden note
Per-locale tracks mean the admin re-enters track titles/descriptions for each locale (audio is shared via `mediaId`). This follows DATABASE.md §3 (the contract) but is real duplicate work — acceptable for a single admin; flag if it becomes a pain.

## Verification
- `pnpm --filter @repo/api test` green after service updates.
- `pnpm migrate --dry-run` then real run against a snapshot; confirm backfilled `locale`/`contentId`, dropped `trackIds`, new compound indexes.
- `pnpm dev`: visit `/` (redirects to `/ar`), confirm RTL + Arabic font; `/en` confirms LTR; switch locales; verify a playlist with only an AR translation 404s/empties gracefully on `/en`.
- Admin: create a playlist (AR), then "Add English" → confirm both share one `contentId`, distinct slugs, independent publish.
- View source on `/ar/playlists/<slug>`: CSP header present with nonce; `hreflang` alternates point to correct per-locale slugs.
