# APP_CONTEXT.md

> Drop-in context for AI sessions. Read this + the relevant PLAN.md ticket (§16 for status). Do NOT explore the repo — use the file locations below.
> Updated after every committed wave.

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

---

## Next tickets (Wave 3 — Admin CMS)

| # | Ticket | Model | What to build |
|---|---|---|---|
| **3.2** | `admin/playlists-create-edit` | Sonnet | Full-page form (TanStack Form + Zod), title/description/cover/status; create + edit modes |
| 3.3 | `admin/tracks-upload-ui` | **Opus** | Drag-drop uploader inside playlist edit; progress bar; retry on PUT failure; confirm after upload |
| 3.4 | `admin/tracks-reorder` | Sonnet | dnd-kit reorder, `reorderTracks` service call, optimistic update (onMutate/onError) |
| 3.5 | `admin/playlists-publish` | Sonnet | Publish/unpublish toggle; `publishPlaylist`/`unpublishPlaylist` service; revalidateTag |

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
    media.service.ts      → createMedia, confirmMedia
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

apps/admin/
  app/layout.tsx                         → RootLayout (Inter + Fraunces fonts)
  app/page.tsx                           → placeholder home (will become dashboard)
  app/(auth)/login/page.tsx              → login page (RSC, awaits searchParams.from)
  app/api/auth/[...nextauth]/route.ts    → Auth.js handlers
  app/api/upload/route.ts                → POST presign + create pending Media
  app/api/media/confirm/route.ts         → POST confirm Media (headObject + status flip)
  middleware.ts                          → Edge auth gate (protects all routes except /login /api/auth)
  features/auth/
    actions/sign-in.action.ts            → signInAction(credentials, redirectTo?)
    components/login-form.tsx            → LoginForm (TanStack Form v1 + Zod)
  features/playlists/
    components/playlists-table.tsx       → PlaylistsTable (TanStack Table v8, status filter); exports SerializedPlaylist type
    components/playlists-table.test.tsx  → RTL tests (6 cases)
  app/playlists/
    page.tsx                             → RSC: requireSession → getAllPlaylists → serialize dates → <PlaylistsTable />
  lib/
    route-helpers.ts                     → appErrorStatus(AppError) → HTTP status code
  vitest.config.ts                       → jsdom + @vitejs/plugin-react; no vite-tsconfig-paths (ESM conflict)
  vitest.setup.ts                        → @testing-library/jest-dom/vitest + explicit afterEach(cleanup)

scripts/
  seed-admin.ts   → pnpm seed:admin --email --password
  migrate.ts      → pnpm migrate [--dry-run]
  tsconfig.json   → path aliases for @repo/* (explicit .service.ts mappings)
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
