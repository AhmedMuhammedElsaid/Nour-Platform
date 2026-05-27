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

Audio MVP (Waves 0–5) + pre-deploy fixups + hardening sprint + **P2-A Categories** all landed. Head of `main` = `f3567d1`.

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
| i18n A+B (AR/EN) 🚧 on branch `feat/i18n-wave-a` | `2358620`..`38b7a3d` | **Bilingual content + web UI**, NOT yet merged to `main`. Plan in **`localization.md`**; decisions in **`docs/adr/0001-next-intl.md`** + **`0002-arabic-slugs.md`**. Data model = **per-locale documents** (DATABASE.md §3): `playlists`/`categories`/`tracks` gained `contentId` + `locale`; slug regex widened to Unicode (Arabic); `playlist.trackIds` **dropped** (`Track.order` is sole ordering); `track.playlistId` → `playlistContentId`; `playlist.categoryIds` now hold category **contentIds**. New compound unique indexes `{locale,slug}` + `{contentId,locale}`; migrations `0003-i18n-backfill` (locale=ar + mint contentId + relink tracks) + `0004-i18n-indexes`. Services take a `locale` param; cache tags are locale-scoped (`playlistsHomeTag`/`playlistTag`/`categoriesTag` in `cache/tags.ts`). Shared `slugify` in `utils/slug.ts`, `newObjectIdString` in `utils/id.ts`, `schemas/locale.ts` (`LOCALES`/`DEFAULT_LOCALE='ar'`). Admin chrome stays English but authors both locales ("create translation" flow: list pages group by contentId + "Add EN/AR" link → `/<res>/new?contentId=&locale=`). Web uses **next-intl**: `/ar`+`/en` always-prefixed (`localePrefix:'always'`), `apps/web/i18n/{routing,request,navigation}.ts`, `messages/{ar,en}.json`, `app/[locale]/` tree, RTL via `<html dir>` + IBM Plex Sans Arabic swapped into `--font-sans` for ar, `proxy.ts` composes next-intl middleware with the CSP nonce. hreflang via `getPlaylistSlugForLocale`. **Remaining**: Phase 6 E2E/Lighthouse + deferred `packages/ui` `use-dir` hook & audio-player RTL polish. Tests: api 49 · admin 41 · web 14; web prod build ✓. |
| P2-A — Categories ✅ | `c73e7e4` · `82d3e81` · `6972e87` · `273e518` (+ spec `c9cadef` · `7f97d40` · `8e57352`) | New `Category` resource with full admin CRUD + many-to-many on `Playlist` + public homepage filter. Spec lives in **PLAN.md §13.1**. Files: `schemas/category.ts`, `db/models/Category.model.ts` (note PascalCase filename — outlier from the lowercase models), `repositories/category.repo.ts`, `services/category.service.ts` (`listCategories` · `getCategoryBySlug` · `getCategoryById` · `createCategory` · `updateCategory` · `deleteCategory`), migration `0002-category-indexes.ts` (unique `categories.slug` + `playlists.categoryIds` array index). `playlist.service.ts` extended: `createPlaylist`/`updatePlaylist` now accept `categoryIds?: string[]` (validates IDs exist); `getPublishedPlaylists` accepts `{ categoryId }` filter. Slug collisions auto-append `-2`/`-3`. Hard delete `$pull`s the id from every playlist's `categoryIds`. New cache tag `CATEGORIES = "categories"` in `cache/tags.ts` (first central tag file). Admin: `/categories`, `/categories/new`, `/categories/[id]/edit` + `CategoriesTable` + `CategoryForm` + 3 server actions + a `categoryIds` multi-select field on the playlist form. Web: `CategoryFilterBar` client island reads/writes `?category=<slug>` URL param; homepage resolves slug → ObjectId before calling the playlist service; empty-state message on unknown slug (no 404). Tests: 34 API unit + 38 admin RTL + 1 E2E green. |

---

## Next phase

MVP is **deploy-ready** (Wave 5.4 stays ⚠️ Partial because Sentry SDK install is intentionally deferred — env var stubbed; optional per `.env.example`). To actually go live: open **`deploy.md`** and walk the 11 steps top-to-bottom — no more code changes needed.

P2-A Categories is **complete** (`c73e7e4..273e518`, see waves row above). The category vertical is the canonical sibling for the next P2 verticals — clone its layout (`schemas/<x>.ts` + `db/models/<x>.model.ts` + `repositories/<x>.repo.ts` + `services/<x>.service.ts` + `admin/features/<x>/` + cache-tag constant) rather than re-deriving the pattern.

