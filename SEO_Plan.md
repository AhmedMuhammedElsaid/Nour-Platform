# SEO Hardening for `apps/web`

> Review document — SEO audit findings + implementation plan for the public web app.
> Status: **awaiting review** (not yet implemented).

## Context

The public web app has a **strong a11y/semantic foundation** (landmarks, skip link, correct h1/h2 hierarchy, ARIA on transport controls, `lang="en"`) but is **missing almost every discoverability and social-sharing signal**. Audit findings:

| Area | Current state |
|---|---|
| `metadataBase` | ❌ Missing — OG/canonical URLs can't resolve to absolute |
| Open Graph / Twitter tags | ❌ None on any page |
| Canonical URLs | ❌ None |
| `robots.txt` | ❌ None |
| `sitemap.xml` | ❌ None |
| Favicon / icons / web manifest | ❌ None (no `public/` dir, no file-convention assets) |
| JSON-LD structured data | ❌ None |
| og:image | ❌ None |

Goal: a **full SEO pass** — absolute-URL metadata, Open Graph + Twitter cards, canonical URLs, `robots.ts`, dynamic `sitemap.ts`, favicon/icon/manifest, and JSON-LD structured data. Decisions confirmed with user: **single static default OG image** (user supplies the asset); **defer i18n/Arabic** (stay English-only, flag hreflang as future work).

