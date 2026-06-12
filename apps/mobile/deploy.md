# Nour Mobile — Run & Deploy Guide

Step-by-step for running the Expo app in development and shipping it to the
stores. This app is part of the Turborepo monorepo (`apps/mobile`).

> **Key fact:** this app uses native modules (`react-native-track-player`,
> `expo-location`, `expo-notifications`) and the **New Architecture**. It
> **cannot run in the Expo Go sandbox** — you need a *custom dev client* (a
> development build). Everything below assumes that.

---

## 0. Stack at a glance

| | |
|---|---|
| Expo SDK | ~56 (New Architecture / bridgeless) |
| React Native | 0.85.x · React 19 |
| Router | expo-router (file-based, `app/`) |
| Styling | NativeWind v4 |
| Audio | react-native-track-player v4 (background + lock-screen) |
| Location / Notifications | expo-location · expo-notifications |
| Data | TanStack Query → web `/api/v1/*` (HTTP only — never imports `@repo/api`) |

The app talks to the **web app's** read-only `/api/v1` endpoints. It does **not**
connect to MongoDB directly.

---

## 1. Prerequisites (one-time)

- **Node 20 LTS+** and **pnpm** (repo uses pnpm workspaces).
- **EAS CLI**: `npm i -g eas-cli` then `eas login` (free Expo account).
- For **local native builds** (optional — EAS cloud builds avoid these):
  - **Android**: Android Studio + an SDK + a device/emulator. `JAVA_HOME` set.
  - **iOS** (macOS only): Xcode + CocoaPods + an iOS Simulator or device.

You do **not** need Android Studio / Xcode if you only use **EAS cloud builds**
(§4) — just the EAS CLI.

---

## 2. Install & configure

From the **repo root** (not `apps/mobile`):

```bash
pnpm install
```

### Point the app at an API

The app reads `EXPO_PUBLIC_API_BASE_URL` (the origin of the web app, **without**
`/api/v1` — that suffix is added in code). Create `apps/mobile/.env.local`:

```bash
# apps/mobile/.env.local
# Dev against a web server on your machine reachable from the phone:
EXPO_PUBLIC_API_BASE_URL=http://192.168.1.50:3000
# Or against production:
# EXPO_PUBLIC_API_BASE_URL=https://your-web-domain.com
```

> A physical phone can't reach `localhost` — use your computer's LAN IP
> (`ipconfig` / `ifconfig`) and make sure the web app is running on `:3000`
> and your firewall allows it. Default fallback is `http://localhost:3000`
> (works only on an emulator running on the same machine, and even then Android
> emulators need `http://10.0.2.2:3000`).

### Set EAS environment variables (one-time, for cloud builds)

`EXPO_PUBLIC_*` vars are **inlined at build time** — they must be set in EAS
before running any cloud build, not just locally:

```bash
cd apps/mobile

# Production (preview / release builds point at live API):
eas env:create --name EXPO_PUBLIC_API_BASE_URL \
  --value https://your-web-domain.com \
  --environment production --visibility plaintext

# Development (dev-client builds can point at a staging or local tunnel):
eas env:create --name EXPO_PUBLIC_API_BASE_URL \
  --value https://your-staging-domain.com \
  --environment development --visibility plaintext
```

> Run once per environment. To update later: `eas env:update --name EXPO_PUBLIC_API_BASE_URL`.
> View all vars: `eas env:list`.

---

## 3. Run in development (custom dev client)

You build the dev client **once**, then iterate over-the-air with `expo start`.

### 3a. Build & install the dev client

**Cloud (recommended — no local Android Studio/Xcode needed):**

```bash
cd apps/mobile
eas build --profile development --platform android   # produces an installable APK
# iOS (needs an Apple account on the EAS project):
# eas build --profile development --platform ios
```

When the build finishes, EAS gives you a QR code / URL — install the resulting
APK on your device (or drag the build to an emulator/simulator).

**Local (if you have the native toolchains):**

```bash
cd apps/mobile
npx expo run:android      # builds + installs a dev client on device/emulator
npx expo run:ios          # macOS only
```

### 3b. Start the dev server and connect

```bash
cd apps/mobile
pnpm start            # = expo start  (Metro bundler)
# then press 'a' (Android) / 'i' (iOS), or scan the QR with the dev client
```

The dev client loads your JS over the network; edits hot-reload. You only need
to rebuild the dev client (§3a) when **native** deps or config (`app.json`
plugins, new native modules) change — not for normal JS/TSX edits.

### What needs a real device

