# Azan Audio & Notifications — Design

> Date: 2026-06-07 · Status: Approved · Feature: play the Adhan (Azan) at each prayer time.
> Builds on the **Prayer Times** wave (APP_CONTEXT §Completed waves; deferred item "adhan audio, notifications").

## 1. Goal

When a prayer time arrives, Nour plays the Adhan. Two delivery layers:

- **Layer A — Foreground:** the Adhan plays automatically whenever a Nour tab is open (even backgrounded). Reliable, cross-browser, no permission.
- **Layer B — Background best-effort:** using the experimental Notification Triggers API (`showTrigger`), schedule the day's prayer notifications so they fire even when the tab is fully closed (Chrome/Android). Clicking a notification opens Nour and plays the Adhan. Silently degrades to Layer A on iOS/Firefox.

Fully device-local — no DB, no auth, no server. Matches the existing prayer-times model.

## 2. Audio assets

Two bundled static recordings in `apps/web/public/audio/`:

- `adhan.mp3` — regular adhan (Dhuhr/Asr/Maghrib/Isha).
- `adhan-fajr.mp3` — Fajr adhan (includes "as-salatu khayrun min an-nawm").

The actual recordings are dropped in by the maintainer; the implementation wires the paths and leaves a placeholder note if files are absent. Both are added to the service worker `PRECACHE` list so the Adhan works offline.

## 3. Architecture

```
Layer A — Foreground (all browsers)
  <AdhanController/> island (mounted in app/[locale]/layout.tsx → runs site-wide)
    → use-adhan-scheduler: arms one setTimeout to the next ENABLED prayer event
    → on fire: <AdhanPlayer> plays the correct bundled audio at the chosen volume,
      then reschedules; re-arms across midnight rollover and on settings/location change

Layer B — Background best-effort (Chrome/Android)
  On enable + Notification permission granted:
    lib/adhan-notifications schedules today's prayers via
    registration.showNotification({ showTrigger: new TimestampTrigger(time) })
    (feature-detected; no-op where showTrigger is unsupported)
  sw.js:
    notificationclick → focus an existing Nour client or open one →
      postMessage({ type: "adhan:play", key }) → controller plays the Adhan
```

Both layers consume the **same** settings and the **same** pure schedule helper, so foreground and background stay consistent.

## 4. Files

### packages/api
- `src/schemas/prayer-times.ts` — add:
  - `adhanSettingsSchema`: `{ enabled: boolean; perPrayer: { fajr; dhuhr; asr; maghrib; isha: boolean }; volume: number (0–1) }`
  - `DEFAULT_ADHAN_SETTINGS` (enabled `false`, all prayers `true`, volume `0.8`)
  - `AdhanSettings` type.
  - Exported on the existing `./schemas/prayer-times` subpath — **no new package.json `exports` entry required** (avoids the ERR_PACKAGE_PATH_NOT_EXPORTED gotcha).

### apps/web/features/prayer-times
- `lib/adhan-schedule.ts` — **pure, no DOM**: `nextAdhanEvent(instants: PrayerInstant[], settings: AdhanSettings, now: Date): { key; time } | null`. Returns the soonest *enabled* prayer strictly after `now`; `null` if none remain today or all disabled. Sunrise excluded.
- `hooks/use-adhan-settings.ts` — localStorage key `nour.prayer.adhan`; SSR-safe hydration pattern mirroring `use-prayer-settings.ts` (defaults on server + first render, read on mount, persist on change).
- `hooks/use-adhan-scheduler.ts` — foreground engine: recomputes today's instants from current location/prefs (via `computePrayerTimes`), arms a single `setTimeout` to the next enabled event, fires playback, reschedules; handles midnight rollover and settings/location changes; clears timers on unmount.
- `lib/adhan-notifications.ts` — Layer B: `requestAdhanPermission()` and `scheduleAdhanNotifications(instants, settings)` using `TimestampTrigger`; feature-detects `'showTrigger' in Notification.prototype`; clears prior scheduled notifications before re-scheduling; no-op + resolves cleanly where unsupported.
- `components/adhan-player.tsx` — owns two `<audio>` elements (regular + Fajr), exposes `play(key)` that selects the right element and applies the volume. Primes/unlocks audio on the enabling user gesture.
- `components/adhan-controller.tsx` — headless client island: wires `use-adhan-scheduler` + `AdhanPlayer`, listens for `navigator.serviceWorker` `message` (`adhan:play`) to play on notification click. Mounted in `app/[locale]/layout.tsx`.
- `components/adhan-settings.tsx` — master on/off toggle, per-prayer checkboxes, volume slider, and a "Enable background notifications" permission button (shown only where `showTrigger` is supported). Added to the existing `method-settings` block on `/prayer-times`.

### apps/web/public
- `audio/adhan.mp3`, `audio/adhan-fajr.mp3` — bundled recordings.
- `sw.js` — add both audio files to `PRECACHE`; bump `VERSION` `v2 → v3`; add `notificationclick` handler (focus/open client + postMessage) and a `message` handler if needed for scheduling coordination.

### i18n
- `apps/web/messages/{ar,en}.json` — `prayer.adhan.*` strings (title, master toggle, per-prayer labels, volume, background-notifications button, autoplay hint).

## 5. Constraints handled explicitly

- **Autoplay policy:** browsers block audio without a prior user gesture. Enabling the Azan (a click) primes/unlocks the shared audio element so subsequent timed playback is permitted for the session. UI copy notes that the tab must have been interacted with.
- **Notification Triggers is experimental / Chrome-only:** feature-detected. Absence degrades to Layer A; no thrown errors, button hidden where unsupported.
- **`computePrayerTimes` is pure** and already imports `adhan`; safe to call client-side in the scheduler (the prayer-times widget already computes client-side).
- **Timezone:** v1 keeps the existing behavior — times computed in the viewer's device timezone (per-location tz remains deferred, consistent with the Prayer Times wave).

## 6. Tests (per CLAUDE.md §9 matrix)

- Unit: `nextAdhanEvent` — enabled-filtering, sunrise exclusion, all-disabled → `null`, none-remaining-today → `null`, picks soonest.
- Unit: `adhanSettingsSchema` parse/defaults + `use-adhan-settings` hydration (RTL).
- RTL component: `adhan-settings` toggles + volume render and persist.

## 7. Out of scope (v1)

- Web Push / VAPID server (rejected — breaks device-local/no-auth model).
- Admin-managed / R2-uploaded adhan audio.
- Multiple muezzin recordings / sound picker.
- Per-location timezone formatting (already deferred in Prayer Times).
- Pre-adhan reminder offsets, iqama timers.
