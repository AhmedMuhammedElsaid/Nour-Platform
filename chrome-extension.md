# Nour Platform — Chrome Extension (Firefox deferred)

> Implementation guide. Read `APP_CONTEXT.md` first (repo convention); this doc assumes it.
> **Focus = Chrome (MV3).** Firefox is a clean, additive phase at the end (§7.4), not the main path.
> Each phase/step is tagged with the model to use per **CLAUDE.md §15**: **[Opus]** locks new
> patterns / complex state machines, **[Sonnet]** clones an established pattern, **[Haiku]** docs/config.

---

## 1. Context — why

`APP_CONTEXT.md`: Chromium removed Notification Triggers + the Web Push server is deferred, so
"reliable closed-app azan is the mobile app's job." Desktop has no equivalent. A Chrome MV3
extension fills it: background worker + `alarms` + `notifications` fire the adhan with every tab
closed, and an **offscreen document** plays the sound with zero visible UI. On that engine we add a
**new-tab dashboard** and **audio-while-browsing**. The extension does what the web app cannot.

## 2. Goals (three features, one engine)

1. **Desktop azan** — local prayer-time compute → fire adhan + notification at each enabled prayer,
   all tabs closed. Includes azkar al-sabah/al-masaa reminders.
2. **New-tab dashboard** — countdown + timetable + sun-arc + verse/dhikr of the day + continue-listening.
3. **Audio while browsing** — playlists/Quran in the background, controlled from popup/new-tab.

## 3. Locked decisions

| | |
|---|---|
| Location | `apps/extension` (monorepo) |
| Stack | React + Vite + **CRXJS**, **Chrome MV3**, Tailwind |
| Shared logic | Reuse **`@repo/shared-core`** (prayer compute, format, schemas) |
| Target | **Chrome** (Edge runs the same build). **Firefox deferred** to §7.4 |
| Accounts | **Device-local only** — content via public `/api/v1/*`; prefs in `chrome.storage.local` |
| Browser API | Use `chrome.*` directly in Phase 1–3 (no polyfill); add `webextension-polyfill` only in the Firefox phase |

## 4. Research facts (established — do NOT re-explore; this section exists to save tokens)

- **CORS is a non-issue.** MV3 extension fetches with `host_permissions` are privileged and bypass
  CORS. **No server change.**
- **`@repo/shared-core` is pure & importable** (no DOM/React). Already exports:
  - `compute`: `computePrayerTimes`, `getUpcomingPrayer`, `getNextPrayer`, `getArcPosition`, `getDayProgress`
  - `format`: `formatClock`, `formatCountdown`, `hijriDate`, `gregorianDate`
  - `sun-arc`: `arcPath`, `arcPoint`, `tForFraction`
  - `schemas/prayer-times`: `AdhanSettings`, `AzkarReminderSettings`, `PrayerLocation`,
    `PrayerPreferences`, `CalculationMethodId`, `MadhabId`, `DEFAULT_LOCATION` (Cairo),
    `DEFAULT_METHOD` ("Egyptian"), `DEFAULT_MADHAB` ("standard"), `ADHAN_PRAYER_KEYS`
  - `quran/audio-url`: Quran ayah URL helper
- **Pure scheduler predicates live in `apps/web` today** → promote to shared-core (no DOM):
  `apps/web/features/prayer-times/lib/adhan-schedule.ts` (`nextAdhanEvent`, `isAdhanEventStale`,
  `recentlyMissedAdhan`) and `azkar-reminder-schedule.ts` (`nextAzkarReminderEvent`,
  `isAzkarReminderEventStale`, `recentlyMissedAzkarReminder`). `fired-event-store.ts` stays in web
  (uses `localStorage`); extension gets a `chrome.storage` port.
- **API base:** prod `https://nour-platform-web.vercel.app`, dev `http://localhost:3000`. Routes
  `/api/v1/*`, public GET, 60s cache. **Join by string concat** (`` `${base}${path}` ``) — `new URL()`
  drops `/api/v1`.
- **Adhan assets:** `apps/web/public/audio/adhan.mp3` (4.9 MB), `adhan-fajr.mp3` (8.1 MB), served at
  `/audio/*.mp3`.
- **No `/api/v1/prayer-times`** — computed locally.
- **Storage keys (mirror exactly):** `nour.prayer.location` `{lat,lng,label,cityId?}` ·
  `nour.prayer.prefs` `{method,madhab}` · `nour.prayer.adhan` `{enabled,perPrayer{...},volume}` ·
  `nour.azkar.reminder` `{enabled,offsetMinutes,sabah{ar,en},masaa{ar,en}}` · `nour.player.recent`
  (MRU ≤20) · `nour.player.positions` `{[trackId]:{t}}`.
- **`/api/v1` shapes:** `playlists?category=&sort=` (array) · `playlists/[slug]?locale=`
  (`{playlist,tracks[]}`, tracks carry audio URLs) · `categories` · `adhkar` · `adhkar/[slug]` ·
  `quran/surahs` · `quran/surah/[n]?locale=&translation=&reciter=` (ayahs carry `audioUrl`) ·
  `quran/editions` · `quran/reciters` · `quran/tafsir?ayah=&locale=&edition=`.