These can't be verified on a plain simulator and should be smoke-tested on a
physical device:

- **Background audio + lock-screen controls** (track-player).
- **Azan/local notifications firing** (expo-notifications) — allow the
  notification permission prompt.
- **Geolocation** for prayer times (expo-location) — allow the location prompt.

---

## 4. Verify before shipping

```bash
cd apps/mobile
pnpm typecheck      # tsc --noEmit
pnpm lint           # eslint, zero warnings
pnpm test           # jest-expo + RNTL
npx expo export --platform android   # confirms the JS bundle compiles end-to-end
```

Manual device checklist:

- [ ] Home → playlist → **Play All**; audio starts, mini-player shows.
- [ ] Lock the screen / background the app → audio continues; lock-screen
      transport (play/pause/next/prev) works.
- [ ] Quran reader plays ayah audio and auto-advances.
- [ ] Adhkar tap-counter persists across an app restart.
- [ ] Prayer times match the web app for the same city/method; enable
      notifications and confirm one fires.
- [ ] Offline download a track, go airplane-mode, play it.
- [ ] Toggle Arabic ↔ English; layout flips RTL correctly.

---

## 5. Production builds

### Android (Google Play — App Bundle)

`eas.json` already defines the `production` profile (AAB + release keystore via
env vars).

```bash
cd apps/mobile
# Provide signing secrets to EAS (one-time per machine/CI):
#   KEYSTORE_PASSWORD, KEY_PASSWORD  (referenced by eas.json)
eas build --profile production --platform android
```

Then submit to the Play Store **internal** track:

```bash
# Requires google-play-key.json (a Play service-account key) at apps/mobile/.
eas submit --profile production --platform android
```

### iOS (App Store)

```bash
cd apps/mobile
eas build --profile production --platform ios
# Submit (needs APPLE_ID, APPLE_TEAM_ID, APPLE_APP_PASSWORD env vars):
eas submit --profile production --platform ios
```

### A quick shareable APK (no store)

```bash
eas build --profile preview --platform android   # standalone .apk to sideload
```

---

## 6. Environment & secrets

| Variable | Where | Purpose |
|---|---|---|
| `EXPO_PUBLIC_API_BASE_URL` | `apps/mobile/.env.local` (+ EAS build env) | Web API origin. **Inlined at build time** — set it in the EAS build environment for store builds, not just locally. |
| `KEYSTORE_PASSWORD`, `KEY_PASSWORD` | EAS secret / shell | Android release signing (`eas.json`). |
| `APPLE_ID`, `APPLE_TEAM_ID`, `APPLE_APP_PASSWORD` | EAS secret / shell | iOS submission. |

Set env vars with `eas env:create` (plain-text) and secrets with `eas secret:create` (sensitive) so they're available to cloud builds.

> **`EXPO_PUBLIC_*` is build-time inlined**, the mobile analogue of
> `NEXT_PUBLIC_*`. A production build pointed at the wrong origin must be
> rebuilt — it can't be reconfigured at runtime.

---

## 7. Troubleshooting

- **"Main has not been registered" / native module is null** — you're running
  in **Expo Go**. Install the **dev client** (§3a) instead.
- **Network request failed / blank lists** — `EXPO_PUBLIC_API_BASE_URL` is
  unreachable from the device. Use the LAN IP, confirm the web app is up on
  `:3000`, check the firewall. Android emulator → `http://10.0.2.2:3000`.
- **Audio won't play in background** — confirm you're on a dev/production build
  (not Expo Go) and that the build picked up `UIBackgroundModes: ["audio"]`
  (iOS) — rebuild the dev client after `app.json` changes.
- **No notifications** — grant the notification permission on the device;
  notifications don't fire on a simulator reliably — test on hardware.
- **Native change not taking effect** — adding a native module or editing
  `app.json` plugins requires a **new dev-client build** (§3a), not just a
  Metro reload.
- **Stale Metro cache** — `npx expo start -c`.

---

## 8. Where things live

```
apps/mobile/
  app/                      expo-router screens (index, playlist/[slug], adhkar/*,
                            prayer-times/, quran/* …) + _layout.tsx (providers)
  components/               shared UI primitives + mini-player
  features/                 downloads, prayer-times, playlists, home, …
  lib/                      api.ts (HTTP), queries.ts, player-context.tsx,
                            device-local.ts, i18n, theme-context.tsx
  locales/                  ar.json · en.json
  app.json                  Expo config (plugins, iOS/Android, New Arch)
  eas.json                  EAS build/submit profiles
  __tests__/                jest-expo + RNTL suites
```
