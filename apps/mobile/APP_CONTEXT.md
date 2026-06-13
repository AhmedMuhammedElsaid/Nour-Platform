# APP_CONTEXT.md — Nour Mobile

> **AI agents: read this FIRST before any work in `apps/mobile`.** Hand-maintained
> snapshot of the mobile app's stack, structure, and gotchas. The root
> `APP_CONTEXT.md` covers the web/monorepo; this is the mobile companion. Don't
> re-explore what's listed here. See `apps/mobile/deploy.md` for run/build steps.

---

## Stack snapshot

- **Expo SDK ~56**, New Architecture / bridgeless. React Native 0.85.x · React 19.
- **expo-router** (file-based, `app/`). **NativeWind v4** (Tailwind tokens ported
  verbatim from `packages/ui/src/styles/tokens.css` — dark-default gold/near-black).
- **TanStack Query** for data; **i18next/react-i18next** for i18n (AR/EN).
- **react-native-track-player v4** — audio engine (background + lock-screen).
- **expo-location** + **expo-notifications** — prayer times + local azan.
- **react-native-svg** — sun-arc. **AsyncStorage** — all device-local state.
- Tests: **jest-expo + @testing-library/react-native** (NOT vitest).

## Hard boundaries (mobile-specific)

- **Never import `@repo/api`** (pulls in Mongoose) or **`@repo/config/env`**. The
  app talks only to the web app's read-only **`/api/v1/*`** HTTP endpoints, via
  `lib/api.ts`. Shared pure logic comes from **`@repo/shared-core`** (schemas,
  prayer-times compute/format/sun-arc, quran audio-url).
- **Env**: only `EXPO_PUBLIC_*` (build-time inlined, like `NEXT_PUBLIC_*`). The
  one var is `EXPO_PUBLIC_API_BASE_URL` (web origin, no `/api/v1` suffix). Set in
  `apps/mobile/.env.local` for dev and in the EAS build env for store builds.
- **Cannot run in Expo Go** — native modules + New Arch require a **custom dev
  client** (`eas build --profile development` or `npx expo run:android/ios`).
- AsyncStorage keys **mirror the web's localStorage keys exactly** so behaviour
  matches: `nour.player.recent`/`.prefs`/`.positions`, `nour.adhkar.progress`,
  `nour.quran.lastread`/`.prefs`/`.bookmarks`, `nour.prayer.location`/`.prefs`.

## Build phases (all merged to `main`)

P1 shared-core extraction · P2 `/api/v1` endpoints (web) · P3 Expo scaffold ·
P4 design primitives + Home & Playlist Detail · P5 Adhkar reader + category
filter · P6 audio engine (track-player) · P7 prayer-times + azan notifications ·
P8 Quran reader · P9 offline downloads (expo-file-system) · P10 i18n/RTL,
theming, deep links, icon/splash + EAS build config. (Original plan was
`Documentation/mobile_migration_plan.md`, which is **gitignored**.)

## Key file locations

```
apps/mobile/
  app/                       expo-router screens
    _layout.tsx              providers: QueryClient, ThemeProvider, PlayerProvider;
                             mounts <MiniPlayer>; registers RNTP playback service;
                             splash/fonts (expo-splash-screen + useFonts)
    index.tsx                Home (hero, CategoryPills, sort, grid, shelves, nav cards)
    playlist/[slug].tsx      Playlist detail — Play-All, tap-to-play, DownloadButton
    adhkar/{index,[slug]}.tsx  Adhkar list + tap-counter reader
    prayer-times/index.tsx   Sun-arc + countdown + timetable + settings + notif toggle
    quran/…                  Quran reader (index, reader, word-by-word, tafsir, bookmarks)
  components/
    ui/                      text, button, card, skeleton, chip, progress (NativeWind)
    mini-player.tsx          sticky bottom transport bar (uses usePlayer)
  features/
    home/ playlists/ downloads/ prayer-times/
    prayer-times/
      components/sun-arc.tsx        RN-SVG arc; sun by day, mask-carved crescent MOON
                                    at night (isNight = before Fajr / at-or-after Isha)
      components/{prayer-timetable,location-picker,method-settings}.tsx
      hooks/use-prayer-settings.ts  AsyncStorage nour.prayer.location/.prefs
      hooks/use-azan-notifications.ts  schedules expo-notifications (next 2 days)
      data/cities.ts                copied verbatim from web
    downloads/                      use-downloads hook + DownloadButton (expo-file-system)
  lib/
    api.ts                   getJson(path, params) → EXPO_PUBLIC_API_BASE_URL + /api/v1
    queries.ts               TanStack query factories (playlists, categories, adhkar, …)
    player-context.tsx       PlayerProvider/usePlayer — RNTP wrapper, parity with web
                             player-context: queue, Fisher–Yates shuffle, repeat
                             off/all/one, rate, volume, sleep timer, resume positions,
                             prefs, recently-played writes
    playback-service.ts      RNTP background event handler (lock-screen transport)
    device-local.ts          AsyncStorage readers/writers (recent, quran, adhkar progress)
    theme-context.tsx        dark/light ThemeProvider
    i18n.ts                  i18next init; initialLocale
  locales/{ar,en}.json       all UI strings (common, nav, home, playlist, player,
                             adhkar, prayer, quran namespaces)
  app.json                   Expo config (plugins: router, localization, location,
                             notifications; iOS UIBackgroundModes:[audio]; New Arch)
  eas.json                   build/submit profiles (dev client, preview APK, prod AAB)
  jest.setup.js              mocks: AsyncStorage, react-native-track-player,
                             expo-location, expo-notifications
  __tests__/                 home-screen, playlist-detail, adhkar, player,
                             prayer-times, sun-arc
```

