# `apps/web` — Public Site

The visitor-facing Next.js app. Browse playlists, filter by category, open a playlist, click a track — the player docks at the bottom and survives navigation across the site.

- **Port**: `:3000`
- **Vercel project**: built with `pnpm turbo run build --filter=web...` (see `vercel.json`)
- **Runtime**: Node for routes, Edge for the proxy
- **Public**: no auth gate; everything anonymous

See the [root README](../../README.md) for the monorepo overview and the [admin README](../admin/README.md) for the CMS side.

---

## What it does

- **`/`** — Homepage grid. Lists all published playlists. Renders a `CategoryFilterBar` at the top; clicking a pill writes `?category=<slug>` and re-fetches with that filter. Unknown slugs show an empty state, not a 404.
- **`/playlists/[slug]`** — Playlist detail. Title, description, ordered track list. Clicking a row loads the queue into the player and starts playback. Includes `generateMetadata` for OG previews.
- **`/api/health`** — `GET → { ok, version, time }`. UptimeRobot target. Reads the git SHA from `process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA` directly (this is the documented CLAUDE.md §5 exception — see APP_CONTEXT.md gotchas).

Both `/` and `/playlists/[slug]` export `dynamic = "force-dynamic"` — the per-request CSP nonce can't coexist with cached static HTML.

---

## The sticky audio player

The interesting bit. The player is one `<audio>` element mounted in the root layout via `<PlayerProvider>` (from `@repo/ui/blocks/player-context`). State (current track, queue, position) lives in React context. Because the element is in the layout and not in any page, **navigation never tears it down** — the song keeps playing as the visitor browses.

Surface:

- Play / pause / prev / next buttons, time + scrub slider
- Space toggles play/pause; ← / → seek ±10s (handlers bail when an editable element has focus, so form input isn't hijacked)
- URL hash mirrors the current track id for shareable deep links
- Auto-advances to the next track on `ended`

Files: `packages/ui/src/blocks/audio-player/audio-player.tsx` + `player-context.tsx`. The web app just renders `<PlayerProvider>` in `app/layout.tsx` and `<AudioPlayer />` at the end of the same layout; the `TrackListPlayer` client island on the detail page calls `player.loadQueue(tracks, index)` on row click.

---

## Routes

```
app/
  layout.tsx                  RootLayout — fonts, <PlayerProvider>, header/footer,
                              skip-to-main link, <AudioPlayer /> at bottom
  page.tsx                    homepage (RSC, force-dynamic)
  playlists/[slug]/page.tsx   playlist detail (RSC, force-dynamic, generateMetadata)
  api/health/route.ts         health endpoint
  globals.css                 Tailwind + token reset
proxy.ts                      Edge proxy — generates per-request CSP nonce
lib/csp.ts                    buildWebCsp(nonce, r2Hostname)
next.config.ts                images.remotePatterns (R2 host) + static security headers
                              (CSP comes from the proxy, not here — don't add it back)
```

---

## Feature folders

Convention from CLAUDE.md §3: code is grouped by **feature**, not by file type.

```
features/
  layout/components/
    site-header.tsx                header (logo + skip-link target)
    site-footer.tsx                footer
  playlists/
    types.ts                       SerializedPlaylist, SerializedPlayableTrack DTOs
    components/
      playlist-card.tsx            cover (next/image) + title + track count
      track-row.tsx                row UI used inside TrackListPlayer
      track-list-player.tsx        client island: maps rows → player.loadQueue
  categories/
    components/
      category-filter-bar.tsx      client island: pills read/write ?category via
                                   useSearchParams + router.replace
  player/components/
    audio-player.test.tsx          RTL tests for the player block
```

### Pattern: slug → ObjectId resolution lives in the RSC

The playlist service intentionally takes `categoryId: string` (ObjectId), not a slug, because validating + casting belongs at the request boundary. The homepage RSC calls `listCategories()` first, finds the matching `{ id }` by slug, then calls `getPublishedPlaylists({ categoryId })`. Phase-2 verticals that filter by slug should follow this same pattern (see APP_CONTEXT.md gotchas).

### Pattern: RSC ↔ client island serialization

`Date` objects cannot cross the RSC boundary. Pages map them to ISO strings before passing as props:

```ts
type SerializedPlaylist = Omit<Playlist, "createdAt" | "updatedAt"> & {
  createdAt: string;
  updatedAt: string;
};
```

`types.ts` defines `SerializedPlaylist` and `SerializedPlayableTrack`; both pages use them.

---

## Security headers

The proxy emits a per-request CSP nonce. The directive (`lib/csp.ts`) is roughly:

```
default-src 'self';
script-src 'self' 'nonce-<…>' 'strict-dynamic' 'unsafe-inline';
style-src  'self' 'unsafe-inline';
img-src    'self' data: https://<r2-host>;
font-src   'self';
media-src  'self' https://<r2-host>;
connect-src 'self';
frame-ancestors 'none';
base-uri 'self';
form-action 'self';
```

- **`'unsafe-inline'` on `script-src`** is the CSP1/2 fallback that modern browsers ignore in the presence of `'strict-dynamic'`. The active rule is the nonce.
- **`'unsafe-inline'` on `style-src`** is intentional: React 19 + Next.js still emit inline `<style>` payloads for CSS-in-JS / font-loader output. No user-generated HTML rendered server-side in the MVP, so this is not an exploitable surface.
- Static headers (HSTS, X-Frame-Options DENY, Referrer-Policy, X-Content-Type-Options, Permissions-Policy) live in `next.config.ts`.

The proxy matcher excludes `_next/static`, `_next/image`, and `favicon.ico` so the proxy cost stays off the hot static-asset path.

---

## Dev loop

```bash
pnpm dev --filter=web        # just this app (port 3000)
pnpm --filter=web typecheck
pnpm --filter=web lint
pnpm --filter=web test       # vitest run (RTL tests for the player + filter bar)
pnpm --filter=web build      # next build (Turbopack)
```

E2E (`tests/e2e/web.smoke.test.ts`) runs from the repo root:

```bash
pnpm test:e2e --project=web
```

The smoke test asserts the homepage loads, the first track plays, and a direct playlist link works.

### Env vars

The web app reads these (via `@repo/config/env` for runtime code, direct `process.env` for build-time-only metadata):

| Var | Required at | Why |
|---|---|---|
| `MONGODB_URI` | runtime | services fetch playlists / categories |
| `AUTH_SECRET` | runtime | imported transitively via `@repo/api` |
| `R2_PUBLIC_BASE` | runtime + build | media URLs + `images.remotePatterns` |
| `NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA` | optional | exposed by `/api/health` as `version` |

---

## Where to dig when…

| Question | Start here |
|---|---|
| "How does the player resume across navigation?" | `packages/ui/src/blocks/audio-player/player-context.tsx` |
| "Why is the homepage `force-dynamic`?" | `app/page.tsx` top comment + APP_CONTEXT.md CSP gotcha |
| "How does the category filter wire up?" | `features/categories/components/category-filter-bar.tsx` + `app/page.tsx` |
| "What CSP do we actually send?" | `lib/csp.ts` + the proxy |
| "How is the deep-link hash kept in sync with the current track?" | `features/playlists/components/track-list-player.tsx` |

---

## Contributing changes here

Follow [`CONTRIBUTING.md`](../../CONTRIBUTING.md) for branches + commits + PRs. The boundary rule for this app specifically:

- **No `mongoose` imports.** Only call services from `@repo/api/services`.
- **No raw `process.env`** outside the documented exceptions (`next.config.ts`, `proxy.ts`, `app/api/health/route.ts`). Use `@repo/config/env`.
- **No new client islands without a state reason.** Default to RSC. Add `"use client"` only for refs, effects, event handlers, or browser-only APIs.
- **A11y is a gate**: skip-link, `<main>`, semantic landmarks, visible focus rings — see Wave 4.6 in `PLAN.md`. Run `pnpm test:e2e` and a manual keyboard pass before requesting review on UI changes.
