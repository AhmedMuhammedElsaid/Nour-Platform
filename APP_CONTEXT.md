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
- **CI**: `.github/workflows/ci.yml` — lint/typecheck/build via turbo affected filter

---

## Hard boundaries (CLAUDE.md §5 — non-negotiable)

| ✗ Never | ✓ Always |
|---|---|
| Import Mongoose / models inside `apps/*` | Call services from `@repo/api/services/*` |
| `process.env.X` outside `packages/config` | `env` from `@repo/config/env` |
| Raw `throw new Error(...)` at boundaries | `AppError` instances |
| Hex colors / arbitrary Tailwind values | Tokens from `tokens.css` |
| Bypass `requireSession` in services | Always check auth before mutating |
| Import from `@repo/api/db` or `@repo/api/repositories` in apps | Services only |

---

## Completed tickets

| Ticket | Commit | What was built |
|---|---|---|
| 0.1–0.4 | `6c5202f`–`af0683b` | Turborepo init, UI bootstrap (tokens + primitives), API skeleton (db/client, AppError, services/), CI |
| 1.1 | `26ea693` | Auth.js v5 (Node + Edge configs), Credentials provider, argon2id, requireSession, User model + schema |
| 1.2 | `f74d8ba` | Admin login page: handlers route, signInAction, LoginForm (TanStack Form v1 + Zod), `packages/ui/patterns/form-field` |
| 1.3 | `f8f1d83` | `apps/admin/middleware.ts` — Edge auth gate, matcher excludes /login /api/auth /_next; ?from= preserves full pathname+search |
| 1.4 | `6dcea3d` | `scripts/seed-admin.ts` + `createAdminUser` service method; `scripts/migrate.ts` + `0001-indexes` migration |
| 2.1 | `1235356` | Zod schemas: `playlist.ts`, `track.ts`, `media.ts` — full + create + update variants, all types exported |
| 2.2 | `37a47ad` | Mongoose models (Playlist, Track, Media) + lean repos (7/7/3 methods); models in `packages/api/src/db/models/`, repos in `packages/api/src/repositories/` |
| 2.3 | `1140bf0` | `0001-indexes` migration + `scripts/migrate.ts` runner; scripts tsconfig paths fixed (subpath aliases for .service.ts files) |
| 2.4 | `70d507a` | R2 client: `createPresignedUpload`, `headObject`, `ALLOWED_AUDIO_MIME_TYPES`; R2 env vars in config; `.env.example` updated |
| 2.5 | `abf6a5a` | `POST /api/upload` + `POST /api/media/confirm` route handlers; `media.service.ts` (createMedia, confirmMedia); `apps/admin/lib/route-helpers.ts` (appErrorStatus) |
| 2.6 | `0ccab79` | `playlist.service.ts` + `track.service.ts` — full CRUD with requireSession + revalidateTag; `appendTrackId`/`removeTrackId` added to playlist repo |
| 3.1 | `bdf4787` | `apps/admin/app/playlists/page.tsx` RSC + `features/playlists/components/playlists-table.tsx` client island; Vitest + RTL setup in admin; `SerializedPlaylist` DTO for RSC→client date serialization |
| 3.2 | `95c9fc6` | `playlists/new/page.tsx` + `playlists/[id]/edit/page.tsx`; `PlaylistForm` (TanStack Form + Zod) shared between create/edit; `playlist-form.schema.ts`; `create-playlist.action.ts` + `update-playlist.action.ts` (slug uniqueness handled at service layer) |
| 3.3 | `05c0304` | `track-uploader.tsx` drag-drop UI inside edit page; `use-track-upload.ts` hook drives the 3-step handshake (presign → PUT to R2 with progress → confirm) with retry-on-PUT-failure; `create-track.action.ts` writes the Track row after confirm |
| 3.4 | `a762256` | `track-list.tsx` dnd-kit sortable; `reorder-tracks.action.ts` calls `reorderTracks` service; optimistic update via TanStack Query `onMutate`/`onError` rollback |
| 3.5 | `55ac779` | `publish-toggle.tsx` + `toggle-publish.action.ts`; calls `publishPlaylist`/`unpublishPlaylist` services; `revalidateTag` fires on success |
| 4.1 | `8748484` | `apps/web/features/layout/components/site-header.tsx` + `site-footer.tsx`; `apps/web/app/layout.tsx` wraps in `PlayerProvider` so the sticky player survives route changes |
| 4.2 | `0b5d789` | `apps/web/app/page.tsx` RSC — `getPublishedPlaylists()` → grid of `playlist-card.tsx`; uses `next/image` with `sizes`; covers come from R2 |
| 4.3 | `64e2196` | `apps/web/app/playlists/[slug]/page.tsx` RSC — playlist meta + ordered `track-row.tsx` list; `generateMetadata` produces OG + canonical |
| 4.4 | `79f50da` + `6ac0053` | `packages/ui/src/blocks/audio-player/audio-player.tsx` (sticky bottom UI: play/pause, Slider seek, current/duration, prev/next) + `player-context.tsx` (single `HTMLAudioElement` ref, queue, keyboard handlers — space, ←/→). Exports wired in `packages/ui/package.json` |
| 4.5 | `79f50da` | `track-list-player.tsx` client island on the playlist detail page — clicking a row calls `player.loadQueue(tracks, index)` and autoplays; URL hash mirrors current track |
| 4.6 | `79f50da` | A11y sweep: skip link in `layout.tsx`, semantic landmarks (header/main/footer/nav), focus rings on all interactive elements, ARIA labels on player transport, keyboard nav verified on player + cards |
| 5.1 | `1b97c53` | `apps/web/next.config.ts` — `images.remotePatterns` for R2 host; `apps/admin/next.config.ts` — same |
| 5.2 | `1b97c53` | CSP, HSTS, X-Content-Type-Options, Referrer-Policy in both `next.config.ts`; `media-src` allowlist includes R2; nonce-based script-src |
| 5.3 | `1b97c53` | `playwright.config.ts` + `tests/e2e/web.smoke.test.ts` + `tests/e2e/admin.smoke.test.ts` — homepage + first-track-plays + admin login + create-playlist flows |
| 5.4 ⚠️ | `1b97c53` (+ `806f2ca` fixup) | `apps/web/app/api/health/route.ts` + `apps/admin/app/api/health/route.ts` — return `{ ok, version, time }` per DEPLOYMENT.md §6 (version = `NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA[0..7]` ?? "dev"). Sentry SDK install **deferred** — env var stubbed only; UptimeRobot wiring is a manual external step |
| Pre-deploy fixups | `dfae606` · `e693862` · `1fe8f69` | `media.service.ts` createMedia/confirmMedia now call `requireSession(['admin'])`; `seed-admin.ts` refuses NODE_ENV=production without `--force`; per-app `vercel.json` (turbo `--filter=app...` build); CI runs `pnpm test`; root `README.md`; **`deploy.md`** step-by-step runbook |