## Known gotchas

- **App icons (rationalized 2026-06-13).** All branding derives from the **og-image** scene
  (`apps/web/public/og-image.png` → 1024² — open Quran + golden light + "Nour Platform"
  wordmark). The earlier "deliberate ن-mark hybrid" was **intentionally dropped per user
  request** (they want the colorful scene, not the monochrome mark, on the launcher) — do NOT
  revert it. Current asset set (only 3 PNGs in `assets/`):
  - **`icon.png`** — the full scene, **flattened to opaque RGB** (the source had an alpha
    channel; iOS App Store rejects icons with alpha — re-flatten if you ever regenerate).
    Used for top-level `icon` (iOS + base), `splash.image` (`resizeMode: contain`, so the
    whole scene + wordmark shows), and `web.favicon`.
  - **`adaptive-icon.png`** — Android `adaptiveIcon.foregroundImage`. A **subject-focused
    derivative**: `icon.png` zoomed 1.4× and center-cropped so the Quran fills the safe
    zone and the corner wordmark/badges are pushed out of the circle/squircle mask. Opaque
    full-bleed (so the green `backgroundColor #0E6E59` is just a fallback, never shown).
    Verified the inscribed-circle crop renders a clean centered-Quran icon.
  - **`android-icon-monochrome.png`** — the flat white ن silhouette. Used for the Android-13
    themed-icon `monochromeImage` AND the expo-notifications plugin icon. Leave it: themed +
    notification icons MUST be a flat single-color silhouette, not the color scene.
  - Deleted: `android-icon-foreground.png`, `favicon.png`, and `splash-icon.png` (the last
    was byte-identical to `icon.png`).
  - **Tooling**: this machine now has **Python PIL** (`from PIL import Image`) — use it to
    regenerate, not the old PowerShell `System.Drawing` hack. iOS still rounds corners and
    Android masks the launcher, so any full-scene `icon.png` will lose its corners on those
    surfaces by design; the wordmark only fully survives on the splash.
  - The animated splash (`components/animated-splash.tsx`) is **drawn in code** (SVG ن +
    reanimated), independent of every image asset — icon changes never affect the animation.
- **Sun-arc moon**: `isNight` swaps the rayed sun for a glowing crescent. Mobile
  carves the crescent with an RN-SVG `<Mask>` using **absolute** cx/cy (no
  transforms in this SVG), so it always aligns — and degrades to a visible full
  disc if `Mask` is unsupported. (The web bug was a CSS-transform vs
  `userSpaceOnUse` mask mismatch; mobile sidesteps it by not transforming.)
- **ESLint**: `react-hooks/exhaustive-deps` rule is **not configured** here —
  never add an `// eslint-disable-next-line react-hooks/exhaustive-deps`; it errors
  ("Definition for rule not found"). Just omit deps and leave a plain comment.
- **`Skeleton`** is a static dimmed `View` (no running animation) — animated
  timers leaked under jest and caused "worker failed to exit"/timeouts.
- **RNTP setup is idempotent** (`setupPlayer()` swallows the double-setup throw).
  Native track-player behaviour (background audio, lock-screen) only verifiable on
  a **physical device** — jest mocks all RNTP methods/hooks.
