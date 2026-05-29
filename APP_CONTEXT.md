# APP_CONTEXT.md

> **AI agents: load this file FIRST at the start of every session in this project**, then read the relevant PLAN.md ticket (§16 for status). Do NOT explore the repo — use the file locations below. Re-exploring wastes tokens; this file is kept current after every committed wave.

---

## Stack snapshot

- **Monorepo**: Turborepo, pnpm workspaces, TypeScript strict everywhere
- **Apps**: `apps/web` (public, port 3000), `apps/admin` (CMS, port 3001)
- **Shared packages**: `packages/api` · `packages/ui` · `packages/config` · `packages/tsconfig` · `packages/eslint-config`
- **DB**: MongoDB Atlas via Mongoose; repos always `.lean()` → plain DTOs; models use hot-reload guard
- **Auth**: Auth.js v5 Credentials + JWT sessions; `requireSession(['admin'])` enforced in every mutating service; Edge config in `config.edge.ts`
- **UI**: Tailwind v4, tokens in `packages/ui/src/styles/tokens.css`, shadcn-style primitives in `packages/ui/src/primitives/`; form layout via `@repo/ui/patterns/form-field`
- **Forms**: TanStack Form v1 + Zod native validators (no adapter); `FormField` wrapper from `@repo/ui/patterns/form-field`
- **Data fetching**: RSC + service call + Suspense; TanStack Query on client islands
- **Media uploads**: 2-step handshake — `POST /api/upload` (presign + create pending Media) → client PUT to R2 → `POST /api/media/confirm` (headObject + flip to confirmed)
- **Cache invalidation**: `revalidateTag` from `next/cache` called in services after public-affecting mutations
- **CI**: `.github/workflows/ci.yml` — lint/typecheck/test/build via turbo affected filter; `packages/api` has its own vitest suite (run by `pnpm turbo run test`)

---

## Hard boundaries

See **CLAUDE.md §5** — non-negotiable list. Summary: apps call services only (no `db/`, no `repositories/`); env reads go through `@repo/config/env`; throw `AppError`, not strings; UI uses tokens, not arbitrary values; every service mutation calls `requireSession` AND `revalidateTag`.

---

## Completed waves

Audio MVP (Waves 0–5) + pre-deploy fixups + hardening sprint + **P2-A Categories** + **i18n A+B (AR/EN)** + **embedded-locale refactor** all landed and merged. Head of `main` = `7787906` (pre-refactor); embedded-locale commits follow. Atlas migrations applied.

