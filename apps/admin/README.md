# `apps/admin` — CMS

The Next.js content management app. Admins sign in, create playlists, upload audio tracks directly to R2, reorder them, manage categories, and publish. Everything except `/login` and `/api/auth/*` requires an authenticated `admin` session.

- **Port**: `:3001`
- **Vercel project**: built with `pnpm turbo run build --filter=admin...` (see `vercel.json`)
- **Runtime**: Node for routes, Edge for the proxy
- **Auth**: every request through the proxy; `requireSession(['admin'])` enforced again inside every mutating service (defense in depth)

See the [root README](../../README.md) for the monorepo overview and the [web README](../web/README.md) for the public side.

---

## What it does

- **`/login`** — Credentials sign-in (email + password, argon2id verify). Redirects to `?from` on success.
- **`/`** — Placeholder dashboard (will grow as more verticals land).
- **`/playlists`** — TanStack Table of all playlists with status filter. Row link to edit.
- **`/playlists/new`** — Create form (TanStack Form + Zod). Redirects to the edit page on submit.
- **`/playlists/[id]/edit`** — Full editor: metadata form + categories multi-select + drag-drop track uploader + dnd-kit track reorder list + publish/unpublish toggle.
- **`/categories`** — TanStack Table of all categories. Delete button per row (hard delete + `$pull` from every playlist).
- **`/categories/new`** — Create form. Slug auto-derives from name; collisions auto-append `-2`, `-3`.
- **`/categories/[id]/edit`** — Edit form (name, slug, description, optional cover image via MediaPicker).
- **`/api/auth/[...nextauth]`** — Auth.js handlers (Node runtime; uses the Mongo adapter).
- **`/api/upload`** — `POST` — presigns an R2 upload URL and creates a `pending` Media record.
- **`/api/media/confirm`** — `POST` — `headObject` to verify the upload landed, then flips the Media record to `confirmed`.
- **`/api/health`** — `GET → { ok, version, time }`. UptimeRobot target.

---

## The upload handshake

A core security pattern. Browsers must not get long-lived write access to R2, so uploads are a two-step dance:

```
client                  admin API                   R2
  │                         │                       │
  │ POST /api/upload ──────▶│  presign + insert     │
  │                         │  pending Media        │
  │◀──── { uploadUrl,  ─────│                       │
  │       mediaId }         │                       │
  │                                                 │
  │  PUT uploadUrl  (binary blob) ────────────────▶ │
  │◀──── 200 ────────────────────────────────────── │
  │                         │                       │
  │ POST /api/media/confirm │                       │
  │  { mediaId } ──────────▶│ headObject(key) ─────▶│
  │                         │◀───── exists, size ── │
  │                         │ updateMedia → confirmed
  │◀──── { status:          │                       │
  │       "confirmed" } ────│                       │
```

Files: `app/api/upload/route.ts`, `app/api/media/confirm/route.ts`, the client hook `features/playlists/hooks/use-track-upload.ts` (handles progress + retry on PUT), and the service layer `media.service.ts` (which `requireSession(['admin'])` itself even though the routes also enforce it — defense in depth per CLAUDE.md §5).

Allowed MIME types: `audio/mpeg`, `audio/wav`, `audio/mp4`, `audio/ogg`. Size cap: `R2_MAX_UPLOAD_BYTES` (default 50 MiB).

---

## Auth + CSP proxy

`proxy.ts` (Edge runtime) does **two** things on every request:

1. **Auth gate**: redirects unauthenticated users to `/login?from=<path>`. `/login`, `/api/auth/*`, `/_next/*`, and `/favicon.ico` are excluded. The auth gate uses the Edge-safe Auth.js config slice (`authConfigEdge` from `@repo/api/auth/edge`) — no Mongoose, no argon2.
2. **CSP nonce**: generates a per-request nonce, attaches it to the `Content-Security-Policy` response header, and adds `x-middleware-csp-nonce` to the response so future client islands can pick it up if needed.

The auth gate `return`s call `withCspNonce(...)` so the redirect to `/login` also carries CSP. The CSP directive (`lib/csp.ts`) drops `'unsafe-inline'` from `script-src` in favour of `'nonce-<…>' 'strict-dynamic'`.