- **expo-notifications / expo-location** are mocked in `jest.setup.js`; real
  firing/permission flows need a device.
- A physical phone can't reach `localhost` — point `EXPO_PUBLIC_API_BASE_URL` at
  your machine's LAN IP (Android emulator: `http://10.0.2.2:3000`).
- Adding a native module or editing `app.json` plugins requires a **new dev-client
  build**, not just a Metro reload.
- **EAS cloud builds (preview APK = `eas build --profile preview --platform android`,
  run from `apps/mobile`)**: hard-won gotchas from the first green build (2026-06-12):
  - Builds resolve the **`production`** EAS env environment by default; the preview
    profile is pinned to `"environment": "preview"` in `eas.json` so it sees the
    `EXPO_PUBLIC_API_BASE_URL` var created there (`eas env:list --environment preview`).
    Without the var the APK silently falls back to `http://localhost:3000`.
  - `react-native-track-player` 4.1.2 needs `patches/react-native-track-player@4.1.2.patch`
    (Kotlin `Bundle?` vs `Bundle` compile error on RN 0.85) — applied automatically by
    pnpm; do not delete the root `patches/` dir or `pnpm.patchedDependencies`.
  - Babel plugins loaded **by bare name** (babel-preset-expo internals, worklets) must
    resolve from `apps/mobile` with plain Node resolution or cloud bundling fails with
    "Cannot find module". The faithful pre-flight check is
    `require.resolve(name, { paths: ['./apps/mobile'] })` — local `npx expo export`
    can pass while the cloud fails. Covered by `.npmrc public-hoist-pattern[]=@babel/*`
    + explicit `babel-preset-expo` / `@babel/plugin-transform-react-jsx` /
    `react-native-worklets` deps in `apps/mobile/package.json`.
  - EAS only reads `apps/mobile/eas.json`; never run `eas` from the repo root (a stray
    root `eas.json` from such a run was deleted).
- **RNTP New-Arch runtime crash (APK closes instantly, before splash)**: distinct from the
  compile patch above — fixing the build was necessary but NOT sufficient. RNTP 4.1.2's async
  `@ReactMethod`s in `MusicModule.kt` are Kotlin expression bodies (`fun x(...) = scope.launch { }`)
  whose inferred return type is `kotlinx.coroutines.Job` (non-void). RN 0.85 New-Arch / bridgeless
  TurboModule interop rejects a non-void return on a non-synchronous `@ReactMethod`, so the module
  fails to parse on the first route load: `TurboModuleInteropUtils$ParsingException: Unable to
  parse @ReactMethod annotations from native module: TrackPlayerModule. Details: TurboModule system
  assumes returnType == void iff the method is synchronous.` Fix (in the same
  `patches/react-native-track-player@4.1.2.patch`): a `Unit`-returning wrapper
  `private fun launchInScope(block: suspend kotlinx.coroutines.CoroutineScope.() -> Unit) { scope.launch(block = block) }`
  that every `scope.launch {` routes through, so each `@ReactMethod` returns `Unit`. Behaviour is
  identical (the `Job` was never used). ⚠️ **Renaming the builder also forces renaming the lambdas'
  `return@launch` → `return@launchInScope` (40 of them)** — Kotlin labels a lambda by its enclosing
  function name, so the old labels orphan and `:react-native-track-player:compileReleaseKotlin` fails.
  (Two commits: `761d1a3` wrapper, `60016c0` label rename.) **Re-verify BOTH the compile and runtime
  patches on any RNTP bump.** Diagnose native startup crashes with `adb logcat -b crash`; if USB won't
  authorize (no "Allow" popup / generic WinUSB driver — seen on the Huawei CMA-LX2), use **Wireless
  debugging** (`adb pair IP:PORT CODE`, then mDNS auto-connects) with Google's standalone
  platform-tools — this machine has no Android SDK/adb installed.
  - **EAS Free plan caps Android builds/month** — exhausted 2026-06-12 (resets **2026-07-01**); builds
    then fail with "This account has used its Android builds from the Free plan this month." Options:
    wait for reset, upgrade the Expo plan, or build locally.
  - **Local Android build (Windows)**: `eas build --local` is **not supported on Windows** → use
    `npx expo prebuild --platform android` (the `apps/mobile/android/` project is already generated)
    then `cd android && ./gradlew assembleRelease`. Needs **JDK 17 + Android SDK/NDK** installed from
    scratch (none present here; `winget` is available). Gradle wrapper is 9.3.1; New Arch + Hermes on.
  - **Upload size**: `eas build` uploads the WHOLE monorepo (~21.6 MB); ~13 MB of that is two web-only
    adhan MP3s in `apps/web/public/audio/`. Add an `apps/mobile/.easignore` excluding
    `apps/web/public/audio/`, `apps/admin/`, `docs/` to shrink uploads (~6 MB) and reduce upload stalls.

