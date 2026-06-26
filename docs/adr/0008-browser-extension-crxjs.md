# ADR 0008: Build the Nour browser extension with CRXJS + Vite (MV3)

- Status: Accepted
- Date: 2026-06-25

## Context

The Nour Platform has a public web app, an admin CMS, and a native Expo mobile app. Desktop users lack reliable closed-app azan — Chromium removed Notification Triggers (which fired persistent notifications), and Web Push remains future work. Mobile reliably delivers azan via `expo-notifications` and local audio. Desktop has no equivalent.

A Manifest V3 browser extension fills this gap. Its background service worker + `chrome.alarms` + `chrome.notifications` fire the adhan reliably with all tabs/windows closed. An offscreen document (Chrome-only) plays audio with zero visible UI. On Firefox, a managed player tab provides audio without visible windows (the offscreen API is absent on Firefox).

The extension reuses the platform's proven architecture: `@repo/shared-core` provides prayer-times logic (pure, framework-agnostic), the storage layer mirrors web/mobile key shapes (`nour.prayer.location`, etc.), and the same notification/audio pattern as the web app scales to background reliability.

## Options considered

1. **Web Push API.** Server-driven, but:
   - Requires a full backend push infrastructure (service + credentials + web client libraries).
   - Push cannot fire while the device sleeps; the OS may throttle delivery.
   - Adds server dependency; the extension is fully device-local by design.
   Rejected.

2. **Notification Triggers API (Chrome experimental, deprecated).** Was Chrome's answer to this problem; Google removed it after realizing it enabled spam. Rejected.

3. **Browser extension (MV3) with CRXJS + Vite — chosen.** Deterministic local scheduling via `chrome.alarms` (≥1 min granularity, fine for azan), full control over notification firing, and a hidden offscreen player so the adhan fires with zero UI. Cross-browser via `webextension-polyfill`. Scales to a new-tab dashboard and audio-while-browsing in Phase 2+3.

## Decision

Build a **separate extension** at `apps/extension` with:

- **Build system:** CRXJS v2 (`@crxjs/vite-plugin@^2.0.0-beta.33`) running Vite. CRXJS generates a valid MV3 manifest, bundles per-entry-point, and handles cross-browser manifests in a later phase.
- **Browser compatibility layer:** `webextension-polyfill` so code calls `browser.*` instead of `chrome.*`, enabling a single codebase to run on Chrome and Firefox without conditional imports.
- **Framework:** React (reuses UI components from `packages/ui` via Tailwind tokens).
- **Storage:** `chrome.storage.local` (persists across SW restart; wrapped with Zod validation in `src/lib/storage.ts`).
- **Scheduling:** `chrome.alarms` for the 1-min heartbeat + precise per-prayer alarms (no `setTimeout` — the SW is ephemeral).
- **Audio (Phase 1, Chrome):** Offscreen document with a single `<audio>` element, loaded at playback time, closed after adhan ends.
- **Audio (Phase 1, Firefox):** Managed extension player tab (offscreen API absent on Firefox).
- **Shared code:** Reuse `@repo/shared-core` prayer-times predicates + schemas; reuse Tailwind tokens from `packages/ui`.

### Dependency list (all new, covered by this ADR — no further per-dependency ADRs needed)

| Concern | Package | Note |
|---|---|---|
| Build | `@crxjs/vite-plugin@^2.0.0-beta.33` | MV3 scaffold, manifest generation, entry-point bundling. |
| Browser compat | `webextension-polyfill@^0.11.0` | Polyfill `chrome.*` to `browser.*`; enable single codebase for Chrome + Firefox. |
| Styling | `tailwindcss@^4.0.0`, `postcss` | Reuse brand tokens from `@repo/ui/styles/tokens.css`. |
| Storage validation | `zod@^3.23.8` | Validate `chrome.storage.local` reads against the schema. |

## Consequences

- **Dependency:** CRXJS is in beta but stable for MV3 production. It generates `.vite/timestamp-*.mjs` jiti artifacts during build; ESLint must ignore these files to avoid race conditions.
- **Manifest / per-target branching:** Chrome gets `background.service_worker` + `offscreen` permission. Firefox gets `background.scripts` (event-page model) + browser-specific settings. One Vite build emits both manifests via the manifest config.
- **Entry points:** `src/background/index.ts` (always), `src/options/index.html` (options page), `src/newtab/index.html` (Phase 2), `src/popup/index.html` (Phase 2), `src/offscreen/index.html` (Chrome-only, non-manifest, bundled via `build.rollupOptions.input`).
- **No `packages/api` in the extension.** The extension never imports from `packages/api/db` or `packages/api/repositories` — only from `@repo/shared-core` (for schemas + predicates) and calls the public `/api/v1` surface over HTTP.
- **Audio assets:** Adhan MP3s are fetched from the deployed site and cached into the Cache API on install. Offline playback prefers the cache, falls back to the live URL.
- **Device-local only:** No accounts, no sync. All state lives in `chrome.storage.local`. The extension talks to the public `/api/v1/*` read-only API.
- **Turbo pipeline:** `apps/extension` plugs into lint/typecheck/test/build like any other app. `pnpm turbo run build` produces `dist/` with Chrome MV3 build + (later) Firefox artifact.

## Alternative futures

- **Phase 2+:** New-tab dashboard (`new_tab` override), toolbar popup, Audio while browsing (reuse offscreen player).
- **Phase F (deferred):** Firefox port — Firefox gets its own manifest in `dist/firefox`, managed player tab for audio. Code compat via `webextension-polyfill` enables the same JS to run on both.
- **Store listings:** Later work; both Chrome Web Store and Firefox Add-ons require review + security audit (covered in a later ADR).
