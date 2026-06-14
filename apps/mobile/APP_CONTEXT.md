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

**Post-P10 polish (on `main`, 2026-06-13):** azkar morning/evening reminders ·
**Home `PrayerTimesWidget`** (live sun/moon arc + countdown, taps → /prayer-times)
with a `SunArc` refactor to a presentational `{dots, fraction, isNight}` API ·
**SoundCloud-style animated bottom tab bar** (replaced the Home top nav-card list) ·
**SunArc corona breathing pulse** (`49b5cfd`) — the sun/moon glow halo now pulses via
a UI-thread Reanimated `withRepeat(withTiming(0.5, 1s, ease-in-out), -1, true)` loop on
an `Animated.createAnimatedComponent(Circle)`, mirroring the web corona's `animate-pulse`
(closes the last sun-arc parity gap vs web; the crisp disc/crescent are untouched) ·
**`components/ui/spinner.tsx`** (`f9098dd`) — reusable `<Spinner>` over RN's native
`ActivityIndicator` (OS-drawn, no JS loop / SVG / new dep), gold `#c8a050`, `label` →
`accessibilityLabel`; replaced the `Loading…` text on the adhkar reader + both Quran
screens. Skeleton-based loaders (Home/Playlist/Adhkar list) intentionally left as-is.

## Key file locations

```
apps/mobile/
  app/                       expo-router screens
    _layout.tsx              providers: SafeAreaProvider, QueryClient, ThemeProvider,
                             PlayerProvider; mounts <BottomDock> (MiniPlayer + bottom
                             tab bar); registers RNTP playback service; splash/fonts
    index.tsx                Home (hero, PrayerTimesWidget, CategoryPills, sort, grid,
                             shelves) — top nav cards removed → bottom tab bar
    playlist/[slug].tsx      Playlist detail — Play-All, tap-to-play, DownloadButton
    adhkar/{index,[slug]}.tsx  Adhkar list + tap-counter reader
    prayer-times/index.tsx   Sun-arc + countdown + timetable + settings + notif toggle
    quran/…                  Quran reader (index, reader, word-by-word, tafsir, bookmarks)
  components/
    ui/                      text, button, card, skeleton, chip, progress (NativeWind)
    mini-player.tsx          sticky transport bar (uses usePlayer); takes a bottomInset
    bottom-tab-bar.tsx       SoundCloud-style bottom nav (Home/Quran/Adhkar/Prayer/
                             Downloads). PRESENTATIONAL, not expo-router <Tabs>: driven
                             by usePathname + router.navigate, so existing nested stacks +
                             deep links are untouched. Animated gold active pill; always
                             rendered (Phase 5.1 — no more isTabRoot() gating)
    bottom-dock.tsx          stacks <MiniPlayer> (bottomInset=0) directly above
                             <BottomTabBar> (carries the safe-area inset) on every route
                             except /player. Rendered once in _layout
    icons/tab-icons.tsx      5 RN-SVG stroke icons for the tab bar; take a `color` prop
                             (SVG can't read NativeWind classes) — NO new icon dep
  features/
    home/ playlists/ downloads/ prayer-times/
    prayer-times/
      components/sun-arc.tsx        RN-SVG arc; sun by day, mask-carved crescent MOON
                                    at night. PRESENTATIONAL — props are now
                                    {dots, fraction, isNight}; callers compute via
                                    getArcPosition + buildArcDots (both the Home widget
                                    AND prayer-times/index.tsx must pass the new API)
      components/prayer-times-widget.tsx  Home widget: live arc + countdown + 5-prayer
                                    row; taps → /prayer-times (mirrors web widget)
      components/{prayer-timetable,location-picker,method-settings}.tsx
      lib/arc-dots.ts               buildArcDots(day,nextKey) → per-prayer day fractions
      hooks/use-prayer-settings.ts  AsyncStorage nour.prayer.location/.prefs
      hooks/use-azan-notifications.ts  schedules expo-notifications (next 2 days)
      hooks/use-azkar-reminder{s,-settings}.ts  morning/evening adhkar reminders
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
                             prayer-times, sun-arc, bottom-tab-bar, api, theme-locale
```

## Known gotchas