| Wave | Range | Notes (only what's non-obvious for a future session) |
|---|---|---|
| 0 — Foundations | `6c5202f`–`af0683b` | Turborepo, Tailwind v4 tokens, `@repo/api` skeleton (db/client, AppError, services/), CI baseline. |
| 1 — Auth | `26ea693`–`6dcea3d` | Auth.js v5 split into Node (`config.ts`) + Edge (`config.edge.ts`) — Mongo adapter needs Node, middleware needs Edge. argon2id passwords. `requireSession(roles?)` throws `AppError.Unauthorized/Forbidden`. `scripts/seed-admin.ts` + `scripts/migrate.ts`. |
| 2 — Data + Media | `1235356`–`0ccab79` | Zod schemas + Mongoose models + lean repos for Playlist/Track/Media. R2 client with `createPresignedUpload` + `headObject` + `ALLOWED_AUDIO_MIME_TYPES`. 2-step upload handshake (`/api/upload` presigns + creates pending Media → client PUTs to R2 → `/api/media/confirm` headObject + flip). All services use `requireSession` + `revalidateTag`. |
| 3 — Admin CMS | `bdf4787`–`55ac779` | `apps/admin` playlist list (TanStack Table, status filter), create+edit form (shared `PlaylistForm`, TanStack Form + Zod), drag-drop track uploader (`use-track-upload.ts` hook with retry-on-PUT), dnd-kit reorder with optimistic update, publish toggle. RSC pages serialize Dates to ISO strings before passing to client islands (see `SerializedPlaylist`). |
| 4 — Public Web + Player | `8748484`–`79f50da` + `6ac0053` | `apps/web` layout (header/footer, skip-link), homepage grid (RSC + `next/image`), playlist detail (RSC + `generateMetadata`). `packages/ui/blocks/audio-player` — single `HTMLAudioElement` ref in `PlayerProvider` wrapped at root layout so the player survives navigation. Keyboard: space (play/pause), ←/→ (seek ±10s); keydown listener bails on editable targets so form input isn't hijacked. URL hash mirrors current track. A11y: semantic landmarks, focus rings, ARIA on transport. |
| 5 — Deploy + Smoke ⚠️ | `1b97c53` + `806f2ca` fixup | Per-app `next.config.ts`: `images.remotePatterns` for R2 + static security headers (HSTS, X-Frame, Permissions-Policy). CSP moved to middleware after hardening — see below. Playwright smoke tests in `tests/e2e/`. Health endpoints return `{ ok, version, time }`. **Sentry SDK install deferred** — env var stubbed only. |
| Pre-deploy fixups | `dfae606` · `e693862` · `1fe8f69` · `1a4c895` | `media.service.ts` createMedia/confirmMedia call `requireSession(['admin'])`. `seed-admin.ts` refuses `NODE_ENV=production` without `--force`. Per-app `vercel.json` (turbo `--filter=app...` build). CI runs `pnpm test`. Root `README.md`. **`deploy.md`** step-by-step runbook. |
| Hardening sprint | `58550ba` · `40ef84c` · `577a6a9` · `41c26a8` · `e6493ca` | (A) `packages/api` now has 19 vitest unit tests across all 4 services (mocks repos + `requireSession` + `next/cache`) — P2-A added 15 more for category service, total now 34. (B) **CSP is now nonce-based** — `proxy.ts` in both apps (renamed from `middleware.ts` for Next 16) generates a per-request nonce, sets `script-src 'self' 'nonce-…' 'strict-dynamic'` so we dropped `'unsafe-inline'` from script-src (style-src keeps it intentionally); static `Content-Security-Policy` header removed from both `next.config.ts`. (D) APP_CONTEXT seek-amount corrected to ±10s. (E) auth side-effect import replaced with `/// <reference path="../types/next-auth.d.ts" />` directive — IDE-resistant; ESLint override allows the triple-slash on those two files only. Pre-existing build-blockers fixed: Turbopack "use server" re-export bug in playlist actions (now imports schema directly), `/` + `/playlists/[slug]` marked `dynamic = "force-dynamic"` (required because nonce-CSP and because the build runs without Atlas). |
| i18n A+B (AR/EN) ✅ | `2358620`..`7787906` | **Bilingual content + web UI**, merged to `main`; Atlas migrations applied. Plan in **`localization.md`**; decisions in **`docs/adr/0001-next-intl.md`** + **`0002-arabic-slugs.md`**. Data model = **per-locale documents** (DATABASE.md §3): `playlists`/`categories`/`tracks` gained `contentId` + `locale`; slug regex widened to Unicode (Arabic); `playlist.trackIds` **dropped** (`Track.order` is sole ordering); `track.playlistId` → `playlistContentId`; `playlist.categoryIds` now hold category **contentIds**. New compound unique indexes `{locale,slug}` + `{contentId,locale}`; migrations `0003-i18n-backfill` (locale=ar + mint contentId + relink tracks) + `0004-i18n-indexes`. **Migration runner order is `0003→0004→0001→0002`** — 0003 must backfill `locale`/`contentId` before any `ensureIndexes()` call or the compound unique fails on null docs; 0002 no longer recreates the bare `categories.slug` unique (dropped by 0004 and replaced with the compound version). Services take a `locale` param; cache tags are locale-scoped (`playlistsHomeTag`/`playlistTag`/`categoriesTag` in `cache/tags.ts` — old bare constants removed). Shared `slugify` in `utils/slug.ts`, `newObjectIdString` in `utils/id.ts`, `schemas/locale.ts` (`LOCALES`/`DEFAULT_LOCALE='ar'`). `packages/ui/src/hooks/use-dir.ts` — `useDir()` hook reads `<html dir>` via MutationObserver (SSR-safe, for client islands). Audio player: skip icons carry `rtl:scale-x-[-1]`; queue Sheet opens from `left` in RTL. Admin chrome stays English but authors both locales ("create translation" flow: list pages group by contentId + "Add EN/AR" link → `/<res>/new?contentId=&locale=`). Web uses **next-intl**: `/ar`+`/en` always-prefixed (`localePrefix:'always'`), `apps/web/i18n/{routing,request,navigation}.ts`, `messages/{ar,en}.json`, `app/[locale]/` tree, RTL via `<html dir>` + IBM Plex Sans Arabic swapped into `--font-sans` for ar, `proxy.ts` composes next-intl middleware with the CSP nonce. hreflang via `getPlaylistSlugForLocale`. **Postponed**: Phase 6 E2E/Lighthouse (Playwright `/`→`/ar` redirect + locale switch + RTL + a11y). Tests: api 49 · admin 41 · web 14; web prod build ✓. |
| i18n embedded-locale refactor ✅ | HEAD | Per-locale docs (AR+EN separate, contentId-linked) replaced by single docs with `ar:{}` and `en:{}` sub-objects. `contentId` + `locale` fields removed from all three collections. `track.playlistContentId` → `track.playlistId`. `playlist.categoryIds` now holds category `_id`s. Migration 0005 merges paired docs; runs before 0001/0002. Cache tags simplified: `PLAYLISTS_HOME`, `playlistTag(id)`, `CATEGORIES`. Services: `getPublishedPlaylists()`, `listCategories()`, `getTracksWithUrls(playlistId)` — no locale params. Web: `PlaylistCard` calls `getLocale()`; detail page resolves `DisplayTrack[]` before passing to `TrackListPlayer`. `getPlaylistSlugForLocale` removed. Admin tables/forms updated for embedded-locale shape (AR + EN columns side-by-side; no per-locale row pattern). **Migration runner order is now `[0003, 0004, 0005, 0001, 0002]`**. Tests: api 54 · admin 37 · web 14 all green. |
| P2-A — Categories ✅ | `c73e7e4` · `82d3e81` · `6972e87` · `273e518` (+ spec `c9cadef` · `7f97d40` · `8e57352`) | New `Category` resource with full admin CRUD + many-to-many on `Playlist` + public homepage filter. Spec lives in **PLAN.md §13.1**. Files: `schemas/category.ts`, `db/models/Category.model.ts` (note PascalCase filename — outlier from the lowercase models), `repositories/category.repo.ts`, `services/category.service.ts` (`listCategories` · `getCategoryBySlug` · `getCategoryById` · `createCategory` · `updateCategory` · `deleteCategory`), migration `0002-category-indexes.ts` (unique `categories.slug` + `playlists.categoryIds` array index). `playlist.service.ts` extended: `createPlaylist`/`updatePlaylist` now accept `categoryIds?: string[]` (validates IDs exist); `getPublishedPlaylists` accepts `{ categoryId }` filter. Slug collisions auto-append `-2`/`-3`. Hard delete `$pull`s the id from every playlist's `categoryIds`. New cache tag `CATEGORIES = "categories"` in `cache/tags.ts` (first central tag file). Admin: `/categories`, `/categories/new`, `/categories/[id]/edit` + `CategoriesTable` + `CategoryForm` + 3 server actions + a `categoryIds` multi-select field on the playlist form. Web: `CategoryFilterBar` client island reads/writes `?category=<slug>` URL param; homepage resolves slug → ObjectId before calling the playlist service; empty-state message on unknown slug (no 404). Tests: 34 API unit + 38 admin RTL + 1 E2E green. |

---

## Next phase

MVP is **deploy-ready** (Wave 5.4 stays ⚠️ Partial because Sentry SDK install is intentionally deferred — env var stubbed; optional per `.env.example`). To actually go live: open **`deploy.md`** and walk the 11 steps top-to-bottom.

**i18n A+B is complete** — bilingual AR/EN public site + admin bilingual authoring all merged to `main`; Atlas migrated. See waves row above. Postponed item: Phase 6 E2E/Lighthouse (Playwright RTL + redirect; non-blocking).

**Next: P2-B Lectures** (PLAN.md §13). Tickets not yet written; brainstorm + write a wave plan before coding (use `superpowers:brainstorming` then `superpowers:writing-plans`).

---

## ⚠️ Open issues — embedded-locale follow-ups (debug session 2026-05-28, UNCOMMITTED)

The working tree carries the embedded-locale refactor plus three slug fixes (all FIXED, uncommitted). Land them, THEN proceed to P2-B.

1. **FIXED (uncommitted)** — homepage card linked to `/playlists/undefined`. Cause: playlist docs written by an earlier slug-less run of migration `0005` had no `{ar,en}.slug`; they also have no `contentId`, so 0005's merge loops (which iterate `distinct("contentId")`) never revisit them → couldn't self-heal. Fix: `0005-embedded-locale.ts` gained a `backfillSlugs()` pass — scans all 3 collections, mints a slug from title/name via `slugify` for any doc with a missing/empty `ar`/`en` slug, runs BEFORE `ensureIndexes`. Idempotent. Atlas data healed by re-running 0005 in isolation.
2. **FIXED (uncommitted)** — Arabic (non-ASCII) slug detail pages 404'd (`/ar/playlists/<arabic>`). Cause: **Next.js + next-intl do NOT percent-decode the `[slug]` route param**, so the slug arrived as `"%D8%AF…"` and never matched the stored Unicode slug. ASCII slugs were unaffected (percent-encoding is identity for them). Fix: `apps/web/app/[locale]/playlists/[slug]/page.tsx` now calls a local `decodeSlug()` (try/catch `decodeURIComponent`) in BOTH `generateMetadata` and the page before `getPlaylistBySlug`. Pre-existing latent bug since ADR 0002 (Arabic slugs) — not caused by the backfill.
4. **FIXED (uncommitted, debug session cont.)** — `Maximum update depth exceeded` infinite render loop on playlist detail pages. Cause: `features/layout/locale-alternates-context.tsx` exposed `setAlternates` as an inline arrow recreated every render; it's a dep of `SetLocaleAlternates`' effect, which writes a fresh object each run → render→effect→setState→render loop. Fix: wrap the setter in `useCallback([])` and memoize the context `value` with `useMemo`. Regression test in `locale-alternates-context.test.tsx` (reproduces the loop pre-fix). Web suite 18 green, typecheck clean.
5. **FIXED (uncommitted, debug session cont.)** — dev console `eval() is not supported … unsafe-eval` (React dev build + Turbopack HMR need eval; nonce-CSP blocked it). Fix: `lib/csp.ts` in BOTH apps now adds `'unsafe-eval'` to `script-src` ONLY when `NODE_ENV !== 'production'`. Production CSP unchanged (strict). Do NOT add `'unsafe-eval'` to the prod branch.

3. **FIXED (uncommitted)** — Admin update clobbered slugs. `updateXById` did `findByIdAndUpdate(id, { $set: update })`; with `ar`/`en` `.partial()`, saving the edit form (no slug field) sent `ar:{title}` and `$set:{ar:{...}}` **replaced the whole `ar` subdocument**, dropping `slug`/`description` (confirmed live on `test-2`). Fix: new `packages/api/src/utils/mongo-update.ts` → `flattenLocaleUpdate()` expands `ar`/`en` sub-objects into dot-paths (`"ar.title"`) so `$set` MERGES instead of replacing; applied in all three repos (`playlist`/`track`/`category`). Untouched slug/description now survive an edit (existing slug preserved — no re-derive, URLs stay stable). Unit-tested in `utils/mongo-update.test.ts`. The web locale switcher 404 (different sibling bug — AR/EN slugs differ, so a prefix-swap of the current path 404'd) is also fixed: new `features/layout/locale-alternates-context.tsx` lets the detail page register both slugs for the header switcher; non-detail routes fall back to prefix-swap. **Note:** live Atlas docs that already lost slugs still need healing — run `0005.up()` in isolation (its `backfillSlugs()` pass) once; do NOT run the full `pnpm migrate` chain (corrupts embedded data, see gotcha below).

---

## Key file locations (quick-ref for implementers)

```
packages/api/src/
  auth/
    index.ts              → exports: auth, handlers, signIn, signOut, requireSession
                            (uses /// <reference> to load types/next-auth.d.ts)
    config.ts             → full Node config (Credentials + Mongo adapter)
    config.edge.ts        → Edge config (JWT callbacks, pages.signIn: '/login')
                            (also has /// <reference> for the augmentation)
    require-session.ts    → requireSession(roles?) — throws AppError if not authed
    password.ts           → hashPassword / verifyPassword (argon2id)
  types/next-auth.d.ts    → declare module augmentation adding `role` to Session/User/JWT
  services/*.test.ts      → vitest unit tests (mock repos + requireSession + next/cache)
  db/
    client.ts             → getDb() / disconnectDb()
    models/
      user.model.ts       → UserModel
      playlist.model.ts   → PlaylistModel
      track.model.ts      → TrackModel
      media.model.ts      → MediaModel
    models/Category.model.ts (PascalCase outlier — every other model is lowercase)
    migrations/
      0001-indexes.ts            → ensureIndexes on Playlist/Track/Media (safe no-op after 0004)
      0002-category-indexes.ts   → playlists.categoryIds array index + PlaylistModel.ensureIndexes (no-op after 0004)
      0003-i18n-backfill.ts      → sets locale='ar', mints contentId, relinks tracks (idempotent; skips docs with locale set)
      0004-i18n-indexes.ts       → drops old bare-slug unique indexes, rebuilds compound {locale,slug}+{contentId,locale}
      ⚠️ Runner order in scripts/migrate.ts: [0003, 0004, 0005, 0001, 0002] — 0003 MUST precede ensureIndexes
  repositories/
    playlist.repo.ts      → findPlaylistById/BySlug/Published/All/ByContentId, create/update/delete
                            (no appendTrackId/removeTrackId — dropped; Published/All take locale param + {categoryContentId?} filter)
    track.repo.ts         → findTrackById/ByPlaylistContentId/BySlug, create/update/delete, updateTrackOrder (bulkWrite)
    media.repo.ts         → findMediaById, create, updateById
    category.repo.ts      → findAll/ById/BySlug/ByContentId, create/update/delete, pullCategoryFromPlaylists
  schemas/
    locale.ts             → localeSchema, LOCALES=['ar','en'], DEFAULT_LOCALE='ar', Locale type, isLocale()
    user.ts               → User, UserRole, Credentials
    playlist.ts           → Playlist (contentId, locale, categoryIds hold category contentIds), PlaylistStatus, *Input
    track.ts              → Track (contentId, locale, playlistContentId), TrackCreateInput, TrackUpdateInput
    media.ts              → Media, MediaMimeType, MediaStatus, *Input
    category.ts           → Category (contentId, locale), CategoryCreateInput, CategoryUpdateInput
  utils/
    slug.ts               → slugify(input, contentIdFallback?) — Unicode-aware, Arabic-safe, de-duped from 3 old services
    id.ts                 → newObjectIdString() — mints a fresh Mongoose ObjectId as a hex string
  services/
    auth.service.ts       → verifyCredentials, createAdminUser
    playlist.service.ts   → getPublishedPlaylists(locale, {categoryContentId?}), getAllPlaylists(session),
                            getPlaylistBySlug(locale, slug), getPlaylistById(id, session),
                            getPlaylistSlugForLocale(contentId, locale) — for hreflang alternates,
                            create/update (categoryIds validated), delete/publish/unpublish
    track.service.ts      → getTracksWithUrls(locale, playlistContentId), getTrackById, create/update/delete,
                            reorderTracks(locale, playlistContentId, orderedTrackIds) — writes Track.order only
    media.service.ts      → createMedia, confirmMedia, getMediaUrlById (both create/confirm call requireSession — defense in depth)
    category.service.ts   → listCategories(locale), getCategoryBySlug(locale, slug), getCategoryById, create/update,
                            delete (cascade $pull only when last locale variant gone; revalidates all locales)
  cache/tags.ts           → locale-scoped tag FUNCTIONS — playlistsHomeTag(locale), playlistTag(locale,slug), categoriesTag(locale)
                            (old bare PLAYLISTS_HOME/CATEGORIES constants removed — always use the functions)
  media/
    r2-client.ts          → createPresignedUpload(key, mime, bytes), headObject(key), ALLOWED_AUDIO_MIME_TYPES
  errors/index.ts         → AppError + codes (UNAUTHORIZED/FORBIDDEN/NOT_FOUND/VALIDATION/CONFLICT/RATE_LIMITED/INTERNAL)
  index.ts                → public barrel (getDb, disconnectDb, auth, signIn, signOut, handlers, requireSession + all schema types)

packages/config/src/env.ts  → Zod-parsed env (MONGODB_URI, AUTH_SECRET, R2_* vars)

packages/ui/src/
  styles/tokens.css         → design tokens (colors, spacing, fonts, radii, shadows)
  primitives/
    button.tsx              → Button (cva: default/secondary/outline/ghost/destructive/link × sm/default/lg/icon)
    input.tsx               → Input (aria-invalid for error state)
    dialog.tsx / sheet.tsx / progress.tsx / slider.tsx / toaster.tsx
  patterns/
    form-field.tsx          → FormField({ label, htmlFor?, error?, children }) — label + input slot + error message
  blocks/audio-player/
    audio-player.tsx        → sticky bottom UI (play/pause, Slider seek, time, prev/next). Subscribes to PlayerContext.
                              RTL: skip icons mirror via rtl:scale-x-[-1]; queue Sheet opens from left in RTL (via useDir).
    player-context.tsx      → PlayerProvider — single HTMLAudioElement ref, queue state, keyboard handlers (space, ←/→), navigation persistence
  hooks/
    use-dir.ts              → useDir() — returns 'rtl'|'ltr' by reading <html dir>; SSR-safe; for client islands only

apps/admin/
  app/layout.tsx                         → RootLayout (Inter + Fraunces fonts)
  app/page.tsx                           → placeholder home (will become dashboard)
  app/(auth)/login/page.tsx              → login page (RSC, awaits searchParams.from)
  app/api/auth/[...nextauth]/route.ts    → Auth.js handlers
  app/api/upload/route.ts                → POST presign + create pending Media
  app/api/media/confirm/route.ts         → POST confirm Media (headObject + status flip)
  app/api/health/route.ts                → GET → { ok, version, time } (UptimeRobot target)
  proxy.ts                               → Edge proxy: auth gate + per-request CSP nonce
                                            (file used to be `middleware.ts` — renamed for Next 16)
  lib/csp.ts                             → buildAdminCsp(nonce) — emits dynamic CSP
  next.config.ts                         → images.remotePatterns + static security headers
                                            (CSP itself is emitted by the proxy, not here)
  features/auth/
    actions/sign-in.action.ts            → signInAction(credentials, redirectTo?)
    components/login-form.tsx            → LoginForm (TanStack Form v1 + Zod)
  features/playlists/
    schemas/playlist-form.schema.ts      → Zod schema reused by create + edit (now with categoryIds)
    actions/
      create-playlist.action.ts          → form submit → playlistService.create → revalidateTag
      update-playlist.action.ts          → form submit → playlistService.update → revalidateTag
      create-track.action.ts             → called after R2 confirm; writes Track row
      reorder-tracks.action.ts           → batch order update; optimistic-friendly
      toggle-publish.action.ts           → publish/unpublish + revalidateTag
    components/
      playlists-table.tsx                → PlaylistsTable (TanStack Table v8, status filter); exports SerializedPlaylist
      playlist-form.tsx                  → shared create/edit form (TanStack Form + Zod) — now renders categoryIds multi-select
      track-uploader.tsx                 → drag-drop UI inside edit page
      track-list.tsx                     → dnd-kit sortable list of tracks
      publish-toggle.tsx                 → publish/unpublish toggle button
    hooks/
      use-track-upload.ts                → presign → PUT with progress → confirm (with retry on PUT)
  features/categories/
    schemas/category-form.schema.ts      → Zod schema reused by create + edit
    actions/
      create-category.action.ts          → form submit → categoryService.create → revalidateTag(CATEGORIES)
      update-category.action.ts          → form submit → categoryService.update → revalidateTag
      delete-category.action.ts          → categoryService.delete → revalidateTag(CATEGORIES + PLAYLISTS_HOME)
    components/
      categories-table.tsx               → TanStack Table; delete button per row
      category-form.tsx                  → shared create/edit (TanStack Form + Zod); cover image via MediaPicker
  app/playlists/
    page.tsx                             → RSC list page
    new/page.tsx                         → create form (passes availableCategories to PlaylistForm)
    [id]/edit/page.tsx                   → edit form (with availableCategories) + track-uploader + track-list + publish-toggle
  app/categories/
    page.tsx                             → RSC list page
    new/page.tsx                         → create form
    [id]/edit/page.tsx                   → edit form
  lib/
    route-helpers.ts                     → appErrorStatus(AppError) → HTTP status code
  vitest.config.ts                       → jsdom + @vitejs/plugin-react; no vite-tsconfig-paths (ESM conflict)
  vitest.setup.ts                        → @testing-library/jest-dom/vitest + explicit afterEach(cleanup)

apps/web/
  app/layout.tsx                         → passthrough root (wraps children only); <html lang dir> set in [locale]/layout.tsx
  app/[locale]/layout.tsx                → sets <html lang={locale} dir>, loads IBM Plex Sans Arabic (swaps --font-sans for ar),
                                            wraps NextIntlClientProvider + PlayerProvider
  app/[locale]/page.tsx                  → RSC homepage: listCategories(locale) → resolve ?category slug → categoryContentId
                                            → getPublishedPlaylists(locale, {categoryContentId?}) → grid + CategoryFilterBar
                                            (export const dynamic = "force-dynamic")
  app/[locale]/playlists/[slug]/page.tsx → RSC detail: getPlaylistBySlug(locale,slug) + getTracksWithUrls(locale,contentId);
                                            generateMetadata emits hreflang via getPlaylistSlugForLocale per locale
                                            (export const dynamic = "force-dynamic")
  app/api/health/route.ts                → GET → { ok, version, time }
  i18n/
    routing.ts                           → defineRouting({ locales:['ar','en'], defaultLocale:'ar', localePrefix:'always' })
    request.ts                           → getRequestConfig — loads messages/{locale}.json
    navigation.ts                        → locale-aware Link, useRouter, usePathname, redirect (re-export from next-intl/navigation)
  messages/
    ar.json / en.json                    → ~30 chrome strings (common, nav, home, playlist, player, metadata namespaces)
  proxy.ts                               → Edge proxy: composes next-intl routing middleware + per-request CSP nonce
                                            (mutates request.headers x-nonce BEFORE calling intl handler; attaches CSP to response)
  lib/csp.ts                             → buildWebCsp(nonce, r2Hostname) — emits dynamic CSP
  next.config.ts                         → wrapped with createNextIntlPlugin('./i18n/request.ts'); images.remotePatterns + headers
  vitest.config.ts                       → jsdom + @vitejs/plugin-react + explicit '@' → app-root alias (vite-tsconfig-paths can't load here)
  vitest.setup.ts                        → @testing-library/jest-dom/vitest + afterEach(cleanup)
  features/layout/components/
    site-header.tsx                      → header (logo + skip link target; uses useTranslations)
    site-footer.tsx                      → footer (uses useTranslations)
  features/playlists/
    types.ts                             → SerializedPlaylist / SerializedPlayableTrack / SerializedTrack DTOs
    components/
      playlist-card.tsx                  → server component — cover + title (getTranslations for listenOn label)
      track-row.tsx                      → row UI; track number uses text-end (logical, RTL-safe)
      track-list-player.tsx              → client island: maps rows; click → player.loadQueue; track number text-end
  features/categories/
    components/
      category-filter-bar.tsx            → client island: pill list reads/writes ?category URL param; uses Link from @/i18n/navigation
  features/player/components/
    audio-player.test.tsx                → RTL tests for the player block; mocks next-intl + @/i18n/navigation

tests/e2e/
  web.smoke.test.ts                      → homepage loads + first track plays + deep-link to playlist
  admin.smoke.test.ts                    → login + create playlist + upload track
playwright.config.ts                     → projects for web (3000) + admin (3001), webServer auto-boot

scripts/
  seed-admin.ts   → pnpm seed:admin --email --password [--force]  (--force required when NODE_ENV=production)
  migrate.ts      → pnpm migrate [--dry-run]
  tsconfig.json   → path aliases for @repo/* (explicit .service.ts mappings)

apps/web/vercel.json + apps/admin/vercel.json
  → framework: nextjs, buildCommand uses `cd ../.. && pnpm turbo run build --filter=<app>...`
    so each Vercel project only rebuilds what it owns. Headers stay in next.config.ts.

.github/workflows/ci.yml
  → lint · typecheck · test · build (turbo affected filter on PRs).
    Test step runs vitest in jsdom (no Mongo/R2 needed); uses dummy MONGODB_URI + AUTH_SECRET for build only.

Root docs (read in this order for new sessions)
  README.md          → quickstart + verify commands + doc index
  APP_CONTEXT.md     → this file (load FIRST every session)
  PLAN.md            → wave-by-wave status (§16)
  deploy.md          → step-by-step first-deploy runbook (11 steps + rollback)
  DEPLOYMENT.md      → strategy/architecture reference; deploy.md expands its §0.1
  CLAUDE.md          → rules for AI agents (§5 boundaries are hard rules)
  ARCHITECTURE.md / SECURITY.md / DATABASE.md / API.md / DESIGN.md
```

---

## Known gotchas

- `next-auth@5.0.0-beta.25` peer-warns against Next 16 — expected, works fine
- Auth.js `signIn()` throws a Next.js redirect on success — always re-throw non-AuthError errors in server actions
- `searchParams` is `Promise<{...}>` in Next 15+ — always `await searchParams`
- Mongoose hot-reload guard: `mongoose.models.X ?? mongoose.model('X', schema)` in every model
- R2 client is a lazy singleton — `getClient()` creates it once; dev sessions without R2 env still boot
- `revalidateTag` imported from `next/cache` inside `packages/api/services/` — valid because Next.js apps consume this package
- `scripts/tsconfig.json` has explicit path aliases for `.service.ts` files because `@repo/api/*` glob only covers direct filename matches
- TanStack Form v1: Zod schemas work natively in `validators` — no `@tanstack/zod-form-adapter` needed
- `appErrorStatus` shared helper lives in `apps/admin/lib/route-helpers.ts` — use it in all new admin route handlers
- RSC→client Date serialization: `Date` objects cannot cross the RSC boundary; map to ISO strings before passing as props. Pattern: `type SerializedX = Omit<X, 'createdAt'|'updatedAt'> & { createdAt: string; updatedAt: string }` — see `SerializedPlaylist` in `playlists-table.tsx`
- Vitest in admin: use `@testing-library/jest-dom/vitest` (not bare import), add explicit `afterEach(cleanup)` in setup; `vite-tsconfig-paths` is ESM-only and cannot load in `vitest.config.ts`
- `scripts/seed-admin.ts` env-validation order: `parseEnv()` runs at module load (via `@repo/config/env`), BEFORE the production guard. So a real prod run needs `MONGODB_URI` + `AUTH_SECRET` already set; the guard only fires once env is valid. Acceptable for the deploy path documented in `deploy.md` step 7.
- `media.service.ts` calls `requireSession(['admin'])` itself even though both route handlers (`/api/upload`, `/api/media/confirm`) also enforce auth. This is defense-in-depth per CLAUDE.md §5 ("Always check in services") — do not remove either layer.
- CSP is **nonce-based**, emitted by `proxy.ts` in both apps (`lib/csp.ts` builds the directive). The static security headers in `next.config.ts` no longer include CSP — do not add it there or you'll get duplicate headers. Both apps' RSC pages are marked `export const dynamic = "force-dynamic"` because a per-request nonce is incompatible with static prerendered HTML; admin pages additionally need this because they hit Mongo at request time and Vercel build runs without Atlas connectivity. Adopting ISR/static caching in Phase 2 needs a different CSP strategy (subresource hashes or removing the nonce constraint). `script-src` is `'self' 'nonce-…' 'strict-dynamic'` — intentionally NO `'unsafe-inline'` fallback (CSP2-only clients would otherwise bypass nonce enforcement). **Dev only:** `'unsafe-eval'` is appended to `script-src` when `NODE_ENV !== 'production'` (React dev build + Turbopack HMR need eval()); the production branch must never include it.
- Auth module augmentation (`packages/api/src/types/next-auth.d.ts`) is loaded into both auth entries via `/// <reference path="…"/>` directives. The directive is whitelisted in `packages/api/eslint.config.mjs` for `auth/index.ts` and `auth/config.edge.ts` only. Don't switch back to a side-effect `import "../types/next-auth"` — IDE "organize imports" actions strip it silently and the `role` field disappears from `session.user`.
- Health endpoints (`apps/web` + `apps/admin`) intentionally read `process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA` directly instead of importing `@repo/config/env`. Reason: the env barrel parses at module load and requires `MONGODB_URI` + `AUTH_SECRET`, which aren't set during `next build`'s page-data collection step. The git SHA is build metadata, not a runtime secret. This is the canonical exception to CLAUDE.md §5; same pattern in `next.config.ts` files.
- `packages/api` tests run via `pnpm --filter @repo/api test` (vitest with node env). Setup file primes `MONGODB_URI` + `AUTH_SECRET` because importing `@repo/config/env` transitively at test load would otherwise throw. The `any` type is allowed in `src/**/*.test.ts` via an ESLint override so lean-doc fixtures stay terse — production code keeps `no-explicit-any: error`.
- Next 16 file convention: `middleware.ts` was renamed to `proxy.ts` in both apps. Next 16 supports both, but the deprecation warning goes away with `proxy.ts`. The exported function name (`middleware` in web, default `auth(...)` callback in admin) is still accepted — only the filename changed.
- Server Actions in admin: never re-export schemas/types from a `"use server"` file. Next 16 + Turbopack rejects the build with "The module has no exports at all". Importers must pull `playlistFormSchema` and friends directly from `features/playlists/schemas/playlist-form.schema.ts`.
- **Filename inconsistency**: `packages/api/src/db/models/Category.model.ts` is PascalCase; every other model file (`user.model.ts`, `playlist.model.ts`, `track.model.ts`, `media.model.ts`) is lowercase. When cloning P2-A as the sibling pattern for P2-B+, use lowercase for the new model file (`lecture.model.ts` etc) — the Category outlier is not the convention.
- **Many-to-many slug→ObjectId resolution lives in the RSC, not the service.** `apps/web/app/page.tsx` calls `listCategories()` first, finds the matching `{ id }` by slug, then calls `getPublishedPlaylists({ categoryId })`. The playlist service intentionally takes an ObjectId, not a slug, because validating + casting belongs at the request boundary. Phase-2 verticals that filter by slug should follow this same pattern.
- **Public service methods never throw on unknown slug.** `getCategoryBySlug` is the exception (throws `AppError.NotFound`), but the homepage filter path resolves slug locally and falls back to "show everything" → empty-state on no match, never a 404. When adding new filterable verticals, decide explicitly: throw-on-miss (detail pages) vs. ignore-on-miss (filter facets).
- **Central cache tags**: `packages/api/src/cache/tags.ts` exports `PLAYLISTS_HOME` and `CATEGORIES`. New verticals must add their tag here, not pass raw strings to `revalidateTag`. Item-level tags (`playlist:<slug>`) are still inline because they're parameterised.
- **Turbo strict-env**: `turbo.json` `tasks.build.env` whitelists `MONGODB_URI`, `AUTH_SECRET`, and the `R2_*` / `NEXT_PUBLIC_*` vars so turbo 2.9 forwards them to `next build`. Without that list, env vars exported by the shell are silently stripped and the `@repo/config/env` Zod parser throws "Required". Add new build-time env vars to that list, not just `.env.example`.
- **`confirmMedia` cross-checks the upload**: `media.service.confirmMedia` compares R2 `headObject()` `contentLength` + `contentType` against the pending Media record's `sizeBytes`/`mimeType` before flipping status. R2's signed PUT already enforces these at upload time; the second check is defense-in-depth and catches client tampering / record drift. Both must match or the confirm rejects with `AppError.Validation`.
- **Standalone scripts auto-load `.env.local`**: `pnpm migrate` / `pnpm seed:admin` pass `--env-file-if-exists=.env.local` to `tsx` (Next.js apps auto-load it; raw `tsx` does not). `--env-file-if-exists` (not `--env-file`) so prod runs that set env inline — `MONGODB_URI="…" pnpm migrate` — don't break on a missing file; Node won't override a shell-set var with the file's value, so inline env still wins. Pass flags WITHOUT the npm `--` separator: `pnpm migrate --dry-run`, not `pnpm migrate -- --dry-run` (pnpm forwards the literal `--` and the script's strict `parseArgs` rejects it as a positional).
- **Every migration needs an `exports` entry**: `scripts/migrate.ts` imports each migration by subpath from `@repo/api`, so a new `db/migrations/NNNN-*.ts` MUST be added to `packages/api/package.json` `exports` (mirroring `0001`/`0002`) or the script fails with `ERR_PACKAGE_PATH_NOT_EXPORTED`. `0002` was missing this until the first real Atlas run surfaced it.
- **Migration runner order is `[0003, 0004, 0005, 0001, 0002]`** (not numeric). `0003` backfills `locale`/`contentId` on all existing docs first. `0004` drops the old bare-slug unique indexes. `0005` merges per-locale doc pairs into embedded `{ar,en}` sub-objects and removes `contentId`/`locale` fields. `0001`/`0002` then call `ensureIndexes()` with the final schema. `0002` intentionally does NOT recreate the bare `categories.slug` unique (dropped by `0004`).
- **⚠️ Do NOT run the full `pnpm migrate` chain against already-embedded data.** `0003` matches `{ locale: { $exists: false } }` — embedded docs have no `locale`, so 0003 would WRONGLY re-add `locale:'ar'` + `contentId` to them and corrupt the embedded shape (then 0004's compound index rebuild compounds the mess). To heal/backfill an already-embedded DB, run ONLY `0005.up()` in isolation: its merge loops no-op on `contentId`-less docs, the new `backfillSlugs()` pass fills missing slugs, and it drops+rebuilds indexes safely. Quick isolated run: a tiny `tsx --env-file=<root>/.env.local` script that imports `up` from `src/db/migrations/0005-embedded-locale` and calls it. Once the DB is fully embedded, 0003/0004 are transitional dead weight and arguably dangerous — consider gating them on an "already embedded?" check or removing them after the refactor commits.
- **Non-ASCII route params are NOT percent-decoded by Next/next-intl.** A dynamic `[slug]` (or any path segment) holding Arabic/Unicode arrives URL-encoded (`%D8%AF…`). Decode at the request boundary (`decodeURIComponent`, wrapped in try/catch for malformed `%`) before any DB lookup. Already applied in the playlist detail page; mirror it in every future Unicode-slug detail route (lectures, books, …). ASCII slugs hide the bug because their encoding is identity.
- **(i18n) EMBEDDED-locale documents — single doc per resource, NOT per-locale**: a playlist/category/track is ONE Mongo doc carrying embedded `ar:{…}` + `en:{…}` sub-objects. There is NO `contentId` and NO top-level `locale` field (removed in the embedded refactor — ignore any older note that mentions them). Public service reads take NO `locale` param: `getPublishedPlaylists({categoryId?})`, `listCategories()`, `getTracksWithUrls(playlistId)`. Only the slug-lookup reads carry locale to pick the sub-field: `getPlaylistBySlug(locale, slug)` / `getCategoryBySlug(locale, slug)` query `"<locale>.slug"`. Components pick the sub-object with `getLocale()` → `doc[locale]`. `playlist.categoryIds` hold category **`_id`s** (not contentIds); `track.playlistId` (renamed from `playlistContentId`) holds the playlist `_id`; query tracks by `{playlistId}` sorted by `order`. `playlist.trackIds` does not exist.
- **(i18n) Partial updates MUST go through `flattenLocaleUpdate`**: `$set:{ar:{…}}` replaces the entire `ar` sub-object and drops untouched fields (the slug-clobber bug). All repo `updateXById` functions wrap the patch in `flattenLocaleUpdate()` (`utils/mongo-update.ts`) to emit dot-paths (`"ar.title"`) that merge. Any new write path touching `ar`/`en` must do the same.
- **(i18n) Slugs are Unicode + globally unique per `<locale>.slug`**: the shared `utils/slug.ts` keeps any-script letters (Arabic-safe, ADR 0002); empty normalization falls back to `item-<id tail>`. `slug` is auto-derived from title ONLY on create; on update an omitted slug is preserved (admin forms have no slug field). The detail page must `decodeURIComponent` the `[slug]` route param (Next does not percent-decode Unicode).
- **(i18n) Cache tags are bare constants/functions**: `PLAYLISTS_HOME`, `CATEGORIES`, `playlistTag(id)` from `cache/tags.ts` (the old locale-scoped `playlistsHomeTag(locale)`/`categoriesTag(locale)` were removed in the embedded refactor — do not reintroduce). Category delete `$pull`s its `_id` from every playlist's `categoryIds`.
- **(i18n) Web is next-intl with `localePrefix:'always'`**: all routes live under `apps/web/app/[locale]/`; root `app/layout.tsx` is a passthrough, `[locale]/layout.tsx` owns `<html lang dir>`. `proxy.ts` COMPOSES next-intl routing with the CSP nonce (mutates `request.headers` x-nonce before calling the intl middleware, sets CSP on its response) — do not replace it with bare middleware or the nonce drops. Matcher excludes `/api`. Use `Link`/`useRouter` from `@/i18n/navigation` (locale-aware), not `next/navigation`. Chrome strings in `messages/{ar,en}.json`; RTL Arabic font = IBM Plex Sans Arabic swapped into `--font-sans` for `ar`. `vitest.config.ts` declares the `@`→app-root alias explicitly (vite-tsconfig-paths can't load).
- **(i18n) Admin chrome stays English, authors BOTH locales in one form**: the playlist/category forms render AR + EN fields side-by-side (`ar.title`/`en.title`, etc.) and save a single embedded doc. There is NO per-locale "create translation" flow, no `?contentId=&locale=` links, no locale badges/row-grouping (all removed with the embedded refactor). The web locale switcher (`features/layout/components/locale-switcher.tsx`) routes between locales via `locale-alternates-context` so detail pages reach the sibling slug. `apps/admin` itself is NOT internationalized (single admin UI).
- **Adding a design token is two edits**: declare it in `packages/ui/src/styles/tokens.css` (light + `[data-theme="dark"]`) AND map it in the `@theme inline` block of `packages/ui/src/styles/globals.css`. Skipping the map makes the Tailwind utility silently produce no value (this bit the `success` token, used by `playlist-card` before it was defined). DESIGN.md §15 documents the v4 mechanism (there is no `tailwind-config` preset). Upward player elevation is `--shadow-up-2`.
- **AudioPlayer is always mounted**: the bottom bar no longer unmounts when idle — it slides out via `translate-y-full`/`opacity-0`/`pointer-events-none` + `aria-hidden` so it can animate (DESIGN.md §17.1/§17.5). Tests assert "mounted-but-hidden", not absence. Buffering (`waiting`/`playing`/`canplay`) and error (`error` event) live in `player-context.tsx` alongside `goTo`/`retry`; the queue Sheet and a cover thumbnail + playlist title round out §17.1. Seek commits on slider release (`onValueCommit`), not per-tick.
- **Slider aria goes on the Thumb**: Radix puts `role="slider"` on `SliderPrimitive.Thumb`, so `slider.tsx` forwards `aria-label`/`aria-valuetext` there (not the role-less Root) — otherwise screen readers never announce them.
- **`getMediaUrlById(mediaId)`** in `media.service.ts` resolves a Media record to its public R2 URL (mirrors `getTracksWithUrls`; public read, no `requireSession`). Used by the playlist detail page to feed the player's cover thumbnail.