## Resolved on-device (debug session 2026-06-13) — APK now opens AND loads data

Two separate bugs made the installed APK unusable; both fixed + committed to `main`.

1. **Third RNTP New-Arch crash — app opened then closed instantly (commit `c3cb6d6`).** After the
   compile + TurboModule patches, the app still crashed on the first player event. `adb logcat -b crash`:
   `java.lang.RuntimeException: You should not use ReactNativeHost directly in the New Architecture`
   at `MusicService.emit(MusicService.kt:744)` via `HeadlessJsTaskService.getReactNativeHost`. RNTP
   4.1.2's `MusicService.emit`/`emitList` reach the JS event emitter through the legacy
   `reactNativeHost`, which throws under bridgeless. Fix (same `patches/react-native-track-player@4.1.2.patch`,
   now 486 lines): a `reactContextCompat` getter preferring `ReactApplication.reactHost.currentReactContext`
   (non-null on New Arch), falling back to `reactNativeHost` only when `reactHost` is null. **RNTP 4.x now
   has THREE New-Arch landmines (Bundle? compile, TurboModule return-type, ReactHost emit) — re-verify all
   three on any bump.**
2. **"Something went wrong" on every screen — URL-join bug in `lib/api.ts` (commit `d0b7d6b`).**
   `getJson` did `new URL(path, API_BASE_URL)` where `API_BASE_URL` = `…/api/v1` (no trailing slash) and
   every `queries.ts` path has a **leading slash** → URL resolution dropped `/api/v1`, hitting
   `https://host/playlists` (307→HTML) instead of `/api/v1/playlists` (200 JSON). Fix: join by concat,
   `new URL(\`${API_BASE_URL}${path}\`)`. Regression test `__tests__/api.test.tsx`. Latent until now —
   earlier builds crashed before any fetch ran.

**Backend / EAS config (current):** web is deployed at **`https://nour-platform-web.vercel.app`** (`/api/v1/*`
returns 200 JSON). The EAS project is **`volunteering-apps/nour-platform`** (re-link `9175d00`); its **preview**
environment now has `EXPO_PUBLIC_API_BASE_URL=https://nour-platform-web.vercel.app` (`eas env:create … --environment preview`).
EXPO_PUBLIC_* is build-time inlined → **every URL/backend change needs a rebuild**. Diagnose an installed APK's
baked URL without source: `adb shell pm path com.nour.mobile` → `adb pull` → `unzip` → `grep -a` the
`assets/index.android.bundle`.

**Diagnosing on a connected device:** `adb` is Google standalone platform-tools at
`C:\Users\Ahmed Elsaid\adb-tools\platform-tools\adb.exe` (no full SDK). USB won't authorize on the Huawei
CMA-LX2 → use **Wireless debugging**: the connection drops between sessions and mDNS auto-discovery is flaky
on Windows, so re-pair/reconnect each session — need the device's **connect** address (main Wireless-debugging
screen, NOT the pairing port) for `adb connect IP:PORT`. `adb logcat -b crash` for native crashes;
`apps/mobile/capture-crash.sh` (untracked helper) clears the buffer, launches `com.nour.mobile`, and dumps
the crash + JS errors.

**Local APK build (in progress, not finished):** chosen over EAS (free-plan quota). `apps/mobile/android/` is
prebuilt; `gradlew` build needs **JDK 17 + Android SDK + NDK** (none were installed). JDK 17 install started
via `winget install Microsoft.OpenJDK.17`; **Android SDK/NDK + the actual `./gradlew assembleRelease` + signing
config are still TODO.** `assembleRelease` needs a release keystore (verify `android/app/build.gradle` signingConfigs).

## Verify before shipping

```bash
cd apps/mobile
pnpm typecheck && pnpm lint && pnpm test
npx expo export --platform android   # confirms the JS bundle compiles
```
Device checklist + build/submit steps: see `apps/mobile/deploy.md`.
