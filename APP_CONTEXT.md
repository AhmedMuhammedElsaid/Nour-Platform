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

Audio MVP (Waves 0–5) + pre-deploy fixups + hardening sprint + **P2-A Categories** + **i18n A+B (AR/EN)** + **embedded-locale refactor** + **SoundCloud-UX & offline PWA & search** + **SEO enhancement** + **Strengthen Categories (web)** + **Continue Listening autoplay fix** + **Playlist Order** all landed and merged to `main`. Atlas migrations applied (including `0007-playlist-order` — all 7 migrations run).

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
| SoundCloud-UX + offline PWA + search ✅ | `4aa3821`..`0fd01bb` (6 commits) | Plan: `i-built-this-app-cozy-tower.md`. **P1** player: shuffle/repeat/speed + **Media Session API** (lock-screen) + localStorage prefs. **P2** resume positions + sleep timer + device-local recently-played → homepage "Continue listening" shelf (`features/player/`). **P3** full-text **search** (`search.service` + `$text` + migration `0006`; `/[locale]/search` + header `SearchBox`). **P4** installable **PWA** (manifest + hand-rolled `public/sw.js`, ADR 0003; offline shell + cache-played audio w/ Range; ⚠️ offline audio needs R2 CORS). **P5** loading skeletons + `robots.ts` + dynamic `sitemap.ts`. Device-local only (no public auth). Tests: api 64 · admin 37 · web 38; web prod build ✓. |
| P2-A — Categories ✅ | `c73e7e4` · `82d3e81` · `6972e87` · `273e518` (+ spec `c9cadef` · `7f97d40` · `8e57352`) | New `Category` resource with full admin CRUD + many-to-many on `Playlist` + public homepage filter. Spec lives in **PLAN.md §13.1**. Files: `schemas/category.ts`, `db/models/Category.model.ts` (note PascalCase filename — outlier from the lowercase models), `repositories/category.repo.ts`, `services/category.service.ts` (`listCategories` · `getCategoryBySlug` · `getCategoryById` · `createCategory` · `updateCategory` · `deleteCategory`), migration `0002-category-indexes.ts` (unique `categories.slug` + `playlists.categoryIds` array index). `playlist.service.ts` extended: `createPlaylist`/`updatePlaylist` now accept `categoryIds?: string[]` (validates IDs exist); `getPublishedPlaylists` accepts `{ categoryId }` filter. Slug collisions auto-append `-2`/`-3`. Hard delete `$pull`s the id from every playlist's `categoryIds`. New cache tag `CATEGORIES = "categories"` in `cache/tags.ts` (first central tag file). Admin: `/categories`, `/categories/new`, `/categories/[id]/edit` + `CategoriesTable` + `CategoryForm` + 3 server actions + a `categoryIds` multi-select field on the playlist form. Web: `CategoryFilterBar` client island reads/writes `?category=<slug>` URL param; homepage resolves slug → ObjectId before calling the playlist service; empty-state message on unknown slug (no 404). Tests: 34 API unit + 38 admin RTL + 1 E2E green. |
| UI Redesign ✅ | `6a3648d`..`ca704be` (8 phases, ~12 commits) | Plan in **`refactor_plan.md`**. **Dark-default design system**: `:root` + `[data-theme="dark"]` carry warm gold/near-black palette; `[data-theme="light"]` overrides for cream. `--color-primary` = gold `#C8A050` (dark) / `#9A7830` (light). `--shadow-up-3` added. **Theme toggle** (`features/layout/components/theme-toggle.tsx`) — SSR-safe, localStorage `nour.theme`, inline SVG moon/sun, no lucide dep. **`trackCount`** on playlists: `findPublishedPlaylists`/`findAllPlaylists` use a `$lookup` sub-pipeline aggregation; `Playlist` schema has optional `trackCount?: number`. **Cover art system** (`features/playlists/lib/cover-art.ts`): `getCoverGradient(id)`/`getCoverEmoji(id)` — 6 deterministic presets from last 2 hex chars of id. `PlaylistCard` has cover area (R2 image or gradient fallback), gradient overlay, track count badge, hover lift; title uses Fraunces. **Continue Listening shelf** gains gradient fallback, hover scrim + play circle, resume progress bar (`savedPos / duration`), `% complete` sub-label. `recently-played.ts` stores optional `duration`; `getSavedPosition(trackId)` reads `nour.player.positions`. `playback-persistence.tsx` back-fills duration from audio metadata. **Player bar**: filled gold play button (`variant="default" rounded-full`), `shadow-up-3`, desktop volume slider + mute toggle; `volume` persisted to `nour.player.prefs`. **Homepage** redesigned: hero h1/subtitle, gold "Library" accent label, `PlaylistSortSelect` (`?sort=az|tracks`, server-side sort), bilingual category pills (`arName · enName`), `?sort=` + `?category=` preserve each other. **Playlist detail** gains full-width hero image (`h-48 md:h-72`) or gradient fallback, `openGraph.images` in metadata. **Site header**: `bg-bg/85 backdrop-blur-lg`, logo `text-xl font-bold text-primary`. Tests: api 65 · admin 37 · web 53 all green. |
| SEO enhancement ✅ | `e4db044`..`afde676` (5 commits) | Plan in **`SEO_plan.md`**. Full best-practice pass — 4 phases (Opus→Sonnet→Haiku→Sonnet). NEW `apps/web/lib/seo.ts`: `SITE_URL`/`SITE_NAME`/`OG_IMAGE`, `absoluteUrl`, `localeAlternates` (x-default), JSON-LD builders (Organization/WebSite/MusicPlaylist/BreadcrumbList), `defaultOpenGraph`/`defaultTwitter`. NEW `features/seo/components/json-ld.tsx`: nonce-aware async server component — reads `x-nonce` request header, stamps it on the `ld+json` script (mandatory for CSP `strict-dynamic`). Root `app/layout.tsx` gains `metadataBase` + default OG/Twitter. `[locale]/layout.tsx`: raster icons wired (favicon.ico, favicon-32/16, apple-touch-icon), title template (`%s — Nour`), Organization + WebSite `<JsonLd>`. `[locale]/page.tsx`: `localeAlternates` (adds `x-default`), full OG/Twitter. `playlists/[slug]/page.tsx`: siteName, twitter, x-default, MusicPlaylist + BreadcrumbList `<JsonLd>`, cover-or-default OG image, `robots:{index:false}` on 404 branch. `search/page.tsx`: self-canonical. `sitemap.ts` + `robots.ts`: import `SITE_URL`; x-default in all sitemap alternates; search disallow derived from `LOCALES`. `public/manifest.webmanifest`: android-chrome PNG icons (192+512) merged in. `public/site.webmanifest` deleted (stale artifact). Assets: `public/og-image.webp` (1200×630) + full favicon raster set. i18n `metadata.homeDescription` enriched (both locales). Tests: +18 unit (`lib/seo.test.ts`) + 5 component (`features/seo/components/json-ld.test.tsx`) → web suite 77 total. Prod build ✓. **⚠️ Pending manual verify**: view-source nonce on `ld+json` (no CSP error); canonical + hreflang incl. x-default; OG/twitter in `<head>`; `/robots.txt` + `/sitemap.xml` absolute prod URLs; Google Rich Results Test; social card validator. |
| Strengthen Categories (web) ✅ | `761d2b5` | No API/schema/DB changes. **Goal**: make the category taxonomy visible where users see content, not just the homepage filter bar. `PlaylistCard` gains `categories?: { slug: string; name: string }[]` prop — renders up to 2 neutral `<span>` chips (`border border-border text-text-2 text-xs rounded-full`, `data-testid="category-chips"`) below the title; non-interactive spans (card is already a `<Link>`). Homepage builds a `categoryById` Map from the already-fetched `categories` array (zero extra DB calls) and passes resolved chips to each card. Detail page adds one `listCategories()` call (short-circuited when `playlist.categoryIds` is empty) and renders ALL category chips as locale-aware `<Link href="/?category=<slug>">` with hover states, placed between description and track-count in `<header>` — clicking pivots to the filtered homepage. Also wired `#<trackId>` hash into continue-listening hrefs (prerequisite for the autoplay fix below). Tests: web 77→**79 all green**. |
| Playlist Order ✅ | merge on `main` (2026-05-30) | Global `order: number` field on Playlist — admins drag rows in the admin `PlaylistsTable` to control display order on the public homepage. NEW `0007-playlist-order.ts` migration backfills existing playlists by `createdAt` rank and registers `{ status,order }` + `{ order }` indexes. `reorderPlaylists(orderedIds)` service (auth + `revalidateTag(PLAYLISTS_HOME)`). `reorder-playlists.action.ts` in admin. `PlaylistsTable` wraps `<tbody>` in `@dnd-kit` `DndContext`/`SortableContext` with optimistic update + rollback. Tests: api 67 · admin 40 · web 79. |
| Continue Listening autoplay fix ✅ | `59f3161` | **Bug**: clicking a continue-listening card navigated to the playlist page but nothing played — `TrackListPlayer` had no auto-play-on-mount logic. **Fix** (2 files): (1) `continue-listening.tsx` appends `#${item.trackId}` to each card's href. (2) `track-list-player.tsx` gains a one-shot `useEffect([], [])` that reads `window.location.hash` on mount, finds the matching track index in `playableTracks`, calls `loadQueue(queueTracks, idx)`, then strips the hash via `history.replaceState` so a page refresh doesn't re-trigger autoplay. Autoplay fires because the link-click sets `hasInteractedRef.current = true` in `PlayerProvider` before the playlist page mounts. |
| Scholar photos on home cards ✅ | HEAD (uncommitted, 2026-06-01) | Homepage playlist cards show a scholar photo stored as a **static `/public` path** in `playlist.scholarImage` (e.g. `/muhmd-bakr.png`), rendered directly via `next/image` (`unoptimized` + `fill`); gradient+emoji fallback only when a playlist has no `scholarImage`. Removed the R2 `coverMediaId`→`getMediaUrlById` cover pipeline from `playlist-card.tsx` (cover-by-upload stays in the schema, just isn't read by the card) and deleted the short-lived `playlist-cover-image.tsx` client wrapper. **Root-cause fix**: the `proxy.ts` next-intl matcher was an explicit allow-list and locale-redirected un-listed `/public` files (`/muhmd-bakr.png` → `/ar/muhmd-bakr.png` → 404), so a correctly-rendered `<img>` showed nothing — matcher now excludes any dotted path (see gotcha). Continue Listening untouched (still emojis). Tests: web 78 green; typecheck clean. |
| Adhkar vertical ✅ | `780635a`..`723650d` | New `Azkar` resource: embedded-locale, embedded `items[]` array (no Playlist/Track split). Zod schema · Mongoose model · lean repo · RBAC service · migration `0008-azkar-indexes` (last in runner) · idempotent seed `scripts/seed-adhkar.ts`. Admin: AzkarForm with repeatable dhikr items editor (TanStack Form v1, `createEmptyDhikrItem()` factory for stable row keys) · 4 server actions · dnd-reorder table. Web: `AdhkarReader` client island (tap-counter, auto-advance, daily-reset device-local progress `nour.adhkar.progress`) · landing page · reading-view page (Arabic slug decode, per-item audio resolve) · header nav link · AR/EN i18n namespace · E2E smoke. ⚠️ Run migration `0008` in isolation on Atlas (do not run full chain). Seed requires `pnpm seed:adhkar` with valid `MONGODB_URI`. Tests: api 85 · admin 48 · web 87. |
| Prayer Times ✅ | HEAD (2026-06-05) | New public feature: homepage **Sun Arc widget** + dedicated **/prayer-times** page, sharing one isomorphic compute path. Plan: `docs/superpowers/plans/2026-06-05-prayer-times.md`; spec: `docs/superpowers/specs/2026-06-05-prayer-times-design.md`. NEW dep `adhan` 4.4.3 (ADR `docs/adr/0004-adhan-js.md`). **packages/api**: `schemas/prayer-times.ts` (method/madhab/location/prefs zod; `DEFAULT_LOCATION`=Cairo, `DEFAULT_METHOD`=Egyptian, `DEFAULT_MADHAB`=standard, `CALCULATION_METHOD_IDS` ×12), `services/prayer-times.service.ts` — **pure, no auth/DB** (deliberate, documented departure): `computePrayerTimes`/`getNextPrayer`/`getUpcomingPrayer` (rolls to tomorrow's Fajr)/`getDayProgress`; new export subpaths `./schemas/prayer-times` + `./services/prayer-times`. Hijri via built-in `Intl` (no dep). NEW token `--color-sun` (bright gold glow) in `tokens.css` (both themes) + `packages/ui/src/styles/globals.css` `@theme inline` bridge (NOT apps/web/app/globals.css — that only re-imports the UI sheet). **apps/web `features/prayer-times/`**: `data/cities.ts` (~24 curated cities + `nearestCity`), `lib/format.ts` (clock/countdown/hijri/gregorian), `lib/sun-arc.ts` (pure geometry: `ARC`/`arcPath`/`arcPoint`/`tForFraction`), `hooks/use-prayer-settings.ts` (localStorage `nour.prayer.location` + `nour.prayer.prefs`, SSR-safe defaults), components `sun-arc` (full-bleed SVG, gold rayed sun = current time, glowing dot = next prayer; one `<svg>` viewBox 600×150 `meet`), `prayer-countdown` (1s tick), `prayer-timetable`, `date-card`, `location-picker` (city search + geolocation), `method-settings`, `prayer-times-widget` (exports `buildArcDots`), `prayer-page`. Route `app/[locale]/prayer-times/page.tsx` (force-dynamic + metadata/alternates); widget mounted on `app/[locale]/page.tsx` between hero and `<hr>`; header nav link (`site-header.tsx`, `prayer.nav`). i18n `prayer` namespace (ar/en). Device-local only (no DB/auth). v1 formats times in the **viewer's device timezone** (per-location tz deferred). **Deferred**: adhan audio, notifications, monthly view, verse-of-the-day. Tests: api 85 · web 105 green; web build ✓ (route `ƒ /[locale]/prayer-times`); lint clean. |
| Quran Reader — P1 ✅ | `feature/quran-reader` (2026-06-07) | Mobile-first Quran reading vertical. Spec `docs/superpowers/specs/2026-06-05-quran-reader-design.md`; plan `docs/superpowers/plans/2026-06-05-quran-reader-phase1.md`. **New immutable Mongo collections** (isolated from existing data): `quranSurahs` (114), `quranAyahs` (6236, **embedded `words[]`** for word-by-word), `quranEditions`, `quranTranslations`, `quranReciters`. **packages/api**: `schemas/quran.ts` (+reader DTOs `ReaderAyah`/`SurahReader`), 5 `db/models/quran-*.model.ts`, `repositories/quran.repo.ts`, `services/quran.service.ts` — **pure public reads, no auth** (`listSurahs`/`listEditions`/`listReciters`/`getSurahReader`/`getJuzReader`); **audio URLs are COMPUTED** (everyayah.com `<base><pad3(surah)><pad3(ayah)>.mp3`), never stored. Default translation by locale (ar→`ar.muyassar`, en→`en.sahih`), caller-overridable. `QURAN` cache tag. Migration `0009-quran-indexes` (additive `ensureIndexes`; run `--only`, never full chain). **All new `@repo/api` subpaths registered in package.json exports.** Seed `scripts/seed-quran.ts` (`pnpm seed:quran`) — seed-time fetch from Al-Quran Cloud + quran.com v4, idempotent upserts, self-indexes. **apps/web `features/quran/`**: `lib/{audio-url,quran-prefs,quran-progress}.ts` (device-local `nour.quran.prefs`/`.lastread`/`.bookmarks`), `hooks/use-ayah-audio.ts` (reader-scoped single `HTMLAudioElement`: auto-advance + repeat-ayah + `currentGlobal` highlight — independent of the global player), components `ayah-row`/`word-by-word`/`translation-block`/`reader`/`reader-settings-sheet`/`surah-index`/`surah-juz-tabs`/`continue-reading`. Routes `app/[locale]/quran/{page,[surah]/page}.tsx` (force-dynamic). Mushaf font **Amiri Quran** via `next/font/google` → `--font-quran` token (bridged in `packages/ui/src/styles/globals.css` `@theme inline`; fallback in `tokens.css`). i18n `quran` namespace (ar/en) + header nav link. E2E `tests/e2e/quran.smoke.test.ts` (needs seed). **Deferred to P2**: tafsir, mushaf-page toggle, bookmarks mgmt UI, homepage continue-reading shelf, Quran search, multi-reciter/edition pickers, R2 audio mirroring. **⚠️ Manual run pending**: `pnpm seed:quran` against Atlas (writes 6k+ docs + ~120 external API calls — NOT auto-run); then web build + E2E. Tests: api **109** green (incl. 5 new Quran) · 14 new Quran web unit/RTL tests green; web typecheck clean for Quran. |
| Quran Reader — P2 ✅ | `feature/quran-reader` (2026-06-07) | Tafsir + bookmarks + homepage continue-reading. Spec/plan in `docs/superpowers/{specs,plans}/2026-06-07-quran-reader-phase2*`. NEW `quranTafsir` collection (`quran-tafsir.model.ts`, unique `{editionSlug,numberGlobal}`), `findTafsir`/`findEditionsByType` repo reads, `getTafsir(numberGlobal,{locale,editionSlug?})` service (locale-default: ar→`ar.saadi`, en→`en.ibnkathir`; pure public read). Migration `0010-quran-tafsir-indexes` (additive; `--only`). Seed extended: `seedTafsir` loops quran.com **`/tafsirs/{id}/by_chapter/{n}`** (NOT `/quran/tafsirs/{id}` — that returns empty) — Ibn Kathir id 169 (6236 rows), al-Saadi id 91 (6177 rows; upstream gap, verified). Web: cached public route `GET /api/quran/tafsir?ayah=&locale=` (script-stripped html, `immutable` cache); `tafsir-sheet.tsx` bottom-`Sheet` lazy-fetches on open (dir per edition); 📖 button in `ayah-row`. `/quran/bookmarks` page + `bookmarks-list` (grouped by surah) + index link. Homepage `continue-reading-shelf` (device-local). **`AyahRef` enriched** with `numberGlobal`+`surahName` (back-compat) so deep-links scroll (`#ayah-<numberGlobal>`); P1 continue-reading link fixed. i18n `quran` namespace +7 keys (ar/en parity, 19 total). **Deferred:** Quran search, mushaf-page toggle, multi-reciter/edition pickers, selectable tafsir, R2 audio mirroring. Tests: api **110** · web quran **23** (8 files) green; web build ✓ (routes `/quran/bookmarks` + `/api/quran/tafsir`); lint+typecheck clean. |


---

## Next phase

MVP is **deploy-ready** (Wave 5.4 stays ⚠️ Partial because Sentry SDK install is intentionally deferred — env var stubbed; optional per `.env.example`). To actually go live: open **`deploy.md`** and walk the 11 steps top-to-bottom.

**i18n A+B + embedded-locale + SoundCloud-UX/offline-PWA/search + UI Redesign + SEO enhancement + Strengthen Categories are all complete** (see waves rows above). Postponed/manual items: Phase 6 E2E/Lighthouse (Playwright RTL + redirect; non-blocking); real-device Media Session + offline-replay (DevTools Offline) + Lighthouse PWA verification; R2 CORS for offline audio (deploy.md step 2.4) + migration `0006` on prod (deploy.md step 6).

**SEO manual verification (still pending):** view-source nonce on `ld+json` script (no CSP console error); `<link rel="canonical">` + all `hreflang` incl. `x-default`; `og:site_name` + `og:image` + `twitter:card` in `<head>`; `/robots.txt` + `/sitemap.xml` return absolute prod URLs; Google Rich Results Test (MusicPlaylist + BreadcrumbList valid); social card validator shows image + title.

**Strengthen Categories manual verification:** homepage cards for categorised playlists show ≤2 neutral chips below the title; cards with no categories show none. Playlist detail page shows all category chips between description and track-count — clicking one lands on `/?category=<slug>` with the grid filtered and the matching filter-bar pill active. RTL (`/ar`) — chips align correctly, no directional spacing issues.

**Next: P2-B Lectures** (PLAN.md §13). Tickets not yet written; brainstorm + write a wave plan before coding (use `superpowers:brainstorming` then `superpowers:writing-plans`).

---

## Resolved issues — embedded-locale follow-ups (debug session 2026-05-28, NOW COMMITTED to `main`)

These embedded-locale + slug fixes are all FIXED and committed (history kept for context). No action needed.

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
    models/azkar.model.ts       → AzkarModel (collection "azkar"; hot-reload guard; 4 indexes)
    migrations/
      0001-indexes.ts            → ensureIndexes on Playlist/Track/Media (safe no-op after 0004)
      0002-category-indexes.ts   → playlists.categoryIds array index + PlaylistModel.ensureIndexes (no-op after 0004)
      0003-i18n-backfill.ts      → sets locale='ar', mints contentId, relinks tracks (idempotent; skips docs with locale set)
      0004-i18n-indexes.ts       → drops old bare-slug unique indexes, rebuilds compound {locale,slug}+{contentId,locale}
      0006-search-indexes.ts     → text indexes on playlists (ar/en title+description) + tracks (ar/en title); additive
      0007-playlist-order.ts     → backfills Playlist.order (rank by createdAt ASC); registers { status,order } + { order } indexes
      0008-azkar-indexes.ts      → ensureIndexes on AzkarModel; runner order LAST after 0007
      ⚠️ Runner order in scripts/migrate.ts: [0003, 0004, 0005, 0001, 0002, 0006, 0007, 0008] — 0003 MUST precede ensureIndexes; 0008 last
  repositories/
    playlist.repo.ts      → findPlaylistById/BySlug, findPublishedPlaylists({categoryId?})/findAllPlaylists → PlaylistLeanWithCount[] (sorted by order ASC),
                            create/update/delete, updatePlaylistOrder(orderedIds) bulkWrite
    track.repo.ts         → findTrackById/ByPlaylist/BySlug, create/update/delete, updateTrackOrder (bulkWrite)
    media.repo.ts         → findMediaById, create, updateById
    category.repo.ts      → findAll/ById/BySlug/ByContentId, create/update/delete, pullCategoryFromPlaylists
    azkar.repo.ts         → findPublishedAzkar / findAllAzkar / findAzkarBySlug / findAzkarById / createAzkar / updateAzkarById / deleteAzkarById / updateAzkarOrder
  schemas/
    locale.ts             → localeSchema, LOCALES=['ar','en'], DEFAULT_LOCALE='ar', Locale type, isLocale()
    user.ts               → User, UserRole, Credentials
    playlist.ts           → Playlist (categoryIds hold category _ids, order: number, optional trackCount?: number,
                            embedded ar/en.scholarName? bilingual scholar name, top-level scholarImage? path/URL), PlaylistStatus, *Input
    track.ts              → Track (playlistId, order), TrackCreateInput, TrackUpdateInput
    media.ts              → Media, MediaMimeType, MediaStatus, *Input
    category.ts           → Category (contentId, locale), CategoryCreateInput, CategoryUpdateInput
    azkar.ts              → DhikrItem, Azkar, AzkarCreateInput, AzkarUpdateInput (embedded items[])
  utils/
    slug.ts               → slugify(input, contentIdFallback?) — Unicode-aware, Arabic-safe, de-duped from 3 old services
    id.ts                 → newObjectIdString() — mints a fresh Mongoose ObjectId as a hex string
  services/
    auth.service.ts       → verifyCredentials, createAdminUser
    playlist.service.ts   → getPublishedPlaylists({categoryId?}) → Playlist[] with trackCount (sorted by order), getAllPlaylists(session),
                            getPlaylistBySlug(locale, slug), getPlaylistById(id, session),
                            create (default order=countDocuments)/update (categoryIds validated), delete/publish/unpublish,
                            reorderPlaylists(orderedIds) — requireSession(['admin']) + updatePlaylistOrder + revalidateTag(PLAYLISTS_HOME)
    track.service.ts      → getTracksWithUrls(playlistId), getTrackById, create/update/delete,
                            reorderTracks(playlistId, orderedTrackIds) — writes Track.order only
    media.service.ts      → createMedia, confirmMedia, getMediaUrlById (both create/confirm call requireSession — defense in depth)
    category.service.ts   → listCategories(), getCategoryBySlug(locale, slug), getCategoryById, create/update,
                            delete (cascade $pull; revalidates all locales)
    search.service.ts     → searchContent(locale, q, limit=20) — public read, $text over published playlists + tracks;
                            locale-resolves hits; track hits link to their published parent playlist; empty on blank/invalid q.
                            Needs migration 0006 text indexes (else $text errors). Exported at @repo/api/services/search.
    azkar.service.ts      → getPublishedAzkar · getAzkarBySlug · getAllAzkar · getAzkarById · createAzkar / update / delete / publish / unpublish / reorderAzkar;
                            ADHKAR + azkarTag(id) cache tags
  cache/tags.ts           → PLAYLISTS_HOME (constant), playlistTag(id) (function), CATEGORIES (constant), ADHKAR (constant), azkarTag(id) (function)
  media/
    r2-client.ts          → createPresignedUpload(key, mime, bytes), headObject(key), ALLOWED_AUDIO_MIME_TYPES
  errors/index.ts         → AppError + codes (UNAUTHORIZED/FORBIDDEN/NOT_FOUND/VALIDATION/CONFLICT/RATE_LIMITED/INTERNAL)
  index.ts                → public barrel (getDb, disconnectDb, auth, signIn, signOut, handlers, requireSession + all schema types)

packages/config/src/env.ts  → Zod-parsed env (MONGODB_URI, AUTH_SECRET, R2_* vars)

packages/ui/src/
  styles/tokens.css         → design tokens. Dark-default: :root + [data-theme="dark"] = gold/near-black;
                              [data-theme="light"] = cream overrides. --color-primary = #C8A050 (dark) / #9A7830 (light).
                              --shadow-up-3 added for player bar.
  primitives/
    button.tsx              → Button (cva: default/secondary/outline/ghost/destructive/link × sm/default/lg/icon)
    input.tsx               → Input (aria-invalid for error state)
    dialog.tsx / sheet.tsx / progress.tsx / slider.tsx / toaster.tsx
  patterns/
    form-field.tsx          → FormField({ label, htmlFor?, error?, children }) — label + input slot + error message
  blocks/audio-player/
    audio-player.tsx        → sticky bottom UI. Play button: filled gold circle (variant=default, rounded-full).
                              shadow-up-3. Desktop volume slider (hidden md:flex) + mute toggle (Volume2/VolumeX lucide).
                              Seek slider (gold fill via --color-primary). Shuffle/repeat active = text-primary (gold).
                              "Playback settings" Sheet: speed presets + sleep timer. Queue Sheet. RTL-safe.
                              Keyboard: space, ←/→ (±10s), n/p (track), s (shuffle), r (repeat).
    player-context.tsx      → PlayerProvider — single HTMLAudioElement ref, queue state, keyboard handlers, navigation persistence.
                              Shuffle (Fisher–Yates) + repeat off/all/one + playbackRate + **volume** (0-1).
                              Prefs (rate/repeat/shuffle/volume) persist to `nour.player.prefs`. Resume positions in
                              `nour.player.positions`. Sleep timer (timed fade-pause + end-of-track).
                              Media Session API wired. Exports PLAYBACK_RATES + RepeatMode + SleepTimerOption.
                              Context exposes: volume, setVolume (in addition to all prior exports).
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
      reorder-playlists.action.ts        → global playlist order update; wraps reorderPlaylists service
      toggle-publish.action.ts           → publish/unpublish + revalidateTag
    components/
      playlists-table.tsx                → PlaylistsTable (TanStack Table v8, status filter, @dnd-kit drag-and-drop rows — optimistic reorder + rollback); exports SerializedPlaylist
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
  features/adhkar/
    schemas/azkar-form.schema.ts         → Zod schema reused by create + edit
    actions/
      create-azkar.action.ts             → form submit → azkarService.create → revalidateTag
      update-azkar.action.ts             → form submit → azkarService.update → revalidateTag
      reorder-azkar.action.ts            → batch order update; optimistic-friendly
      toggle-publish.action.ts           → publish/unpublish + revalidateTag
    components/
      azkars-table.tsx                   → TanStack Table v8, @dnd-kit drag-and-drop rows — optimistic reorder + rollback
      azkar-form.tsx                     → shared create/edit form (TanStack Form + Zod) — repeatable dhikr items editor
  app/adhkar/
    page.tsx                             → RSC list page
    new/page.tsx                         → create form
    [id]/edit/page.tsx                   → edit form
  lib/
    route-helpers.ts                     → appErrorStatus(AppError) → HTTP status code
  vitest.config.ts                       → jsdom + @vitejs/plugin-react; no vite-tsconfig-paths (ESM conflict)
  vitest.setup.ts                        → @testing-library/jest-dom/vitest + explicit afterEach(cleanup)

apps/web/
  app/layout.tsx                         → passthrough root + static `metadata` export (metadataBase + default OG/Twitter)
  app/[locale]/layout.tsx                → sets <html lang={locale} dir data-theme="dark">, loads IBM Plex Sans Arabic,
                                            wraps NextIntlClientProvider + PlayerProvider. ThemeToggle mounted in SiteHeader.
                                            generateMetadata: title template, raster icons, defaultOpenGraph/Twitter.
                                            Renders <JsonLd> (Organization + WebSite) once per locale in <body>.
  app/[locale]/page.tsx                  → RSC homepage: hero h1/subtitle, listCategories() → bilingual pills,
                                            getPublishedPlaylists({categoryId?}) → server-sort by ?sort=az|tracks → grid.
                                            PlaylistSortSelect client island writes ?sort=; CategoryFilterBar preserves ?sort=.
                                            ContinueListening shelf at bottom. generateMetadata: localeAlternates (x-default) + OG/Twitter.
                                            (force-dynamic)
  app/[locale]/playlists/[slug]/page.tsx → RSC detail: full-width hero image (h-48 md:h-72) or gradient fallback above title;
                                            getPlaylistBySlug + getTracksWithUrls + getMediaUrlById for cover;
                                            generateMetadata: localeAlternates (x-default), siteName, twitter, OG cover-or-fallback.
                                            Renders <JsonLd> (MusicPlaylist + BreadcrumbList). (force-dynamic)
  app/[locale]/search/page.tsx           → RSC search results (reads ?q=, calls searchContent; force-dynamic; robots noindex + canonical)
  app/[locale]/{loading,playlists/[slug]/loading,search/loading}.tsx → Suspense skeletons (token pulse divs)
  app/robots.ts                          → robots.txt: disallow /api + /${locale}/search (derived from LOCALES); SITE_URL from lib/seo
  app/sitemap.ts                         → dynamic sitemap.xml (force-dynamic; home + playlists per locale; hreflang + x-default;
                                            DB try/catch-guarded; SITE_URL from lib/seo)
  app/api/health/route.ts                → GET → { ok, version, time }
  lib/seo.ts                             → SEO helpers: SITE_URL/SITE_NAME/OG_IMAGE, absoluteUrl, localeAlternates (x-default),
                                            JSON-LD builders (organizationLd/webSiteLd/musicPlaylistLd/breadcrumbLd),
                                            defaultOpenGraph/defaultTwitter. Read process.env directly (not env barrel — build-time safe).
  features/seo/components/json-ld.tsx    → <JsonLd data={...}> async server component: reads x-nonce header, stamps nonce on
                                            ld+json script (mandatory — CSP strict-dynamic blocks unnonce'd inline scripts).
                                            Escapes < to prevent </script> breakout.
  public/manifest.webmanifest            → PWA manifest (start_url /ar, standalone, SVG + android-chrome 192/512 PNG icons)
  public/og-image.webp                   → default/fallback social share image (1200×630); used by defaultOpenGraph/Twitter
  public/favicon.ico                     → browser favicon (raster)
  public/favicon-32x32.png / favicon-16x16.png → explicit-size favicon PNGs
  public/apple-touch-icon.png            → 180×180 iOS home screen icon
  public/android-chrome-192x192.png / android-chrome-512x512.png → PWA icons (also in manifest)
  public/sw.js                           → hand-rolled service worker (ADR 0003): nav network-first→offline.html,
                                            static cache-first, R2 audio cache-played + Range 206, /api never cached
  public/offline.html                    → static offline fallback (precached by sw.js)
  public/icons/icon.svg                  → SVG app icon (sizes:"any", maskable)
  features/pwa/components/
    service-worker-register.tsx          → registers /sw.js (production only); mounted in [locale]/layout
    install-prompt.tsx                   → captures beforeinstallprompt → dismissible "Install" banner (localStorage dismiss)
  features/search/components/
    search-box.tsx                       → header search island → router.push(/search?q=) (inline SVG icon, no lucide dep in web)
    search-box.test.tsx                  → RTL test for submit/navigation
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
    site-header.tsx                      → header: bg-bg/85 backdrop-blur-lg; logo font-display text-xl font-bold text-primary;
                                            ThemeToggle on right side
    site-footer.tsx                      → footer (text-text-2, border-border)
    theme-toggle.tsx                     → **new**: SSR-safe dark/light toggle; localStorage nour.theme; inline SVG moon/sun
  features/playlists/
    lib/cover-art.ts                     → **new**: getCoverGradient(id) + getCoverEmoji(id) — 6 deterministic presets from id[-2:]
    types.ts                             → SerializedPlaylist (now includes optional trackCount?) / SerializedPlayableTrack / DisplayTrack DTOs
    components/
      playlist-card.tsx                  → RSC: scholar photo from /public (playlist.scholarImage, e.g. "/muhmd-bakr.png")
                                            rendered directly via next/image (unoptimized, fill); gradient+emoji fallback only
                                            when no scholarImage. trackCount badge, category chips, Fraunces title, hover lift.
                                            (No longer reads coverMediaId/getMediaUrlById on the card.)
      playlist-sort-select.tsx           → **new**: client island; ?sort=newest|az|tracks; preserves ?category=
      track-row.tsx                      → row UI; track number uses text-end (logical, RTL-safe)
      track-list-player.tsx              → client island: maps rows; click → player.loadQueue
  features/categories/
    components/
      category-filter-bar.tsx            → client island: bilingual pills (arName · enName); gold active state;
                                            useSearchParams preserves ?sort= when changing category
  features/adhkar/
    lib/adhkar-progress.ts               → device-local adhkar progress store (nour.adhkar.progress; daily-reset by UTC date)
    components/
      adhkar-reader.tsx                  → client island: tap-counter, auto-advance through items, device-local persist
      adhkar-card.tsx                    → RSC: azkar title, item count, category chips
      adhkar-card-progress.tsx           → progress bar (read from adhkar-progress store)
  app/[locale]/adhkar/
    page.tsx                             → RSC landing page (list all published azkars with progress cards)
    [slug]/page.tsx                      → RSC reading view (Arabic slug decode, per-item audio resolve via getTracksWithUrls logic)
  features/player/
    lib/recently-played.ts               → device-local recently-played store (nour.player.recent; MRU, capped 20);
                                            RecentTrack now has optional duration?; getSavedPosition(trackId) reads nour.player.positions
    components/
      playback-persistence.tsx           → records plays + durationSecs; back-fills duration from audio context after metadata load
      continue-listening.tsx             → shelf: gradient fallback, hover scrim+play circle, resume progress bar, % complete label
      audio-player.test.tsx              → RTL tests (shuffle/repeat/speed/sleep/Media Session/volume slider)
      continue-listening.test.tsx        → RTL tests (resume bar width, percentComplete label, bar absent without duration)

tests/e2e/
  web.smoke.test.ts                      → homepage loads + first track plays + deep-link to playlist
  admin.smoke.test.ts                    → login + create playlist + upload track
playwright.config.ts                     → projects for web (3000) + admin (3001), webServer auto-boot

scripts/
  seed-admin.ts        → pnpm seed:admin --email --password [--force]  (--force required when NODE_ENV=production)
  seed-adhkar.ts       → pnpm seed:adhkar (requires valid MONGODB_URI; idempotent morning + evening seed)
  migrate.ts           → pnpm migrate [--dry-run]
  tsconfig.json        → path aliases for @repo/* (explicit .service.ts mappings)

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
- CSP is **nonce-based**, emitted by `proxy.ts` in both apps (`lib/csp.ts` builds the directive). The static security headers in `next.config.ts` no longer include CSP — do not add it there or you'll get duplicate headers. Both apps' RSC pages are marked `export const dynamic = "force-dynamic"` because a per-request nonce is incompatible with static prerendered HTML; admin pages additionally need this because they hit Mongo at request time and Vercel build runs without Atlas connectivity. Adopting ISR/static caching in Phase 2 needs a different CSP strategy (subresource hashes or removing the nonce constraint). `script-src` is `'self' 'nonce-…' 'strict-dynamic'` — intentionally NO `'unsafe-inline'` fallback (CSP2-only clients would otherwise bypass nonce enforcement). **Dev only:** `'unsafe-eval'` is appended to `script-src` when `NODE_ENV !== 'production'` (React dev build + Turbopack HMR need eval()); the production branch must never include it. **PWA additions (ADR 0003):** `lib/csp.ts` now also emits `worker-src 'self'`, `manifest-src 'self'`, and the R2 origin in `connect-src` (the service worker fetches audio via `fetch`, governed by connect-src — not media-src). `proxy.ts` matcher now excludes **any path containing a dot** (every `/public` file — scholar photos, `sw.js`, `manifest.webmanifest`, `offline.html`, `og-image.png`, favicons, `icons/*.svg`) so next-intl never locale-redirects them (see the static-file gotcha below); `next.config.ts` sets `Cache-Control: no-cache` + `Service-Worker-Allowed: /` on `/sw.js`.
- **PWA / offline (ADR 0003)**: `apps/web` is an installable PWA via a hand-rolled `public/sw.js` (no next-pwa dep). SW registers in **production only** (`service-worker-register.tsx`); dev relies on Turbopack HMR + the relaxed `'unsafe-eval'` CSP. Navigations are cached at runtime (network-first, full Response incl. nonce'd CSP header → offline page stays self-consistent — this sidesteps the `force-dynamic`/nonce-precache conflict). **"Cache-played" audio needs R2 CORS**: the SW does a `mode:"cors"` full-file fetch to slice Range 206s; if the R2 bucket doesn't send CORS headers for the web origin it transparently falls back to streaming (no offline audio). Add R2 CORS (GET+Range, expose Content-Range/Length/Accept-Ranges) to the deploy runbook. Icons are SVG-only for now (raster PNG follow-up).
- **SW must NOT stale-cache RSC payloads (fixed v2).** The original `sw.js` ended with a catch-all `staleWhileRevalidate` that swept up Next App Router **RSC payloads** (client-side `<Link>` nav + prefetch — `RSC: 1` header / `?_rsc=` param). Stale-first serving meant admin content edits never reached returning/installed users and old UI kept showing on in-app navigation even after deploy (defeated server `revalidateTag` on the client; symptom: adhkar scroll reader still rendered the old paginated UI). Fix: `isRscRequest()` → `networkFirstData` (fresh online, cache fallback offline); SWR catch-all now restricted to static destinations only (image/font/style/script/manifest), everything else network-first; `VERSION` bumped to `v2` so `activate` purges the stale `v1` caches. **Rule: never add RSC/dynamic responses to a stale-while-revalidate bucket** — only content-hashed `/_next/static/*` (cache-first) and truly static assets (SWR) may be cached aggressively. `service-worker-register.tsx` now calls `reg.update()` on load + reloads once on `controllerchange` (guarded against first-install/loops) so open installed apps adopt new SWs. No SW test harness exists — verify in DevTools → Application after deploy.
- **Static `/public` files must be excluded from the `proxy.ts` matcher (web).** The next-intl middleware matcher used to be an explicit allow-list; a `/public` file NOT on the list (e.g. a scholar photo `/muhmd-bakr.png`) matched the middleware and got locale-redirected to `/ar/muhmd-bakr.png` → 404, so a correctly-rendered `<img src="/muhmd-bakr.png">` showed nothing. Fixed by switching the negative lookahead to exclude **any path containing a dot**: `"/((?!api|_next/static|_next/image|.*\\..*).*)"`. App routes never contain a dot (slugs are `[\p{L}\p{N}]`+hyphens), so this is safe and self-maintaining for new public assets. `proxy.ts`/middleware edits need a **dev-server restart** to take effect (no reliable HMR). `apps/admin` doesn't serve such assets — its matcher is unchanged.
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
- **Migration runner order is `[0003, 0004, 0005, 0001, 0002, 0006, 0007]`** (not numeric). `0003` backfills `locale`/`contentId` on all existing docs first. `0004` drops the old bare-slug unique indexes. `0005` merges per-locale doc pairs into embedded `{ar,en}` sub-objects and removes `contentId`/`locale` fields. `0001`/`0002` then call `ensureIndexes()` with the final schema. `0002` intentionally does NOT recreate the bare `categories.slug` unique (dropped by `0004`). `0006` adds text indexes (additive, safe last before `0007`). `0007` backfills `Playlist.order` by `createdAt` rank and registers the two new playlist-order indexes.
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
- **JSON-LD structured data MUST carry the per-request nonce** — CSP is `strict-dynamic` with no `'unsafe-inline'` in `script-src`, so a bare inline `<script type="application/ld+json">` is silently dropped by the browser. Always use `<JsonLd>` from `features/seo/components/json-ld.tsx`; it reads the `x-nonce` request header set by `proxy.ts` and applies it automatically. Never add ld+json any other way.
- **SEO files read `process.env.NEXT_PUBLIC_WEB_URL` directly** — `lib/seo.ts`, `app/sitemap.ts`, and `app/robots.ts` bypass the `@repo/config/env` barrel (same exception as health routes / `next.config.ts`). `NEXT_PUBLIC_*` is build-inlined, not a secret. In production, `NEXT_PUBLIC_WEB_URL` MUST be set to the real origin or every canonical/sitemap/OG URL falls back to `http://localhost:3000`.