**In flight: i18n A+B** on branch `feat/i18n-wave-a` (see waves row + `localization.md`). Bilingual content model + web AR/EN routing are done and green; **not merged to `main`**. Before merging: finish Phase 6 (E2E for `/`→`/ar` redirect + locale switch + RTL; Lighthouse) and the deferred `packages/ui` work (`use-dir` hook + audio-player RTL/aria — left untouched to avoid colliding with concurrent audio-player edits). A real Atlas DB needs `pnpm migrate` to run `0003`+`0004` (backfills existing rows to `locale='ar'`).

**Next: P2-B Lectures** (PLAN.md §13). Tickets not yet written; brainstorm + write a wave plan before coding (use `superpowers:brainstorming` then `superpowers:writing-plans`).

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
      0001-indexes.ts     → ensureIndexes on Playlist/Track/Media/User
      0002-category-indexes.ts → unique categories.slug + playlists.categoryIds array index
  repositories/
    playlist.repo.ts      → findPlaylistById/Slug/Published/All, create/update/delete + appendTrackId/removeTrackId
                            (Published/All also accept { categoryId } filter; create/update accept categoryIds)
    track.repo.ts         → findTrackById/ByPlaylistId/BySlug, create/update/delete, updateTrackOrder (bulkWrite)
    media.repo.ts         → findMediaById, create, updateById
    category.repo.ts      → findAll/ById/BySlug, create/update/delete, pullCategoryFromPlaylists
  schemas/
    user.ts               → User, UserRole, Credentials
    playlist.ts           → Playlist (now with categoryIds: string[]), PlaylistStatus, *Input
    track.ts              → Track, TrackCreateInput, TrackUpdateInput
    media.ts              → Media, MediaMimeType, MediaStatus, *Input
    category.ts           → Category, CategoryCreateInput, CategoryUpdateInput
  services/
    auth.service.ts       → verifyCredentials, createAdminUser
    playlist.service.ts   → getPublishedPlaylists({categoryId?}), getAllPlaylists, getPlaylistBySlug/ById,
                            create/update (accept categoryIds — validated against existing categories), delete/publish/unpublish
    track.service.ts      → getTracksByPlaylist, getTrackById, create/update/delete, reorderTracks
    media.service.ts      → createMedia, confirmMedia (both call requireSession(['admin']) — defense in depth)
    category.service.ts   → listCategories, getCategoryBySlug, getCategoryById, create/update (slug collision → -2/-3),
                            delete (hard delete + $pull from every playlist + revalidateTag CATEGORIES + PLAYLISTS_HOME)
  cache/tags.ts           → central tag constants — PLAYLISTS_HOME, CATEGORIES (use these, not raw strings)
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
    player-context.tsx      → PlayerProvider — single HTMLAudioElement ref, queue state, keyboard handlers (space, ←/→), navigation persistence

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
  app/layout.tsx                         → RootLayout wraps children in <PlayerProvider> so player survives navigation
  app/page.tsx                           → RSC homepage: resolves ?category slug → ObjectId, then getPublishedPlaylists
                                            ({ categoryId? }) → grid of PlaylistCard; renders CategoryFilterBar above grid;
                                            empty-state message for unknown slug. (export const dynamic = "force-dynamic")
  app/playlists/[slug]/page.tsx          → RSC detail: meta + track list (uses TrackListPlayer client island); generateMetadata
                                            (export const dynamic = "force-dynamic")
  app/api/health/route.ts                → GET → { ok, version, time }
  proxy.ts                               → Edge proxy: per-request CSP nonce (no auth gate; web is public)
                                            (file used to be `middleware.ts` — renamed for Next 16)
  lib/csp.ts                             → buildWebCsp(nonce, r2Hostname) — emits dynamic CSP
  next.config.ts                         → images.remotePatterns + static security headers
                                            (CSP itself is emitted by the proxy, not here)
  features/layout/components/
    site-header.tsx                      → header (logo + skip link target)
    site-footer.tsx                      → footer
  features/playlists/
    types.ts                             → SerializedPlaylist / SerializedTrack DTOs
    components/
      playlist-card.tsx                  → cover (next/image) + title + track count
      track-row.tsx                      → row UI (used inside TrackListPlayer)
      track-list-player.tsx              → client island: maps rows; click → player.loadQueue(tracks, index); URL hash mirrors current
  features/categories/
    components/
      category-filter-bar.tsx            → client island: pill list reads/writes ?category URL param via useSearchParams + router.replace
  features/player/components/
    audio-player.test.tsx                → RTL tests for the player block
  vitest.config.ts / vitest.setup.ts     → mirror admin's setup

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
- CSP is **nonce-based**, emitted by `proxy.ts` in both apps (`lib/csp.ts` builds the directive). The static security headers in `next.config.ts` no longer include CSP — do not add it there or you'll get duplicate headers. Both apps' RSC pages are marked `export const dynamic = "force-dynamic"` because a per-request nonce is incompatible with static prerendered HTML; admin pages additionally need this because they hit Mongo at request time and Vercel build runs without Atlas connectivity. Adopting ISR/static caching in Phase 2 needs a different CSP strategy (subresource hashes or removing the nonce constraint). `script-src` is `'self' 'nonce-…' 'strict-dynamic'` — intentionally NO `'unsafe-inline'` fallback (CSP2-only clients would otherwise bypass nonce enforcement).
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
- **(i18n) Per-locale documents, not embedded `{ar,en}`**: a logical playlist/category/track has ONE doc per locale, tied by a shared `contentId`. Public service reads REQUIRE a `locale` param (`getPublishedPlaylists(locale, …)`, `getPlaylistBySlug(locale, slug)`, `listCategories(locale)`, `getTracksWithUrls(locale, playlistContentId)`). `playlist.categoryIds` store category **contentIds** (locale-agnostic links), resolved slug→contentId in the RSC. `playlist.trackIds` no longer exists — query tracks by `{playlistContentId, locale}` sorted by `order`.
- **(i18n) Slugs are Unicode + unique per `(locale, slug)`**: the old ASCII-only `slugify` produced empty slugs for Arabic titles (ADR 0002). The shared `utils/slug.ts` keeps any-script letters; empty normalization falls back to `item-<contentId tail>`. The same slug may exist in both locales without collision.
- **(i18n) Cache tags are locale-scoped**: use `playlistsHomeTag(locale)` / `playlistTag(locale, slug)` / `categoriesTag(locale)` from `cache/tags.ts` — never the old bare `PLAYLISTS_HOME`/`CATEGORIES` constants (removed). Category delete pulls its contentId from playlists only when the LAST locale variant is gone.
- **(i18n) Web is next-intl with `localePrefix:'always'`**: all routes live under `apps/web/app/[locale]/`; root `app/layout.tsx` is a passthrough, `[locale]/layout.tsx` owns `<html lang dir>`. `proxy.ts` COMPOSES next-intl routing with the CSP nonce (mutates `request.headers` x-nonce before calling the intl middleware, sets CSP on its response) — do not replace it with bare middleware or the nonce drops. Matcher excludes `/api`. Use `Link`/`useRouter` from `@/i18n/navigation` (locale-aware), not `next/navigation`. Chrome strings in `messages/{ar,en}.json`; RTL Arabic font = IBM Plex Sans Arabic swapped into `--font-sans` for `ar`. `vitest.config.ts` declares the `@`→app-root alias explicitly (vite-tsconfig-paths can't load).
- **(i18n) Admin chrome stays English**: forms carry an immutable `locale` + a `contentId`; "create translation" = list pages group by contentId, show locale badges + "Add EN/AR" → `/<res>/new?contentId=&locale=`. `apps/admin` was NOT internationalized (single admin).
- **Adding a design token is two edits**: declare it in `packages/ui/src/styles/tokens.css` (light + `[data-theme="dark"]`) AND map it in the `@theme inline` block of `packages/ui/src/styles/globals.css`. Skipping the map makes the Tailwind utility silently produce no value (this bit the `success` token, used by `playlist-card` before it was defined). DESIGN.md §15 documents the v4 mechanism (there is no `tailwind-config` preset). Upward player elevation is `--shadow-up-2`.
- **AudioPlayer is always mounted**: the bottom bar no longer unmounts when idle — it slides out via `translate-y-full`/`opacity-0`/`pointer-events-none` + `aria-hidden` so it can animate (DESIGN.md §17.1/§17.5). Tests assert "mounted-but-hidden", not absence. Buffering (`waiting`/`playing`/`canplay`) and error (`error` event) live in `player-context.tsx` alongside `goTo`/`retry`; the queue Sheet and a cover thumbnail + playlist title round out §17.1. Seek commits on slider release (`onValueCommit`), not per-tick.
- **Slider aria goes on the Thumb**: Radix puts `role="slider"` on `SliderPrimitive.Thumb`, so `slider.tsx` forwards `aria-label`/`aria-valuetext` there (not the role-less Root) — otherwise screen readers never announce them.
- **`getMediaUrlById(mediaId)`** in `media.service.ts` resolves a Media record to its public R2 URL (mirrors `getTracksWithUrls`; public read, no `requireSession`). Used by the playlist detail page to feed the player's cover thumbnail.
