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

## Completed waves (Audio MVP)

All 5 waves shipped + 1 pre-deploy fixup batch + 1 hardening batch. Head of `main` ≈ `1a4c895` (hardening uncommitted at time of write).

| Wave | Range | Notes (only what's non-obvious for a future session) |
|---|---|---|
| 0 — Foundations | `6c5202f`–`af0683b` | Turborepo, Tailwind v4 tokens, `@repo/api` skeleton (db/client, AppError, services/), CI baseline. |
| 1 — Auth | `26ea693`–`6dcea3d` | Auth.js v5 split into Node (`config.ts`) + Edge (`config.edge.ts`) — Mongo adapter needs Node, middleware needs Edge. argon2id passwords. `requireSession(roles?)` throws `AppError.Unauthorized/Forbidden`. `scripts/seed-admin.ts` + `scripts/migrate.ts`. |
| 2 — Data + Media | `1235356`–`0ccab79` | Zod schemas + Mongoose models + lean repos for Playlist/Track/Media. R2 client with `createPresignedUpload` + `headObject` + `ALLOWED_AUDIO_MIME_TYPES`. 2-step upload handshake (`/api/upload` presigns + creates pending Media → client PUTs to R2 → `/api/media/confirm` headObject + flip). All services use `requireSession` + `revalidateTag`. |
| 3 — Admin CMS | `bdf4787`–`55ac779` | `apps/admin` playlist list (TanStack Table, status filter), create+edit form (shared `PlaylistForm`, TanStack Form + Zod), drag-drop track uploader (`use-track-upload.ts` hook with retry-on-PUT), dnd-kit reorder with optimistic update, publish toggle. RSC pages serialize Dates to ISO strings before passing to client islands (see `SerializedPlaylist`). |
| 4 — Public Web + Player | `8748484`–`79f50da` + `6ac0053` | `apps/web` layout (header/footer, skip-link), homepage grid (RSC + `next/image`), playlist detail (RSC + `generateMetadata`). `packages/ui/blocks/audio-player` — single `HTMLAudioElement` ref in `PlayerProvider` wrapped at root layout so the player survives navigation. Keyboard: space (play/pause), ←/→ (seek ±10s); keydown listener bails on editable targets so form input isn't hijacked. URL hash mirrors current track. A11y: semantic landmarks, focus rings, ARIA on transport. |
| 5 — Deploy + Smoke ⚠️ | `1b97c53` + `806f2ca` fixup | Per-app `next.config.ts`: `images.remotePatterns` for R2 + static security headers (HSTS, X-Frame, Permissions-Policy). CSP moved to middleware after hardening — see below. Playwright smoke tests in `tests/e2e/`. Health endpoints return `{ ok, version, time }`. **Sentry SDK install deferred** — env var stubbed only. |
| Pre-deploy fixups | `dfae606` · `e693862` · `1fe8f69` · `1a4c895` | `media.service.ts` createMedia/confirmMedia call `requireSession(['admin'])`. `seed-admin.ts` refuses `NODE_ENV=production` without `--force`. Per-app `vercel.json` (turbo `--filter=app...` build). CI runs `pnpm test`. Root `README.md`. **`deploy.md`** step-by-step runbook. |
| Hardening sprint | `58550ba` · `40ef84c` · `577a6a9` · `41c26a8` · `e6493ca` | (A) `packages/api` now has 19 vitest unit tests across all 4 services (mocks repos + `requireSession` + `next/cache`). (B) **CSP is now nonce-based** — `proxy.ts` in both apps (renamed from `middleware.ts` for Next 16) generates a per-request nonce, sets `script-src 'self' 'nonce-…' 'strict-dynamic'` so we dropped `'unsafe-inline'` from script-src (style-src keeps it intentionally); static `Content-Security-Policy` header removed from both `next.config.ts`. (D) APP_CONTEXT seek-amount corrected to ±10s. (E) auth side-effect import replaced with `/// <reference path="../types/next-auth.d.ts" />` directive — IDE-resistant; ESLint override allows the triple-slash on those two files only. Pre-existing build-blockers fixed: Turbopack "use server" re-export bug in playlist actions (now imports schema directly), `/` + `/playlists/[slug]` marked `dynamic = "force-dynamic"` (required because nonce-CSP and because the build runs without Atlas). |

---

## Next phase

MVP is **deploy-ready**. All pre-deploy code gaps are closed (commits `dfae606..1fe8f69`) and the soft-gap hardening sprint shipped (see row above). Wave 5.4 stays ⚠️ Partial because Sentry SDK install is intentionally deferred (env var stubbed; optional per `.env.example`). To actually go live: open **`deploy.md`** at repo root and walk the 11 steps top-to-bottom — no more code changes needed.

Next phase after go-live: **P2-A Scholars + Categories** (PLAN.md §13). Tickets not yet written; brainstorm + write a wave plan before coding (use `superpowers:brainstorming` then `superpowers:writing-plans`).

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
    migrations/
      0001-indexes.ts     → ensureIndexes on all three models
  repositories/
    playlist.repo.ts      → findPlaylistById/Slug/Published/All, create/update/delete + appendTrackId/removeTrackId
    track.repo.ts         → findTrackById/ByPlaylistId/BySlug, create/update/delete, updateTrackOrder (bulkWrite)
    media.repo.ts         → findMediaById, create, updateById
  schemas/
    user.ts               → User, UserRole, Credentials
    playlist.ts           → Playlist, PlaylistStatus, PlaylistCreateInput, PlaylistUpdateInput
    track.ts              → Track, TrackCreateInput, TrackUpdateInput
    media.ts              → Media, MediaMimeType, MediaStatus, MediaCreateInput, MediaUpdateInput
  services/
    auth.service.ts       → verifyCredentials, createAdminUser
    playlist.service.ts   → getPublishedPlaylists, getAllPlaylists, getPlaylistBySlug/ById, create/update/delete/publish/unpublish
    track.service.ts      → getTracksByPlaylist, getTrackById, create/update/delete, reorderTracks
    media.service.ts      → createMedia, confirmMedia (both call requireSession(['admin']) — defense in depth on top of route handlers)
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
    schemas/playlist-form.schema.ts      → Zod schema reused by create + edit
    actions/
      create-playlist.action.ts          → form submit → playlistService.create → revalidateTag
      update-playlist.action.ts          → form submit → playlistService.update → revalidateTag
      create-track.action.ts             → called after R2 confirm; writes Track row
      reorder-tracks.action.ts           → batch order update; optimistic-friendly
      toggle-publish.action.ts           → publish/unpublish + revalidateTag
    components/
      playlists-table.tsx                → PlaylistsTable (TanStack Table v8, status filter); exports SerializedPlaylist
      playlist-form.tsx                  → shared create/edit form (TanStack Form + Zod)
      track-uploader.tsx                 → drag-drop UI inside edit page
      track-list.tsx                     → dnd-kit sortable list of tracks
      publish-toggle.tsx                 → publish/unpublish toggle button
    hooks/
      use-track-upload.ts                → presign → PUT with progress → confirm (with retry on PUT)
  app/playlists/
    page.tsx                             → RSC list page
    new/page.tsx                         → create form
    [id]/edit/page.tsx                   → edit form + track-uploader + track-list + publish-toggle
  lib/
    route-helpers.ts                     → appErrorStatus(AppError) → HTTP status code
  vitest.config.ts                       → jsdom + @vitejs/plugin-react; no vite-tsconfig-paths (ESM conflict)
  vitest.setup.ts                        → @testing-library/jest-dom/vitest + explicit afterEach(cleanup)

apps/web/
  app/layout.tsx                         → RootLayout wraps children in <PlayerProvider> so player survives navigation
  app/page.tsx                           → RSC homepage: getPublishedPlaylists → grid of PlaylistCard
                                            (export const dynamic = "force-dynamic")
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
- CSP is **nonce-based**, emitted by `proxy.ts` in both apps (`lib/csp.ts` builds the directive). The static security headers in `next.config.ts` no longer include CSP — do not add it there or you'll get duplicate headers. The hardening sprint forced `dynamic = "force-dynamic"` on web RSC pages because a per-request nonce is incompatible with static prerendered HTML. Adopting ISR/static caching in Phase 2 needs a different CSP strategy (subresource hashes or removing the nonce constraint).
- Auth module augmentation (`packages/api/src/types/next-auth.d.ts`) is loaded into both auth entries via `/// <reference path="…"/>` directives. The directive is whitelisted in `packages/api/eslint.config.mjs` for `auth/index.ts` and `auth/config.edge.ts` only. Don't switch back to a side-effect `import "../types/next-auth"` — IDE "organize imports" actions strip it silently and the `role` field disappears from `session.user`.
- Health endpoints (`apps/web` + `apps/admin`) intentionally read `process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA` directly instead of importing `@repo/config/env`. Reason: the env barrel parses at module load and requires `MONGODB_URI` + `AUTH_SECRET`, which aren't set during `next build`'s page-data collection step. The git SHA is build metadata, not a runtime secret. This is the canonical exception to CLAUDE.md §5; same pattern in `next.config.ts` files.
- `packages/api` tests run via `pnpm --filter @repo/api test` (vitest with node env). Setup file primes `MONGODB_URI` + `AUTH_SECRET` because importing `@repo/config/env` transitively at test load would otherwise throw. The `any` type is allowed in `src/**/*.test.ts` via an ESLint override so lean-doc fixtures stay terse — production code keeps `no-explicit-any: error`.
- Next 16 file convention: `middleware.ts` was renamed to `proxy.ts` in both apps. Next 16 supports both, but the deprecation warning goes away with `proxy.ts`. The exported function name (`middleware` in web, default `auth(...)` callback in admin) is still accepted — only the filename changed.
- Server Actions in admin: never re-export schemas/types from a `"use server"` file. Next 16 + Turbopack rejects the build with "The module has no exports at all". Importers must pull `playlistFormSchema` and friends directly from `features/playlists/schemas/playlist-form.schema.ts`.