> **Heads up**: every mutating service still calls `requireSession(['admin'])` internally. Removing either layer breaks the boundary contract — never trust "the route handler already checked it" alone.

---

## Routes

```
app/
  layout.tsx                          RootLayout — Inter + Fraunces fonts
  page.tsx                            placeholder dashboard
  globals.css                         Tailwind + token reset
  (auth)/login/page.tsx               sign-in (RSC, awaits searchParams.from)
  api/
    auth/[...nextauth]/route.ts       Auth.js handlers (Node runtime)
    upload/route.ts                   POST presign + create pending Media
    media/confirm/route.ts            POST headObject + flip status to confirmed
    health/route.ts                   GET { ok, version, time }
  playlists/
    page.tsx                          list (TanStack Table, status filter)
    new/page.tsx                      create form (passes availableCategories)
    [id]/edit/page.tsx                edit form + uploader + track list + publish toggle
  categories/
    page.tsx                          list + delete button per row
    new/page.tsx                      create form
    [id]/edit/page.tsx                edit form
proxy.ts                              Edge proxy — auth gate + per-request CSP nonce
lib/
  csp.ts                              buildAdminCsp(nonce)
  route-helpers.ts                    appErrorStatus(AppError) → HTTP status
next.config.ts                        images.remotePatterns + static security headers
                                      (CSP comes from the proxy)
```

---

## Feature folders

```
features/
  auth/
    actions/sign-in.action.ts         signInAction(credentials, redirectTo?)
    components/login-form.tsx         LoginForm (TanStack Form v1 + Zod)
  playlists/
    schemas/playlist-form.schema.ts   Zod schema reused by create + edit
    actions/                          server actions (one per mutation)
      create-playlist.action.ts       form submit → playlistService.create → revalidateTag
      update-playlist.action.ts       form submit → playlistService.update → revalidateTag
      create-track.action.ts          called after R2 confirm; writes Track row
      reorder-tracks.action.ts        batch order update; optimistic-friendly
      toggle-publish.action.ts        publish/unpublish + revalidateTag
    components/
      playlists-table.tsx             TanStack Table v8; exports SerializedPlaylist
      playlist-form.tsx               shared create/edit form; renders categoryIds multi-select
      track-uploader.tsx              drag-drop UI inside edit page
      track-list.tsx                  dnd-kit sortable list of tracks
      publish-toggle.tsx              publish/unpublish toggle button
    hooks/
      use-track-upload.ts             presign → PUT (with progress + retry) → confirm
  categories/
    schemas/category-form.schema.ts   Zod schema reused by create + edit
    actions/
      create-category.action.ts       → revalidateTag(CATEGORIES)
      update-category.action.ts       → revalidateTag(CATEGORIES + PLAYLISTS_HOME)
      delete-category.action.ts       → revalidateTag(CATEGORIES + PLAYLISTS_HOME)
    components/
      categories-table.tsx            TanStack Table; delete button per row
      category-form.tsx               shared create/edit (cover image via MediaPicker)
```

### Pattern: never re-export from a `"use server"` file

Next 16 + Turbopack treats any non-action export from a `"use server"` file as making the **entire module** appear to have "no exports at all" — every importer breaks. So:

- Action files only export `async` server actions.
- Zod schemas and types live in `features/<x>/schemas/<resource>-form.schema.ts`.
- Importers reach the schema/types module directly. **Do not bounce through the action file.**

This burned us once on the playlist actions; see the fix in commit `577a6a9` and the gotcha in APP_CONTEXT.md.

### Pattern: optimistic updates

Track reorder uses dnd-kit + an optimistic cache update. The action `reorderTracks` writes the new order; the client island applies the reorder immediately in `onMutate` and rolls back in `onError`. Same pattern should be used for any future reorder/toggle action.

### Pattern: RSC → client Date serialization

Same as the web app: convert `Date` → ISO string before crossing the RSC boundary. The `SerializedPlaylist` type in `playlists-table.tsx` is the reference shape.

---

## Dev loop

