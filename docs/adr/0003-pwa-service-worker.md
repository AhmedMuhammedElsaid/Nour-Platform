# ADR 0003 — Hand-rolled service worker for PWA / offline

- Status: Accepted
- Date: 2026-05-29
- Deciders: Ahmed (solo)
- Scope: `apps/web` (public site only; admin stays online-only)

## Context

The web app should be an installable PWA that works offline: an offline app
shell, and "cache-played" audio (tracks the user has already streamed replay
offline) — without an explicit download manager and without user accounts
(device-local only).

The app already runs a strict, **nonce-based CSP** emitted per-request from
`proxy.ts`, and every page is `dynamic = "force-dynamic"` (the per-request
nonce is incompatible with statically prerendered HTML). Any offline solution
must not fight that.

Candidate libraries: `next-pwa` (`@ducanh2912/next-pwa`) and `serwist`. Both
add a build step that injects a generated precache manifest and a Workbox
runtime. CLAUDE.md §5 requires an ADR for any new dependency.

## Decision

Use a **hand-rolled service worker** (`apps/web/public/sw.js`, plain JS, no
build step), registered client-side in production only. No new dependency.

Rationale:

1. **CSP fit.** Build-time precaching of HTML conflicts with our per-request
   nonce/`force-dynamic` model. We instead cache navigations at **runtime**
   (network-first), storing the full `Response` — including its own CSP header
   — so an offline-served page is self-consistent with its own nonce. A Workbox
   precache manifest buys us nothing here and adds moving parts.
2. **Control.** The "cache-played audio" requirement needs custom HTTP **Range**
   handling (serve `206 Partial Content` slices from a cached full body). That's
   bespoke logic regardless of library, so the library mostly adds weight.
3. **No dependency / lockfile churn.** Keeps the Vercel build cache stable
   (CLAUDE.md §12) and the bundle lean.

### Strategies (see `sw.js` for detail)

- Navigations (HTML): network-first → runtime cache → `offline.html`.
- `/_next/static/*`: cache-first (immutable, content-hashed).
- Other same-origin assets: stale-while-revalidate.
- R2 audio: cache-first with Range support.
- `/api/*`: never handled (network-only).

## Consequences / follow-ups

- **R2 CORS required for offline audio.** Reading a cross-origin body to slice
  ranges needs a `mode:"cors"` fetch, so the R2 bucket must send CORS headers
  for the web origin (allow `GET`, `Range`; expose `Content-Range`,
  `Content-Length`, `Accept-Ranges`). Without it the SW transparently falls
  back to streaming (online-only audio). Add this to the deploy runbook.
- **Icons.** Ships an SVG app icon (`/icons/icon.svg`, `sizes:"any"`), which
  Chromium accepts for install. iOS home-screen and richer maskable rendering
  want raster PNGs (192/512/apple-touch) — a follow-up design task.
- **CSP additions.** `worker-src 'self'`, `manifest-src 'self'`, and the R2
  origin added to `connect-src` (the SW fetch is governed by `connect-src`).
- Updating to ISR/static caching later would let us revisit precaching, but
  also requires a different CSP strategy (subresource hashes) — out of scope.
