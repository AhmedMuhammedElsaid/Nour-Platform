# ADR 0014: react-native-android-widget for the Android home-screen widget

## Status

Accepted (2026-07-18)

## Context

The owner asked for a real OS home-screen (launcher) widget — distinct from the
existing in-app `PrayerTimesWidget` home card — showing three rows: today's
prayer times (with next-prayer highlight), the last-played/favorite radio
station name, and a static Adhkar label. Each row deep-links into the app.
Full spec: `home_widget_plan.md` (repo root, deleted once this feature is
device-verified and logged in `apps/mobile/APP_CONTEXT.md`).

## Options

1. **`react-native-android-widget@^0.21.0`** — actively maintained Expo config
   plugin that generates the `AppWidgetProvider`/receiver + widget-info XML at
   prebuild time, renders a JSX tree to a bitmap (RemoteViews-compatible), and
   exposes `registerWidgetTaskHandler`/`requestWidgetUpdate` from JS. Requires
   RN ≥0.76 (app is on 0.85) and supports the New Architecture per its docs.
2. Hand-rolled native Kotlin `AppWidgetProvider` + custom `RemoteViews` layout,
   wired through a native module. Full control, but a solo-dev app would own
   an entire second native UI surface (XML layouts, manifest wiring, click
   `PendingIntent`s) and would have to duplicate the prayer-time math in
   Kotlin or bridge it awkwardly — far more native surface for a single
   3-row widget.
3. No widget — keep prayer/radio/adhkar visibility in-app only. Rejected: the
   owner explicitly asked for a launcher widget.

## Decision

Option 1. `react-native-android-widget` is the first widget library adopted
in this repo (first-of-kind pattern, CLAUDE.md §15.1 → Opus-tier review even
though there's no auth/RBAC/upload surface here).

Key constraints locked from the library's own docs (see plan §2):

- The widget tree is **rasterized to an image**, not native text — some
  launchers may report a widget size that doesn't exactly match the actual
  rendered area, causing minor cropping. Mitigated by rendering from
  `props.widgetInfo`'s width/height and re-rendering on `WIDGET_RESIZED`.
- `updatePeriodMillis` **defaults to 0** (never auto-updates) — the config
  plugin entry explicitly sets it to `1800000` (30 min, the library minimum).
- The radio row makes a `fetch("/api/v1/radio")` call from inside a headless
  JS task (`registerWidgetTaskHandler`'s handler runs in the live app
  process, so AsyncStorage/fetch all work) — this call is wrapped in
  try/catch with a cached-name (`nour.widget.radioNameCache`) fallback and
  must never throw, so a radio-row failure can't blank the other two rows in
  the same render.
- Requires a **new app entry point** (`index.ts` replacing `expo-router/entry`
  as `package.json`'s `"main"`, per the library's documented Expo Router
  recipe) that calls `registerWidgetTaskHandler` before delegating to
  `expo-router/entry`.

## Consequences

- **Android only.** iOS has no build track in this repo (no Apple dev
  account, no EAS iOS profile) — a WidgetKit/SwiftUI + App Group
  implementation is a separate future effort, out of scope here.
- **Requires a full native `eas build`, not `eas update`.** The config
  plugin's generated `AppWidgetProvider`/manifest entries and the new JS
  entry point are both native-shell-level changes that an OTA update cannot
  retroactively apply to an already-installed binary. This feature rides
  whatever the next batched preview build already contains
  (`app.json` `version`/`versionCode` — re-check `eas build:list` before
  building; bump both if a build already shipped without this feature).
- **No tap-to-play from the widget.** The radio row shows the station name
  only and deep-links to `/radio`; driving RNTP's audio engine from a
  headless widget click was rejected as an unproven pattern (risk of a
  second uninitialized player instance racing the in-app one) — the owner
  explicitly deferred this to a future iteration.
- **No live countdown / AlarmManager.** The prayer row shows static times
  with a highlighted next prayer, refreshed on the 30-min cycle plus an
  immediate refresh on in-app settings change
  (`requestWidgetUpdate` from `components/azan-scheduler.tsx`) — a ticking
  countdown was explicitly declined given this app's hard-won exact-alarm
  quota history.
- New non-cross-surface storage key `nour.widget.radioNameCache` — mobile-
  only, exempt from the `nour.*` cross-surface contract table (CLAUDE.md §5)
  since web/extension have no launcher widgets.
- `docs/adr/` is repo-gitignored (`/docs` in root `.gitignore`) — this file
  needs `git add -f` to be committed.