---

## Next phase

MVP is **deploy-ready**. All pre-deploy code gaps are closed (commits `dfae606..1fe8f69`). Wave 5.4 stays ⚠️ Partial because Sentry SDK install is intentionally deferred (env var stubbed; optional per `.env.example`). To actually go live: open **`deploy.md`** at repo root and walk the 11 steps top-to-bottom — no more code changes needed.

Next phase after go-live: **P2-A Scholars + Categories** (PLAN.md §13). Tickets not yet written; brainstorm + write a wave plan before coding (use `superpowers:brainstorming` then `superpowers:writing-plans`).

---

## Key file locations (quick-ref for implementers)

```
packages/api/src/
  auth/
    index.ts              → exports: auth, handlers, signIn, signOut, requireSession
    config.ts             → full Node config (Credentials + Mongo adapter)
    config.edge.ts        → Edge config (JWT callbacks, pages.signIn: '/login')
    require-session.ts    → requireSession(roles?) — throws AppError if not authed
    password.ts           → hashPassword / verifyPassword (argon2id)
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
  middleware.ts                          → Edge auth gate (protects all routes except /login /api/auth)
  next.config.ts                         → images.remotePatterns + headers (CSP, HSTS, X-Content-Type-Options)
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
  app/playlists/[slug]/page.tsx          → RSC detail: meta + track list (uses TrackListPlayer client island); generateMetadata
  app/api/health/route.ts                → GET → { ok, version, time }
  next.config.ts                         → images.remotePatterns + CSP/HSTS headers (R2 host allowed in media-src)
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
- `next.config.ts` CSP uses `'unsafe-inline'` for script-src to support Next App Router inline hydration scripts — switch to nonce-based CSP in a post-MVP hardening pass (already flagged as a TODO in both `next.config.ts` files).