## 5. Architecture (Chrome)

```
apps/extension/
  manifest.config.ts   Chrome MV3 manifest
  vite.config.ts       CRXJS → dist/
  src/
    background/         scheduler (chrome.alarms) · notifications · offscreen orchestration
    offscreen/          invisible audio doc (adhan + Phase 3 player)
    options/            settings (location · method/madhab · per-prayer · volume · azkar)
    newtab/  popup/     [Phase 2]
    lib/
      api.ts            /api/v1 client (string-concat join)
      storage.ts        chrome.storage.local wrapper; key shapes mirror web
      audio-router.ts   play(url,{volume}) → offscreen (Chrome). Firefox branch added in §7.4
      fired-claim.ts    dedup across SW restarts (chrome.storage port of fired-event-store)
  deps: @repo/shared-core · react · tailwind · vite · @crxjs/vite-plugin
```

**Scheduling engine.** MV3 workers are ephemeral → use **`chrome.alarms`** (≈1-min granularity,
fine for azan), never `setTimeout` for long waits. On each wake: read settings →
`computePrayerTimes` → `nextAdhanEvent` → alarm at that instant + a **1-min safety alarm** so a
killed worker re-arms. On fire: `isAdhanEventStale` (drop post-sleep late fires) →
`recentlyMissedAdhan` (catch-up) → `claimFiredEvent` (dedup) → notification + `audio-router.play` →
re-arm. Mirror for azkar reminders.

**Audio asset.** ~13 MB → don't bundle. On adhan **enable**, fetch `${SITE}/audio/*.mp3` via
`host_permissions` into the **Cache API** (mirrors web SW `nour:cache-adhan`). Bundle one short
trimmed fallback clip for offline. Fajr uses `adhan-fajr.mp3`, others `adhan.mp3`.

---

## 6. Phase 1 — Azan engine  ·  default **[Opus]** (first-of-kind foundation + state machine)

Ships reliable desktop azan + azkar reminders. Per-step model in brackets.

1. **[Sonnet] Promote schedulers to shared-core.** Create
   `packages/shared-core/src/prayer-times/schedule.ts`; move the 6 predicates from the two web
   `lib/` files verbatim (already pure). Add `"./prayer-times/schedule"` to shared-core
   `package.json` exports. Replace the web files with thin re-exports (no behavior change). Move the
   existing web unit tests alongside `schedule.ts`. Do **not** move `fired-event-store.ts`.
   *(Mechanical move + existing tests → Sonnet; escalate to Opus only if the contract churns.)*
2. **[Opus] Scaffold `apps/extension`.** `package.json` (`private`), `tsconfig.json` (extends
   `@repo/tsconfig`), **`eslint.config.mjs`** (CI requires one per package), `test` =
   `vitest run --passWithNoTests`. Add deps (react, react-dom, vite, @crxjs/vite-plugin,
   @vitejs/plugin-react, tailwindcss, vitest). Add to workspace globs / `turbo.json`. Pin React via
   root **`pnpm.overrides`** (mismatch breaks typecheck — see monorepo-CI memory).
   *(Package skeleton + monorepo config = §15.1 Opus.)*
3. **[Opus] Chrome manifest + Vite/CRXJS build.** MV3; permissions
   `["alarms","notifications","storage","offscreen"]`; `host_permissions`
   `https://nour-platform-web.vercel.app/*` (+ R2 audio host; + `https://everyayah.com/*` for P3);
   `options_ui`; later `chrome_url_overrides.newtab` + `action`. API base URL via Vite `define`
   (no `process.env` outside `@repo/config`). Confirm `pnpm --filter <ext> build` emits `dist/`.
   *(First build config locks the pattern → Opus.)*
4. **[Sonnet] `lib/storage.ts`.** Typed get/set over `chrome.storage.local` for the §4 keys; seed
   shared-core defaults on first run; validate reads with shared-core zod schemas, fall back on fail.
5. **[Opus] `fired-claim.ts`.** Port `claimFiredEvent(key, iso)` to `chrome.storage.local`
   (single-flight / last-writer-wins; keys `nour.prayer.adhan.fired`, `nour.azkar.reminder.fired`).
   Unit-test. *(Race-sensitive dedup → Opus.)*
6. **[Opus] `background/` scheduler.** On install/startup/settings-change/alarm: compute → arm
   precise alarm + 1-min safety alarm. Alarm handler: `recentlyMissedAdhan` → `isAdhanEventStale`
   guard → `claimFiredEvent` → `chrome.notifications` (prayer + time) → `audio-router.play(url,
   {volume})` → re-arm. Mirror for azkar (`nextAzkarReminderEvent`). `notifications.onClicked` →
   focus/open new-tab (P2) or the adhkar reader. *(Core state machine + edge cases → Opus.)*