- **App icons (rationalized 2026-06-13).** All branding derives from the **og-image** scene
  (`apps/web/public/og-image.png` → 1024² — open Quran + golden light + "Nour Platform"
  wordmark). The earlier "deliberate ن-mark hybrid" was **intentionally dropped per user
  request** (they want the colorful scene, not the monochrome mark, on the launcher) — do NOT
  revert it. Current asset set (only 3 PNGs in `assets/`):
  - **`icon.png`** — the full scene, **flattened to opaque RGB** (the source had an alpha
    channel; iOS App Store rejects icons with alpha — re-flatten if you ever regenerate).
    Used for top-level `icon` (iOS + base), the native splash + the animated-splash overlay
    (see the two-splash-layers note below), and `web.favicon`.
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
  - **Two splash layers** (both now show `icon.png`):
    1. **Native splash** via the **`expo-splash-screen` config plugin** in `app.json` plugins
       (`image: ./assets/icon.png`, `imageWidth: 240`, `resizeMode: contain`,
       `backgroundColor: #0f0d0a`). **CRITICAL SDK-56 gotcha:** the legacy top-level
       `expo.splash` key is **silently ignored by prebuild** — without the plugin, prebuild
       bakes Expo's *placeholder* (grid + circles) on a *white* bg. The legacy `splash` block
       is kept only as a harmless fallback; the plugin is authoritative. Verify after prebuild:
       `android/app/src/main/res/values/colors.xml` → `splashscreen_background` should be
       `#0f0d0a`, and `drawable-*/splashscreen_logo.png` should be the Quran scene.
    2. **`components/animated-splash.tsx`** — a reanimated JS overlay that fades+springs the
       **`icon.png`** image in over the native splash, holds, then fades out (smooth hand-off
       to the app). As of 2026-06-13 the old code-drawn gold **ن** mark + "Nour Platform"
       wordmark was **replaced with the icon image** per user request (icon already carries the
       wordmark, so no separate text layer). Honours reduce-motion; 2.6s safety timeout. Uses
       `require("../assets/icon.png")` with a `@typescript-eslint/no-require-imports` disable
       (that rule IS on for `.tsx` here — only off for config/jest files).
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
`assets/index.android.bundle`. **Re-verified live 2026-06-13:** `…/api/v1/playlists?locale=ar` → 200 JSON,
the old un-prefixed `…/playlists` → 307 text/plain (the "something went wrong" source); all 8 `queries.ts`
paths start with `/` so the concat join is correct everywhere. The error users *still saw* was a stale APK
built before `d0b7d6b` — code + env are both settled; the next preview build resolves it.

**Diagnosing on a connected device:** `adb` is Google standalone platform-tools at
`C:\Users\Ahmed Elsaid\adb-tools\platform-tools\adb.exe` (no full SDK). USB won't authorize on the Huawei
CMA-LX2 → use **Wireless debugging**: the connection drops between sessions and mDNS auto-discovery is flaky
on Windows, so re-pair/reconnect each session — need the device's **connect** address (main Wireless-debugging
screen, NOT the pairing port) for `adb connect IP:PORT`. `adb logcat -b crash` for native crashes;
`apps/mobile/capture-crash.sh` (untracked helper) clears the buffer, launches `com.nour.mobile`, and dumps
the crash + JS errors.

**Local APK build (NOT pursued — user opted to stay on EAS for now, 2026-06-13):** `apps/mobile/android/` is
prebuilt. **JDK 17 IS now installed** (`winget install Microsoft.OpenJDK.17` completed). Still missing to build
locally: **Android SDK + NDK** (set `ANDROID_HOME`), a **release keystore** (verify `android/app/build.gradle`
signingConfigs), then `cd android && ./gradlew assembleRelease` + `adb install -r`. Resume only if the user
asks; otherwise keep using `eas build --profile preview --platform android` on `volunteering-apps/nour-platform`.

## Post-build feedback fixes (Phase 1 of `mobile_app_feedback_bugs.md`, 2026-06-14)

26 on-device bugs/UX issues were triaged into a 9-phase plan in
`apps/mobile/mobile_app_feedback_bugs.md` (`d64bdcd`). Phase 1 (quick
correctness fixes, no rebuild) is done, committed to `main`:

- **i18n interpolation** (`702cc31`): `locales/{en,ar}.json` `prayer.*` strings used
  single `{h}`/`{m}`/`{time}`/`{city}` placeholders — i18next needs `{{double}}`
  braces, so countdown/location text rendered the literal placeholder. Added
  `common.close`.
- **`useDockSpacing()`** (`a4c4f42`, new `lib/use-dock-spacing.ts`): computes bottom
  padding from `usePathname()` (tab bar shows on tab roots), `usePlayer().hasQueue`
  (mini-player), and `useSafeAreaInsets()`. Applied to home, adhkar list/reader,
  playlist detail, and Quran index/reader — replaces the old fixed `pb-12`/`pb-24`.
  Home also now defaults `sort` to `"az"` instead of `"newest"` so the library isn't
  empty-looking on first load. `jest.setup.js` gained a global
  `react-native-safe-area-context` mock (zero insets); tests that render screens using
  `useDockSpacing` now add `usePathname` to their `expo-router` mock and wrap in
  `<PlayerProvider>`.