### Key constraints discovered (must respect)
1. **Base URL exists**: `env.NEXT_PUBLIC_WEB_URL` (`packages/config/src/env.ts:42`, default `http://localhost:3000`). Import via `@repo/config` (never `process.env` directly — CLAUDE.md §5). Safe to import the env barrel in `layout.tsx`/`sitemap.ts` because the build sets dummy `MONGODB_URI`+`AUTH_SECRET` (CI note). Do **not** import it in `next.config.ts`/`proxy.ts` (those run where env isn't validated — see existing comments there).
2. **Strict nonce-CSP**: `script-src 'self' 'nonce-… ' 'strict-dynamic'`, **no `'unsafe-inline'`** (`apps/web/lib/csp.ts`). Inline `<script type="application/ld+json">` blocks are subject to script-src and will be dropped without a nonce. The proxy forwards the per-request nonce as the **`x-nonce` request header** (`apps/web/proxy.ts:28`) — read it via `headers()` in the RSC and pass `nonce={…}` to every JSON-LD `<script>`.
3. **Both pages are `force-dynamic`** (per-request nonce + no Atlas at build). Any new route handler that touches Mongo (`sitemap.ts`) must also `export const dynamic = "force-dynamic"` or the Vercel build fails. `robots.ts` touches no DB → can stay static.
4. **`PlaylistCard` renders no cover image** (APP_CONTEXT.md is stale on this — it claims `next/image`; the component is text-only). So there is no per-playlist art to use as og:image → the single static default is the right call.

---

## Changes

### 1. Absolute-URL base + global metadata — `apps/web/app/layout.tsx`
- Import `env` from `@repo/config`.
- Expand the `metadata` export:
  - `metadataBase: new URL(env.NEXT_PUBLIC_WEB_URL)`
  - `title: { default: "Nour — Islamic Audio Platform", template: "%s — Nour" }`
  - `description`, `applicationName: "Nour"`
  - `openGraph`: `{ type: "website", siteName: "Nour", locale: "en_US", url: "/" }` (title/description inherit)
  - `twitter`: `{ card: "summary_large_image" }`
  - `robots`: `{ index: true, follow: true }`
  - `alternates: { canonical: "/" }`
  - (icons + manifest are wired by file conventions below, not hand-listed here)
- Make `RootLayout` `async`; read `const nonce = (await headers()).get("x-nonce") ?? undefined;` and render site-wide JSON-LD (step 6). Reading `headers()` is fine — the route is already dynamic via the proxy.

### 2. Per-page metadata
- **Homepage `apps/web/app/page.tsx`**: replace the bare `metadata` with `openGraph`/`twitter` text + `alternates.canonical: "/"`. Title can stay (uses template).
- **Playlist detail `apps/web/app/playlists/[slug]/page.tsx`** `generateMetadata`: add to the published branch — `openGraph: { type: "article", url: \`/playlists/${slug}\`, title, description }`, `twitter: { card: "summary_large_image" }`, `alternates: { canonical: \`/playlists/${slug}\` }`. Keep the existing `"Not Found — Nour"` branch but add `robots: { index: false }` to it so unpublished/unknown slugs aren't indexed.

### 3. `robots.ts` — `apps/web/app/robots.ts`
- `MetadataRoute.Robots`: allow all, `disallow: ["/api/"]`, `sitemap: \`${env.NEXT_PUBLIC_WEB_URL}/sitemap.xml\``, `host`.

### 4. `sitemap.ts` — `apps/web/app/sitemap.ts`
- `export const dynamic = "force-dynamic"` (DB at build time would fail).
- Call `getPublishedPlaylists()` and `listCategories()` (services already imported elsewhere in this app — `@repo/api/services/playlist` / `@repo/api/services/category`).
- Emit: homepage `/`, one `/?category=<slug>` per category, and `/playlists/<slug>` per published playlist with `lastModified: updatedAt`. Build absolute URLs from `env.NEXT_PUBLIC_WEB_URL`.
- Wrap the service calls in try/catch returning at least the homepage entry, so a transient DB hiccup never 500s the sitemap.

### 5. Icons + web manifest (file conventions)
- `apps/web/app/manifest.ts` → `MetadataRoute.Manifest`: name "Nour", short_name, `start_url: "/"`, `display: "standalone"`, theme/background colors pulled from the design tokens' hex equivalents, `icons` array referencing the icon files below.
- **Binary assets the user must supply/approve** (place at these exact paths — Next auto-wires the tags):
  - `apps/web/app/favicon.ico`
  - `apps/web/app/icon.png` (512×512) — also used by the manifest
  - `apps/web/app/apple-icon.png` (180×180)
  - `apps/web/app/opengraph-image.png` (1200×630) + sibling `opengraph-image.alt.txt` (or `alt` export)
  - `apps/web/app/twitter-image.png` (1200×630) — may be a copy of the OG image
- A single root-level `opengraph-image.png` applies to **all** routes automatically (incl. playlist pages) once `metadataBase` is set — no per-route image work needed.

### 6. Structured data (JSON-LD) — new reusable component + per-page payloads
- New `apps/web/features/seo/components/json-ld.tsx`: a tiny server component `JsonLd({ data, nonce })` rendering `<script type="application/ld+json" nonce={nonce} dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }} />`. **Nonce is mandatory** (constraint #2).
- New `apps/web/features/seo/structured-data.ts`: pure builder functions returning plain objects:
  - `buildOrganizationLd()` + `buildWebSiteLd()` → rendered in `layout.tsx` (site-wide).
  - `buildPlaylistLd(playlist, tracks, baseUrl)` → `MusicPlaylist` with `track: MusicRecording[]` + `buildBreadcrumbLd(...)` → rendered in the playlist page (pass the page's `x-nonce`).
- Each consuming RSC reads its own nonce from `headers()` and passes it down.

### 7. Docs + env
- `.env.example`: `NEXT_PUBLIC_WEB_URL` already present — add a comment that **production must set the real canonical origin** (sitemap/canonical/OG all derive from it).
- Update `APP_CONTEXT.md`: (a) add an SEO row to the waves table / file-locations (`app/robots.ts`, `app/sitemap.ts`, `app/manifest.ts`, `features/seo/`), (b) **fix the stale `playlist-card.tsx → cover (next/image)` line** — it's text-only, and (c) note the JSON-LD-needs-nonce gotcha. Per the user's commit convention, this goes in the **same commit** as the code.

---

## Tests (CLAUDE.md §9 — new route handlers need tests)
- `apps/web` RTL/unit: `sitemap.test.ts` (mock the two services → assert homepage + playlist + category entries, absolute URLs, dynamic export) and `robots.test.ts` (allow-all, `/api/` disallowed, sitemap URL present).
- Unit test for `structured-data.ts` builders (valid `@context`/`@type`, track count matches).
- Quick RTL assertion that `JsonLd` renders a `<script type="application/ld+json">` carrying the passed nonce.
- Keep the existing `tests/e2e/web.smoke.test.ts` green.

## Verification
1. `pnpm --filter web lint && pnpm --filter web typecheck` and `pnpm turbo run test` — all green.
2. `pnpm --filter web build` succeeds (confirms `sitemap.ts` dynamic export prevents the no-Atlas build failure).
3. `pnpm --filter web dev`, then with the app seeded:
   - `curl localhost:3000/robots.txt` and `/sitemap.xml` return expected content.
   - View-source on `/` and `/playlists/<slug>`: confirm `<meta property="og:*">`, `twitter:card`, `<link rel="canonical">`, and **`<script type="application/ld+json" nonce="…">`** present, and that the nonce matches the CSP header (no console CSP violation for the JSON-LD block).
4. Run Lighthouse SEO + a11y on `/` and a playlist page — target SEO 100, a11y/perf >95 (DoD §11).
5. Validate one playlist page's JSON-LD in Google's Rich Results Test (or schema.org validator).

## Out of scope (flagged for later)
- i18n / Arabic locale routing + `hreflang` alternates + RTL `dir` + Arabic font subset — deferred per user. Worth a Phase 2 ticket; the `lang="en"` hardcode and Latin-only fonts are the seams to revisit.
- Dynamic per-playlist generated OG images (`ImageResponse`) — user chose a single static default for now.