7. **[Opus] `audio-router.ts` + `offscreen/`.** `play(url,{volume})`/`stop()`. Chrome: ensure an
   offscreen doc (`chrome.offscreen.createDocument({reason:"AUDIO_PLAYBACK"})`), postMessage url +
   volume; offscreen owns the `<audio>` and reports `ended` so the bg can close it. Leave a
   documented Firefox branch stub. *(Offscreen lifecycle is fiddly + first-of-kind → Opus.)*
8. **[Sonnet] Options page (`options/`).** React: location picker (city search + geolocation),
   method/madhab, master + per-prayer adhan toggles, volume, azkar toggle + offset. Persist via
   `storage.ts`; message bg to re-arm on change. Reuse `packages/ui` Tailwind tokens.
9. **[Sonnet] Adhan asset caching.** On enable, fetch `${SITE}/audio/adhan.mp3` + `adhan-fajr.mp3`
   into the Cache API; at fire time prefer cached blob, fall back to bundled clip.
10. **[Haiku] ADR + docs.** `docs/adr/000N-extension-crxjs.md` for the new deps; update
    `APP_CONTEXT.md` in the same commit that ships code.
11. **[Opus only if debugging] Verify** — §8 (mostly manual load-unpacked).

---

## 7. Later phases (each = its own brainstorm → plan → implement)

### 7.1 Phase 2 — New-tab dashboard  ·  default **[Sonnet]**
`new_tab` override + toolbar popup: countdown + timetable + sun-arc (reuse `arcPath`/`arcPoint`) +
verse/dhikr of the day + continue-listening. Content via `lib/api.ts`.
- **[Opus]** `lib/api.ts` (first-of-kind data layer for the extension — locks the fetch pattern).
- **[Sonnet]** dashboard + popup components on existing `packages/ui` primitives.

### 7.2 Phase 3 — Audio while browsing  ·  default **[Opus]**
Reuse the offscreen player to play playlists + Quran with a small queue, Media Session metadata,
resume positions (`nour.player.positions`); survives cross-site navigation. *(Cross-route media
state machine = the AudioPlayer-class work §15.1 tags Opus.)*
- **[Haiku]** seed/fixture + string updates.

### 7.3 (within P2/P3) Mechanical clones  ·  **[Haiku]**
Repeating a settled component/pattern across resources, batch string/i18n updates.

### 7.4 Phase F — Firefox port (deferred, fully additive)  ·  default **[Sonnet]**
Add `webextension-polyfill` (swap `chrome.*` → `browser.*`), a Firefox manifest
(`background.scripts` event page + `browser_specific_settings`, no `offscreen`), a second Vite
target (`dist/firefox`), and the **Firefox branch of `audio-router`**: a managed/auto-opened
player tab (`audio.html`) since Firefox has no offscreen API. Everything else is unchanged — the
`audio-router` seam was designed for exactly this. *(Porting a settled pattern → Sonnet; escalate
to Opus only if background-lifecycle edge cases bite.)*

---

## 8. Verification

- **CI:** run the **FULL** `pnpm turbo run lint typecheck test build` (not per-app `--filter`) —
  CI runs all packages `--frozen-lockfile`, stops at first red. Confirm `apps/extension` has its own
  `eslint.config.mjs` + `vitest run --passWithNoTests`.
- **Chrome (load unpacked):** load `dist/`, set test location, next prayer ~2 min out, **close all
  tabs** → notification fires + adhan plays via offscreen with **no visible tab**. Force-terminate
  the worker (`chrome://serviceworker-internals`) → confirms re-arm.
- **Sleep/wake (manual):** arm pre-Fajr alarm, sleep, wake near a later prayer → `isAdhanEventStale`
  drops the stale Fajr fire; only the correct prayer plays.
- **Dedup:** open two contexts (popup + new tab) at a prayer instant → exactly one adhan plays.
- **Unit:** promoted `schedule.ts` keeps its moved web tests; add tests for `fired-claim` port.
- **Content (P2–3):** new tab loads `/api/v1/*`; a playlist keeps playing across cross-site nav.

## 9. Out of scope / deferred

Accounts/sync (no public auth API) · offline content beyond the cached adhan clip · Safari port ·
Firefox until Phase F.

## 10. Conventions + token economy

- Extension never imports `@repo/api`/`@repo/config/env` — only public `/api/v1/*` + `@repo/shared-core`
  (same boundary as mobile). No `process.env` outside `@repo/config` (use Vite `define`).
- Every package needs `eslint.config.mjs`; no-test packages `vitest run --passWithNoTests`; one
  React via root `pnpm.overrides`; ADR for new deps.
- Commit: `[AhmedMuhammedElsaid][<verb>]: …`, one commit per concern, Co-Authored-By trailer.
  Re-check `git HEAD`/`origin/main` before each commit/push (concurrent sessions on `main`); stage
  explicit paths, not `-A`.
- **Token economy:** one ticket per session; **right model per step** (table above is the lever);
  edit with diffs, not whole-file rewrites; reference paths/line-ranges, not file contents; reuse
  this doc + `APP_CONTEXT.md` instead of re-exploring.
```