- **Adhan toggle persistence** (`12d95d6`, new
  `features/prayer-times/hooks/use-adhan-settings.ts`): mirrors the web's
  `use-adhan-settings.ts` via AsyncStorage key `nour.prayer.adhan` +
  `@repo/shared-core`'s `adhanSettingsSchema`/`DEFAULT_ADHAN_SETTINGS` — the toggle no
  longer resets on navigation. Same commit gives the location-picker modal's close
  button a `useSafeAreaInsets().top` offset so it clears the status bar.

Phase 2 (prayer-times arc + theming, points 2/9/26) is done, committed to `main`:

- **SunArc size + theme palette** (`636df2d`): the body was web-sized (sun disc r5.5,
  moon r9) and read tiny on a phone — bumped to sun disc 9 / moon 12 with coronas and
  rays scaled to match. `SunArc` hardcoded the dark palette, so the moon vanished in
  light mode; it now takes a `theme?: ThemeMode` prop and resolves light/dark hexes
  from the token palette (`PALETTES` const: gold/sun/moon/text-2). **Both callers must
  pass `theme`** — `prayer-times-widget.tsx` (home) and `app/prayer-times/index.tsx`
  (full screen), each via `useTheme()`. Sizes are named consts at the top of
  `sun-arc.tsx` (`SUN_DISC`, `MOON_DISC`, `*_CORONA`, `SUN_RAY_*`).
- **Theme-toggle SVG icons** (`71aee7d`): the ☀/☾ emoji were tiny/unthemed. New
  `components/icons/theme-icons.tsx` (`SunIcon`/`MoonIcon`, tab-icon stroke style,
  `color` + `testID` props). `theme-toggle.tsx` shows the sun in dark mode, moon in
  light, themed stroke (`#f0e6cc` dark / `#13201a` light), no pill. The
  `theme-locale.test.tsx` toggle assertion now keys off `testID`
  (`theme-icon-sun`/`theme-icon-moon`), not the old emoji text.

Phase 3 (localization system, points 6/22) is done, committed to `main` (`76322cd`).
**Adds the `expo-updates` ~56.0.19 dependency** — needs the batched EAS rebuild.

- **Root cause**: `LocaleSwitcher` wrote `nour.locale` to AsyncStorage but `lib/i18n.ts`
  never read it back, and `initialLocale` was always the device locale — so switching
  language did nothing across restarts and adhkar titles / tafsir stayed in the boot
  language.
- **Fix**: `lib/i18n.ts` now exports `hydrateLocale()` (reads the persisted choice,
  applies language + RTL before first render) and `initialLocale` is a **`let`**
  upgraded by it. `app/_layout.tsx` gates the whole app tree on a `localeReady` state
  (set after `hydrateLocale()`), so the queries keyed on `initialLocale` boot in the
  chosen language. `LocaleSwitcher` persists + `applyTextDirection` + `Updates.reloadAsync()`,
  falling back to a live `i18n.changeLanguage` + restart-prompt when reload throws
  (dev build / Expo Go / updates disabled).
- **⚠ Rebuild caveat**: `Updates.reloadAsync()` only actually reloads in a build where
  **EAS Update is configured** (`runtimeVersion` + `updates.url` in `app.json`, via
  `eas update:configure`). Without it, `reloadAsync` throws and the switcher degrades
  to the live text swap (RTL needs a manual restart). Configure EAS Update as part of
  the batched rebuild for a seamless flip. `app.json` is intentionally left untouched
  here (batched with Phase 9).
- **Tafsir "only first ayah / empty" (point 6 data-half)**: traced end-to-end — the
  mobile client (`tafsir-sheet.tsx`) builds a fresh `{numberGlobal, ref}` per ayah and
  refetches; the web route (`app/api/v1/quran/tafsir/route.ts`), `getTafsir` service,
  and `findTafsir` repo all key strictly by `numberGlobal` and honor `locale`. **The
  contract is correct** — the empty-for-non-first behaviour is a backend **data-seeding
  gap** (the `QuranTafsir` collection is sparsely populated), not a client/route bug.
  The language-half is fixed by the locale persistence above.

Phase 4 (audio & player, points 3/12/17/10/19) is done, committed to `main`
(`d312cc0`, `2387024`, `c2c15ab`, `fbaae95`). No rebuild needed.