```bash
pnpm dev --filter=admin          # just this app (port 3001)
pnpm --filter=admin typecheck
pnpm --filter=admin lint
pnpm --filter=admin test         # vitest run (RTL tests for forms + tables)
pnpm --filter=admin build        # next build (Turbopack)
```

E2E (`tests/e2e/admin.smoke.test.ts`) runs from the repo root:

```bash
pnpm test:e2e --project=admin
```

The smoke test signs in, creates a playlist, and uploads a track.

### Env vars

All required for the admin to function (the Mongo adapter + Credentials authorize need them at request time):

| Var | Required at | Why |
|---|---|---|
| `MONGODB_URI` | runtime | Auth.js Mongo adapter + every service call |
| `AUTH_SECRET` | runtime | JWT signing (≥ 32 chars) |
| `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`, `R2_ENDPOINT` | runtime | presigning + headObject |
| `R2_PUBLIC_BASE` | runtime + build | `images.remotePatterns` |
| `R2_MAX_UPLOAD_BYTES` | runtime (default 50 MiB) | upload size ceiling |
| `NEXT_PUBLIC_ADMIN_URL` | runtime | used by some redirects |
| `NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA` | optional | exposed by `/api/health` as `version` |

Bootstrap an admin user once:

```bash
pnpm seed:admin --email <you@example.com> --password <your-password>
# in production: add --force (and unset NODE_ENV=production after — or delete the script)
```

---

## Testing conventions

- **Vitest** for forms/tables — uses `@testing-library/jest-dom/vitest` (not bare import) and explicit `afterEach(cleanup)` in `vitest.setup.ts`. `vite-tsconfig-paths` is ESM-only and won't load here — paths are resolved by the `paths` field in `tsconfig.json`.
- **Server actions** are mocked at module level via `vi.mock("../actions/<x>.action")`.
- New form tests should cover at least: renders empty in create mode, populated in edit mode, validates required fields, surfaces server-error messages.

---

## Where to dig when…

| Question | Start here |
|---|---|
| "How does login work end-to-end?" | `features/auth/components/login-form.tsx` → `actions/sign-in.action.ts` → `packages/api/src/services/auth.service.ts` |
| "How does the upload retry on PUT failure?" | `features/playlists/hooks/use-track-upload.ts` |
| "How does dnd-kit reorder persist?" | `features/playlists/components/track-list.tsx` + `actions/reorder-tracks.action.ts` |
| "Why is `/login` inside the proxy matcher?" | `proxy.ts` — so the CSP wrapper applies to the login response. The auth gate no-ops for `/login`. |
| "What CSP do we actually send?" | `lib/csp.ts` + the proxy |
| "How is the category multi-select wired into the playlist form?" | `features/playlists/components/playlist-form.tsx` (the `categoryIds` field) — the RSC fetches `availableCategories` and passes them as props |
| "Why doesn't deleting a category leave orphan ids on playlists?" | `packages/api/src/services/category.service.ts` `deleteCategory` calls `pullCategoryFromPlaylists` then `revalidateTag` on both `CATEGORIES` and `PLAYLISTS_HOME` |

---

## Contributing changes here

Follow [`CONTRIBUTING.md`](../../CONTRIBUTING.md) for branches + commits + PRs. The boundary rules for this app specifically:

- **No `mongoose` imports.** Only call services from `@repo/api/services`.
- **Every mutation calls a service.** Server actions are thin: validate input, call the service, return `{ error }` or `redirect`. Business rules live in `packages/api/services/*`.
- **Every mutating service calls `requireSession(['admin'])`** — even when the route handler already enforced it. Defense in depth.
- **Every public-affecting mutation calls `revalidateTag`** — use constants from `packages/api/src/cache/tags.ts` (`PLAYLISTS_HOME`, `CATEGORIES`). Item-level tags (`playlist:<slug>`) are inline because they're parameterised.
- **No re-exports from `"use server"` files.** Read the gotcha above.
- **No raw `process.env`** outside the documented exceptions (`next.config.ts`, `app/api/health/route.ts`). Use `@repo/config/env`.
- **A11y is a gate**: forms must use the `FormField` pattern from `@repo/ui/patterns/form-field`, all inputs need labels, all interactive elements need visible focus rings.