- **Double playback** (`d312cc0`): `useAyahAudio` gained an `onPlaybackStart` opt;
  `features/quran/components/reader.tsx` now pauses the RNTP player when an ayah
  starts and stops the ayah audio when RNTP starts (parity with the web reader).
- **Continue-listening autoplay** (`2387024`): the home shelf deep-links
  `/playlist/<slug>?trackId=<id>`; `app/playlist/[slug].tsx` reads `trackId` and
  `loadQueue`s at that index once (ref-guarded).
- **Offline playback** (`c2c15ab`): `downloads-list.tsx` is tap-to-play + Play-all,
  building a queue from `DownloadRecord`s (mediaUrl = localPath; player still prefers
  `getLocalPath`). New `downloads.playAll`/`play` strings.
- **Full-screen Now Playing** (`fbaae95`): new **`app/player.tsx`** modal route (seek,
  prev/play/next, repeat cycle, shuffle, volume, speed chips, sleep timer) mirroring
  `packages/ui/.../audio-player.tsx`. Tapping the mini-player opens it; mini-player
  also got quick shuffle/repeat. `components/bottom-dock.tsx` returns null on `/player`
  so the dock doesn't stack over the modal. New dependency-free
  **`components/ui/slider.tsx`** (PanResponder + measured width — no native slider dep,
  so no rebuild). Transport glyphs are still text/emoji; **Phase 7 swaps SVG icons**
  across mini-player + Now Playing + download button.

⚠ **Gotchas for the next session**:
- `app/player.tsx` does NOT transitively import `@/lib/i18n`, so any test rendering it
  must `import "@/lib/i18n"` first or `t()` returns raw keys (see
  `__tests__/now-playing.test.tsx`).
- expo-router typed routes: `.expo/types/router.d.ts` is gitignored; after adding a
  route, local `tsc` may fail on the new path until typegen reruns (`expo start`/
  `export`). CI types routes loosely (file absent) so it passes — deleting the stale
  local file unblocks local typecheck.

Phase 5 (navigation & Quran chrome, points 20/25) is done, committed to `main`
(`3d5c13c`, `dd0cc1f`). No rebuild needed.

- **Tab bar always visible** (`3d5c13c`): `bottom-tab-bar.tsx` no longer exports
  `isTabRoot`/`TAB_ROOTS` — `<BottomTabBar>` renders on every route via
  `bottom-dock.tsx`, which now always carries the safe-area inset on the bar
  (`MiniPlayer` gets `bottomInset=0`). `useDockSpacing()` always reserves
  `TAB_BAR_HEIGHT + insets.bottom` (+ the mini-player height when a queue is loaded),
  so every screen's existing `dockSpacing` padding already clears the now-visible bar.
- **Quran single themed header** (`dd0cc1f`): `app/quran/[surah].tsx` and
  `app/quran/index.tsx` set `headerShown: false` (no more default white
  Stack header). The reader's own header gained a `‹` back button
  (`onBack` prop, new `common.back` string) next to the surah title; loading/error
  states get a minimal `BackRow`. `quran/index.tsx`'s in-content title is now the
  only title (its Stack header was the duplicate).

Phase 6 (playlist artwork, point 8) is done, committed to `main` (`8eb35e8`). No rebuild
needed.

- **`Cover`** (`features/playlists/components/cover.tsx`) gained an `imageUrl?: string |
  null` prop; when set it renders an `<Image>` instead of the emoji/gradient fallback.
- New **`assetUrl(path)`** in `lib/api.ts` resolves an origin-relative static path (e.g.
  `playlist.scholarImage = "/muhmd-bakr.png"`) against the bare `EXPO_PUBLIC_API_BASE_URL`
  origin — **not** the `/api/v1`-suffixed `API_BASE_URL` used by `getJson`. Already-absolute
  URLs pass through.
- Wired into `playlist-card.tsx` (grid cards) and `app/playlist/[slug].tsx` (detail
  header) via `playlist.scholarImage`. `__tests__/cover.test.tsx` covers image-present
  (relative + absolute) and the emoji fallback.

**Next**: rebuild-free phases 7–8 (icons, splash revert), then batch the rebuild-gated
items (Phase 3 EAS-Update config + Phase 9 adhan sound/notifications) into one EAS build.

## Verify before shipping

```bash
cd apps/mobile
pnpm typecheck && pnpm lint && pnpm test
npx expo export --platform android   # confirms the JS bundle compiles
```
Device checklist + build/submit steps: see `apps/mobile/deploy.md`.
