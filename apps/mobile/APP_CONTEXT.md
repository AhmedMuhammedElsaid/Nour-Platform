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

## Post-build feedback fixes — ALL 9 PHASES DONE (`mobile_app_feedback_bugs.md`, 2026-06-14)

26 on-device bugs/UX issues were triaged into a 9-phase plan in
`apps/mobile/mobile_app_feedback_bugs.md` (`d64bdcd`). **All 9 phases / 26 points are
implemented and on `main`** (head `c8761e6`); full monorepo gate green, `expo export
--platform android` compiles, 17 jest suites / 55 tests pass. Phase details below.

**Two honest caveats** before calling it 100%:
1. **Point 6 tafsir "only first ayah / empty" is a BACKEND data-seeding gap, not a mobile
   bug** — the client + web route + `getTafsir`/`findTafsir` all key correctly by
   `numberGlobal`+`locale`; the `QuranTafsir` collection is sparsely populated. The
   *language* half is fixed in mobile; the *data* half needs a backend seed + web redeploy.
2. **Rebuild-gated items are code-complete but NOT device-proven** — they only take effect
   after one `eas build --profile preview --platform android`: the adhan notification sound
   (`adhan_notify.wav` + `app.json` + Android channel, Phase 9) and the language-switch
   reload (`expo-updates` `reloadAsync`, Phase 3 — no-op in dev). Phase 4's seek/volume use a
   **dependency-free PanResponder `Slider`**, so `@react-native-community/slider` was NOT
   added (one fewer native dep in the batch). After the build, walk the §3 on-device
   checklist in the plan. May also want to bump `android.versionCode` (still `1`).

Phase 1 (quick correctness fixes, no rebuild) is done, committed to `main`:

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

Phase 7 (icons polish, point 18 + player glyphs) is done, committed to `main` (`c0d8a96`).
No rebuild needed.

- **New `components/icons/player-icons.tsx`**: stroke-based SVG icons (24x24 viewBox,
  color prop, no fill) following the `tab-icons.tsx` pattern. Includes: `PlayIcon`,
  `PauseIcon`, `PrevIcon`, `NextIcon`, `ShuffleIcon`, `RepeatIcon`, `RepeatOneIcon`,
  `CheckIcon`, `RetryIcon`, `DownloadIcon`, `VolumeIcon`, `MuteIcon`, `ChevronDownIcon`.
- **Download button** (`download-button.tsx`): replaced emoji (`⬇ ✓ ↻`) with
  `DownloadIcon`, `CheckIcon`, `RetryIcon`; themed by status (muted idle, success
  complete, danger failed).
- **Mini-player** (`mini-player.tsx`): replaced all emoji (transport, shuffle, repeat)
  with the new icons; theme-colored (primary when active/shuffled/repeating, muted
  inactive).
- **Now Playing** (`app/player.tsx`): replaced all emoji (header chevron, transport,
  shuffle, repeat, volume) with SVG icons; kept same layout/sizing.

Phase 8 (splash revert, point 11) is done, committed to `main` (`ee02f00`). No rebuild
needed.

- **Restored `AnimatedSplash`**: replaced the simple icon overlay with the full
  "Minimal Rise" sequence from commit 1457430 — radial gold bloom (SVG gradient)
  expands behind the ن mark, which springs up with a gloss shimmer wipe, then
  the wordmark (نور / Nour Platform) rises in. Timing: bloom 900ms, mark spring
  + shimmer 420–1100ms, word 560–1040ms, total 1280ms + 280ms exit fade.
- Preserves the current **reduce-motion support** (honors OS accessibility
  setting; shows final frame static after 700ms) and **safety timeout** (2600ms
  absolute cap — never traps the user).
- Kept **assets/icon.png** as the native launcher icon (no app.json change).

Phase 9 (adhan, location, Quran settings, adhkar progress) is **done**, committed to
`main` (`2df93d9`, `c3bc85d`, `95f6831`, `56f2cb4`, + the adhan-sound asset commit). The
short-adhan notification SOUND is **rebuild-gated** (new bundled asset + `app.json`); the
rest needs no rebuild.

- **9.1 "Both" adhan** (`56f2cb4` + asset commit):
  - *Foreground (full adhan):* `useForegroundAdhan` (`features/prayer-times/hooks/
    use-foreground-adhan.ts`), mounted once in `_layout` inside `PlayerProvider`, listens
    for `nour-azan-*` notifications received while the app is open and streams the full
    adhan (regular, or `adhan-fajr.mp3` for Fajr) from the web origin via expo-audio's
    imperative `createAudioPlayer` — no bundled asset for this part. Ducks the RNTP queue
    (pause; resume on `didJustFinish`). Respects `useAdhanSettings` enabled+perPrayer+volume.
  - *Closed-app (short clip):* `assets/audio/adhan_notify.wav` — a mono fade-out clip
    trimmed from `apps/web/public/audio/adhan.mp3` with ffmpeg (extended 24s→29s on
    2026-07-01 to use more of Apple's ≤30s ceiling; pcm_s16le/44100/mono, 2s fade-out).
    Registered in `app.json`
    `expo-notifications.sounds`; the Android "azan" channel uses it (`sound: AZAN_SOUND`)
    and each scheduled notification sets `sound: AZAN_SOUND` (iOS). Filename uses
    **underscores** (Android res/raw naming rules forbid hyphens). ≤30s for the iOS limit.
  - **`lib/notifications.ts`**: foreground `setNotificationHandler` (azan →
    `shouldPlaySound:false` so the in-app full adhan doesn't double with the notification
    sound; other notifs play sound), `ensureAzanChannel()` (HIGH importance, created
    before scheduling), `AZAN_CHANNEL_ID` + `AZAN_SOUND` exports. `use-azan-notifications`
    passes `channelId`.
- **9.2 location** (`95f6831`): permission-denied uses `canAskAgain` → `locationDeniedPerm`
  (hard block → Settings) vs `locationUnavailable`.
- **9.3 Quran settings Save/Cancel** (`2df93d9`): `reader-settings-sheet.tsx` stages a
  local draft (seeded on open), applies+persists only on Save, discards on Cancel — so
  changing translation/reciter refetches once, not on every keystroke. New
  `common.save`/`common.cancel`.
- **9.4 adhkar progress** (`c3bc85d`): pinned the progress bar as a static themed header
  (back + title + count + Progress) above the list (was scrolling away inside the FlatList
  header), and hid the duplicate Stack header (Quran-reader pattern).

⚠ **Channel sound is fixed at creation (Android API 26+)** — if `adhan_notify.wav` ever
changes, the "azan" channel must be recreated (uninstall/clear data, or bump the channel
id) for the new sound to take effect.

**All phases 1–9 implemented.** Remaining: **one EAS preview build** batches the
rebuild-gated bits (Phase 3 expo-updates + this adhan sound/asset/`app.json`), then run the
§3 on-device checklist in `mobile_app_feedback_bugs.md` (adhan fires closed + full adhan
foreground; language reload; etc.).

## Prayer/azan accuracy + UI-theme pass (2026-06-17)

User-reported follow-ups, all implemented + verified (mobile typecheck/lint + 17 jest suites /
56 tests green, `expo export` bundle compiles). `android.versionCode` bumped 2→3. Git: the 5
prayer/azan commits are **pushed** (`origin/main` = `d74f9a6`); the A-Z fix + 3 UI commits are
**committed locally, push pending** (`db66f43`/`e2f68f0`/`113c0d6` + `159c0f9`). Needs the same
**one EAS build** as the rebuild-gated bits above (EAS Free cap resets 2026-07-01).

- **Wrong prayer times → first-open onboarding (NEW `features/onboarding/`).** Root cause: the
  app defaulted to Cairo (`DEFAULT_LOCATION`) and never auto-detected GPS. New `use-onboarding`
  (flag `nour.onboarding.done`) + `onboarding-gate.tsx` primer requests location → stores the
  nearest curated city (real fix) → requests notifications → enables adhan + adhkar. Mounted in
  `_layout`. AR/EN `onboarding.*` strings added.
- **Azan only scheduled on the prayer screen → root `components/azan-scheduler.tsx`.** Mounted
  once in `_layout` (mirrors web `AdhanController`), drives `useAzanNotifications` +
  `useAzkarReminders`; the duplicate calls were removed from `app/prayer-times/index.tsx`. NEW
  `lib/settings-bus.ts` (`emitSettingsChanged`/`onSettingsChanged`) keeps the independent
  settings-hook instances in sync (each emits on write, re-reads on event) so an onboarding/
  toggle write reaches the scheduler without a restart; scheduler also re-checks notif
  permission on the bus event + AppState 'active'.
- **Sun/moon boundary → Shrouq→Maghrib.** `getArcPosition` (shared-core) day window changed
  from Fajr→Isha to **sunrise→maghrib**; moon shows Maghrib→next-sunrise. One change covers
  web + mobile. See [[feedback-prayer-times-gotchas]] for the timing-precision facts (instants
  are `HH:MM:00`; exact-on-:00 only in foreground; Android Doze caveat for closed-app).
- **Web closed-tab adhan** (Layer-B Notification Triggers, Chromium-only) now schedules the
  next ~48h, not just today (date-suffixed tags). True cross-browser Web Push (Tier 2) was NOT
  built — large server effort, conflicts with the device-local design.
- **Home A-Z grid blanked** — the A-Z `useMemo` read `a[locale].title` for every row, so one
  row missing its active-locale object threw and blanked the whole grid (newest survived via
  FlatList virtualization). Fixed with a null-safe `titleOf()` in `app/index.tsx` + a `display`
  fallback in `playlist-card.tsx`. (Live prod data is currently clean, so an empty A-Z on
  device ⇒ stale APK or non-prod backend.)
- **UI/theme parity:**
  - **Playlist card** rebuilt to web parity — **circular** scholar avatar (`rounded-full`, 78%
    width) + centered title/scholar-name/track-pill (`playlist-card.tsx`).
  - **NEW `components/screen-header.tsx`** (themed, honors top safe area, optional back chevron)
    replaces React Navigation's **default white header** on `downloads`, `playlist/[slug]`,
    `quran/bookmarks` (all now `headerShown:false`). **Pattern for future screens: prefer
    `headerShown:false` + `<ScreenHeader>` over the native header.** Downloads empty state got
    `bg-bg`.
  - **Quran index** `pt-4`→`pt-16` (title was under the status-bar icons). **Reader-settings
    modal** Save/Cancel row got `paddingBottom: insets.bottom + 12` (was under the Android nav).

## Closed-app adhan exact-alarm fix (2026-06-18)

**Symptom:** adhan never fired at the prayer time when the app was closed; opening the
app fired it immediately (Fajr 4:08 → silence → opened at 4:35 → adhan played).

**Root cause (NOT a scheduling-logic bug):** the notification *was* scheduled and *did*
fire — ~27 min late. expo-notifications' Android scheduler
(`ExpoSchedulingDelegate.kt`) only uses an **exact** alarm
(`setExactAndAllowWhileIdle`) when `alarmManager.canScheduleExactAlarms()` is true,
which requires the `SCHEDULE_EXACT_ALARM` / `USE_EXACT_ALARM` permission. The app
declared **neither**, so it fell back to **inexact** `setAndAllowWhileIdle`, which Doze
batches/defers until the device next wakes. The 4:35 fire was the foreground adhan
(`use-foreground-adhan.ts`, live-delivery listener only — no replay-on-open) catching the
deferred notification on unlock.

**Fix (rebuild-gated — needs one EAS build):**
- `app.json` `android.permissions` += `SCHEDULE_EXACT_ALARM` + `USE_EXACT_ALARM`
  (USE_EXACT_ALARM auto-grants on Android 13+, no prompt; legit for an adhan/alarm).
  `versionCode` 3 → 4. **This is the actual fix** — flips the scheduler to exact.
- **Battery optimization** (compounding factor — OEMs kill alarms even when exact): new
  `lib/battery-optimization.ts` (`expo-intent-launcher ~56.0.4`, ADR 0007) opens the
  battery-opt settings; offered once in the onboarding gate after notif permission. We use
  the no-permission `IGNORE_BATTERY_OPTIMIZATION_SETTINGS` list screen (not the
  Play-restricted one-tap REQUEST dialog).
- **Verify helper:** `scheduleTestAzan()` in `use-azan-notifications.ts` + a "Test adhan
  (1 min)" ghost button on the prayer-times screen (shown when notifs granted + adhan on).
  Schedules a one-off azan 60s out via the identical exact-alarm path; lock the phone to
  confirm it fires on time. Uses identifier `nour-azan-9-dhuhr` (offset 9 never collides
  with the real 0/1 schedule; `dhuhr` key plays the foreground adhan too).
- ⚠️ **Re-verify the exact-vs-inexact branch on any expo-notifications bump.** Play Store:
  `USE_EXACT_ALARM` is review-scrutinized but allowed for prayer/alarm apps — fine while
  sideloading the preview APK; revisit at publish.
- **Test device is now a Samsung Galaxy A72 (Android 13)**, not the old Huawei CMA-LX2.
  Samsung "Sleeping apps" / "Deep sleeping apps" is the relevant battery killer.

## Home UI fixes + "All" sort default (2026-06-18)

JS-only (no rebuild needed beyond the adhan one above). From an on-device screenshot:
- **Playlist-card avatar overlapped the next section.** Root cause: Android does NOT
  reliably clip a child `<Image>` to a parent View's `overflow-hidden` + `borderRadius`,
  so the circular avatar bled out of the card into the `mt-8` "Continue listening" shelf.
  Fix: apply `aspect-square w-[78%] rounded-full` **directly to the `Cover` image/fallback**
  (`playlist-card.tsx`) — no wrapping overflow-hidden View. RN Image clips its own radius.
  **Pattern: never rely on a parent View's overflow-hidden to round a child Image on Android.**
- **Cards were near-invisible** — `bg-surface` (#1c1915) barely lifts off `bg-bg` (#0f0d0a).
  Bumped the card to `bg-surface-2` (#252018).
- **Hero text clipped under the status bar on scroll** — screens render edge-to-edge under a
  transparent status bar (no global `<StatusBar>`/top SafeAreaView; per-screen `pt-16`).
  Home now uses `useSafeAreaInsets()` top padding + an **opaque `bg-bg` scrim** (absolute,
  `height: insets.top`, `pointerEvents="none"`) so scrolled content hides behind the status
  bar. Other screens still use `pt-16` — promote the scrim pattern if they report the same.
- **Sort row gained "All" (الكل) as the new DEFAULT** (`sort-select.tsx` SORT_OPTIONS, home
  `useState<SortOption>("all")`). "all" = no reordering (original API order); the others sort
  the same full list — none filter rows out. The category "All" pill already existed but only
  renders when categories are seeded. Strings: `home.sort.all` in both locales.

## Card overflow (real fix) + battery one-tap dialog (2026-06-18, second pass)

On-device follow-up: the f706248 card fix shipped (the "All" sort it added was visible on
device) but the home cards were **still** broken, and the battery-opt screen didn't list Nour.

- **Playlist-card avatar STILL overflowed** despite f706248. f706248 fixed avatar *clipping*
  (radius moved onto the `<Image>`) but not *sizing*: an `<Image>` with a **percentage width**
  (`w-[78%]`) + `aspect-square` does NOT reliably contribute its derived height to the parent
  flex pass inside the `numColumns=2` row, so the `bg-surface-2` card measured short and — RN
  default `overflow:visible` — the avatar painted past the box into the shelf below. Real fix
  (`playlist-card.tsx`): a plain **sizing wrapper `View`** carries the definite `w-[78%]
  aspect-square`; the image fills it (`h-full w-full`) and clips itself (`rounded-full`). No
  parent `overflow-hidden`. **Pattern: for a responsive square image in RN flex, put
  width%+aspectRatio on a wrapper View (reliable), not on the Image (intrinsic-size interferes).**
  JS-only → can ride the next rebuild OR ship via `eas update` (EAS Update is configured).
- **Battery-opt screen didn't show Nour.** `IGNORE_BATTERY_OPTIMIZATION_SETTINGS` opens the
  system list that by default lists only apps ALREADY exempted, so a fresh install can't find
  Nour to enable it. `lib/battery-optimization.ts` now PREFERS the package-targeted one-tap
  `REQUEST_IGNORE_BATTERY_OPTIMIZATIONS` dialog (`{ data: "package:com.nour.mobile" }`), falling
  back to the list screen then app settings. Needs the `REQUEST_IGNORE_BATTERY_OPTIMIZATIONS`
  permission (added to `app.json` `android.permissions`; Play-restricted but fine for the
  sideloaded preview APK — same "revisit at publish" caveat as `USE_EXACT_ALARM`). Verified the
  action string + `data` param + native `intent.data` wiring against expo-intent-launcher 56.0.4.
  **Rebuild-gated** (new permission). `versionCode` 4 → 5.

## 2026-06-19 session (on-device follow-ups + Arabic default + new adhkar)

All JS/shared-core/data — ship via the same OTA/seed (no native rebuild beyond the
still-pending adhan one). Commits on local `main`, NOT pushed.

- **OTA env/cache trap (READ FIRST if `eas update` breaks the app).** `eas update`
  inlines `EXPO_PUBLIC_*` at bundle time but does NOT auto-load the EAS `preview`
  environment, AND Metro caches the inlined value. Two failures this session both
  showed "something went wrong" on every screen (localhost baked in). Fix: created
  `apps/mobile/.env.local` (gitignored) with `EXPO_PUBLIC_API_BASE_URL=https://nour-platform-web.vercel.app`,
  and ALWAYS publish with `eas update --branch preview --clear-cache`. Apply on device:
  open → wait ~20s (bg download) → hard-close → reopen (applies on the NEXT launch).
  Verify a bundle's baked URL: `npx expo export --platform android --clear` then
  `grep -ao "vercel.app\|localhost:3000" dist/_expo/static/js/android/*.hbc`.
- **Home grid card overlap (real fix).** The avatar-overflow fix (`5b09bd3`, wrapper
  View sizing) was necessary but the cards STILL overlapped on first paint / after
  re-navigation, fixing only on a filter change — the classic **`numColumns` FlatList
  re-layout bug** (cell positions computed once while the `ListHeaderComponent` is
  still growing, because `PrayerTimesWidget` returns null until `usePrayerSettings`
  hydrates). `app/index.tsx` now uses a **`ScrollView` + `flex-row flex-wrap gap-3`
  (`w-[48%]`) grid** (same layout the skeleton uses). **Pattern: don't pair numColumns
  FlatList with a dynamic-height header; use ScrollView+flex-wrap for small home grids.**
- **App-wide lag fix.** The home `PrayerTimesWidget` AND `app/prayer-times/index.tsx`
  each ran an unconditional `setInterval(1000)` recomputing `computePrayerTimes`; both
  screens stay MOUNTED in the expo-router stack after navigation, so the ticks fired on
  every screen. Both now `useFocusEffect`-gated; the widget's `getUpcomingPrayer` dropped
  to per-minute (countdown stays live via target time). **Pattern: any interval/expensive
  recompute in a screen MUST be `useFocusEffect`-gated.** Tests' `expo-router` mocks need a
  `useFocusEffect` shim (`(cb) => mockUseEffect(cb, [])`, with `import { useEffect as
  mockUseEffect } from "react"` — NOT `require()`, which the lint rule forbids in `.tsx`).
- **Dock spacing trimmed** (`use-dock-spacing.ts`): tab 64→52, mini 60, base gap 16→8
  (dock is an opaque overlay; content only needs to clear it). Smaller end-of-page margin.
- **Battery-opt one-tap dialog** (`lib/battery-optimization.ts`): prefers the
  package-targeted `REQUEST_IGNORE_BATTERY_OPTIMIZATIONS` dialog (the list screen only
  shows already-exempted apps, so Nour wasn't findable). Added the
  `REQUEST_IGNORE_BATTERY_OPTIMIZATIONS` permission to `app.json`; **versionCode 4→5**
  (rebuild-gated).
- **Sun-arc moon** now rises ON the Maghrib dot and sets ON the Sunrise/Shrouq dot
  (shared-core `getArcPosition` — daytime back to `getDayProgress`; night interpolates
  Maghrib-dot→Sunrise-dot via `dayTrackFraction`). Covers web + mobile. The arc dots sit
  on the **Fajr(0)→Isha(1)** track, so a body's `fraction` MUST use that anchoring to land
  on a dot. Regression tests in `packages/api/.../prayer-times.service.test.ts`.
- **Shrouq (sunrise) in the home prayer row** on BOTH apps (mobile `ROW_KEYS`, web
  `rowKeys`); informational only — `getUpcomingPrayer`/`COUNTDOWN_ORDER`/`getNextPrayer`
  exclude it and the azan scheduler skips it (no adhan). Full-screen timetable already had it.
- **Prayer-timetable emoji badges** mirror the web (`🌅☀️🌞🌇🌆🌙` in a rounded badge).
- **Arabic = default app language** (`lib/i18n.ts`): `initialLocale` now starts from
  `DEFAULT_LOCALE` ("ar"), not the device locale (removed the expo-localization lookup);
  the persisted LocaleSwitcher choice still overrides via `hydrateLocale()`. ⚠️ **`jest.setup.js`
  now PINS the test env to English** (`jest.mock("@/lib/i18n", () => ({ __esModule:true,
  ...actual, default: actual.default, initialLocale:"en" }))` + `changeLanguage("en")`) — the
  `__esModule:true` + explicit `default` are REQUIRED or `import i18n from "@/lib/i18n"` loses
  its methods (`changeLanguage is not a function`). New screen tests assert UI/content in English.
- **4 new adhkar collections** (`kind:"other"`): أذكار النوم / الإستيقاظ / المسجد / الصلاة,
  authored in `scripts/data/adhkar-data.ts` (ar+en+source; Qur'anic items reused verbatim from
  `MORNING_ITEMS` via `quranFromMorning()`) + wired into `scripts/seed-adhkar.ts` SETS with
  ar/en titles. ⚠️ **Adhkar are HTTP-served from MongoDB — content only appears after running
  `pnpm seed:adhkar` against the DB** (isolated upsert by ar-slug; not OTA/app-code). Review the
  Arabic before the prod seed.

## 2026-06-21 session (moon arc / adhan pieces / city i18n / Aladhan API)

7 commits unpushed to origin (`e01d337`→`f322421`). Mix of JS-only (OTA) and rebuild-gated.

### Moon two-axis fix — shared-core `compute.ts` + both sun-arc components (`e01d337`, `a92eb8b`)
`getArcPosition` returns `{ isNight, onNightBand, fraction }`. Night split into 3 legs:
- **Dusk (Maghrib→Isha):** moon on the DAY arc (`onNightBand:false`), fraction interpolates
  between the Maghrib dot and the Isha dot — seamless handoff where the sun set.
- **Night (Isha→tomorrow Sunrise):** moon drops to the lower night band (`onNightBand:true`).
- **Pre-dawn (yesterday Isha→Sunrise):** same night band, finishing on the Sunrise dot.
`SunArc` now lowers to the band on `onNightBand` (new prop, default = `isNight`). Both the
home widget and the prayer-times screen pass `onNightBand={arc.onNightBand}`. Tests in
`packages/shared-core/src/prayer-times/compute.test.ts`. **JS-only → OTA-able.**

### Full adhan via 22 chained notifications (`b4c2f08`) — **REBUILD-GATED**
Samsung/OEM battery managers truncate notification sounds to ~7s. Fix: split the full
127s adhan (`apps/web/public/audio/adhan.mp3`) into 22 × 6s WAV parts
(`assets/audio/adhan_part_{1..22}.wav`, ffmpeg `-ar 22050 -ac 1 -c:a pcm_s16le`), each on
its OWN Android channel (`azan_part_1..22` — channel sound is fixed at creation).
`scheduleAzanNotifications` fires 22 DATE notifications 6s apart per prayer. Part 1 keeps
the bare `nour-azan-{off}-{key}` id (foreground hook matches it → plays full streamed mp3);
parts 2–22 get a `-p{offsetSec}` suffix so they don't re-trigger foreground audio. Part 1
channel `HIGH` importance (heads-up), parts 2–22 `DEFAULT` (sound only, no banner).
⚠️ 22×5×2 = 220 scheduled notifications — watch for Samsung alarm-limit quotas on device.
`app.json` `expo-notifications.sounds` lists all 22 wavs. **Rebuild-gated** (new bundled
wavs + new Android channels — channels can't hot-swap via OTA).

### Web Arabic default (`cb78f97`) — web-only (Vercel redeploy)
`apps/web/i18n/routing.ts`: `localeDetection: false` — root `/` always redirects to `/ar`
regardless of the browser's `Accept-Language` header, mirroring mobile's Arabic-first default.

### City name localization — `prayerLocationSchema` + `cityLabel` (`0ff8176`) — JS-only / OTA
- `packages/shared-core/src/schemas/prayer-times.ts`: added `cityId: z.string().optional()` to
  `prayerLocationSchema`; `DEFAULT_LOCATION` gains `cityId: "cairo"`.
- `apps/mobile/features/prayer-times/data/cities.ts`: new `cityLabel(location, locale)` resolver
  — looks up `cityId` in `CITIES` → returns `city[locale]`, falls back to `location.label` for
  non-curated GPS coordinates.
- 3 setter sites now store `cityId: city.id`: `onboarding-gate.tsx:50`, `location-picker.tsx:31`
  (manual pick), `location-picker.tsx:50` (GPS detect).
- 2 render sites use `cityLabel(location, initialLocale)`: `prayer-times-widget.tsx:101`,
  `app/prayer-times/index.tsx:178`.
- Test: `__tests__/city-label.test.ts` (4 cases: ar/en/missing-id/unknown-id).

### Azan scheduling debounce — first-install race fix (`001c3eb`) — JS-only / OTA
Root cause: onboarding fires 4 rapid `settingsChanged` events (location write, explicit emit,
adhan write, azkar write). Each creates a new `location`/`prefs` object from `hydrate()`,
triggering `useAzanNotifications` effect multiple times. Concurrent `scheduleAzanNotifications`
calls race — one call's cancel-then-schedule loop wipes what the other just scheduled → no adhan
after first install. Fixed by a 350ms `setTimeout` debounce in `useAzanNotifications`: React's
cleanup clears the timer on every re-run so only the final event in a burst schedules.

### Aladhan API integration — accurate prayer times (`f322421`) — JS-only / OTA
`adhan-js` local computation can land ±1 min from official Egyptian Ministry times due to
floating-point. Fix: fetch from `api.aladhan.com/v1/calendar/{year}/{month}` (one request
per month), cache in AsyncStorage keyed `nour.prayer.calendar.{lat.2dp}-{lng.2dp}-{method}-{madhab}-{year}-{month}`.

New files:
- `features/prayer-times/lib/aladhan.ts`: `METHOD_MAP` (Egyptian→5, MWL→3, Karachi→1,
  UmmAlQura→4, Dubai→16, NorthAmerica→2, Kuwait→9, Qatar→10, Singapore→11, Turkey→13,
  Tehran→7), `SCHOOL_MAP` (standard→0, hanafi→1), `fetchMonth`, `loadCached`/`persistMonth`,
  `getPrayerDay(lat, lng, method, madhab, date) → PrayerDay`.
- `features/prayer-times/hooks/use-prayer-day.ts`: `usePrayerDay(lat, lng, method, madhab, date)`
  — returns instant local result, upgrades to Aladhan when cache/network resolves.

Updated consumers:
- `use-azan-notifications.ts`: `scheduleAzanNotifications` now `await getPrayerDay(...)` for
  both today and tomorrow → notifications fire at the authoritative minute.
- `prayer-times-widget.tsx`: `day = usePrayerDay(...)`, `upcoming` derived via
  `getNextPrayer(day, now)` with local-computation fallback for after-Isha → tomorrow's Fajr.
- `app/prayer-times/index.tsx`: same pattern.

Offline fallback: `getPrayerDay` catches all network/parse errors and returns
`computePrayerTimes(...)` so the app works without internet. 8s `AbortController` timeout.
Cache TTL is implicit: year+month in the cache key means January data is never served in February.
First open each month: one network request; all subsequent opens: AsyncStorage hit (<1ms).

### Build status as of 2026-06-21
- **7 commits unpushed** (`e01d337` → `f322421`). Push first, then:
- **OTA** (`eas update --branch preview --clear-cache`): moon fix, city localization, azan
  debounce fix, Aladhan API integration, web Arabic default (via Vercel on push).
- **Rebuild-gated** (`eas build --profile preview --platform android`, awaiting EAS Free
  quota reset **2026-07-01**): 22 adhan WAV parts, 22 Android channels, exact-alarm permissions,
  battery-optimization permission, EAS Update config, `versionCode 5`.
- Mobile test suite: **18 suites / 60 tests** green.

## Closed-app adhan REWRITE — native foreground service (2026-06-26)

**Root cause of "adhan sometimes/never fires (esp. Fajr)" — confirmed live on the Samsung
A72 via `adb`:** the 22-chained-notification full-adhan design (`b4c2f08`) scheduled **22
`setExactAndAllowWhileIdle` notifications per prayer × ~9 instants ≈ 200 wakeup alarms**.
Android meters allow-while-idle wakeups per app (the `requester=+Xm` line in `dumpsys alarm`);
with ~200 alarms the OS defers them — the 04:24 Fajr alarm was **still pending undelivered at
midday**. Ruled out: missing assets (APK was freshly rebuilt via a new Expo org), the
frozen-channel trap (reinstall recreated all 22 `azan_part_*` channels correctly,
`mSoundMissingReason=0`), exact-alarm permission (granted: `exactAllowReason=policy_permission`),
and battery-whitelisting (adb whitelist + bucket-exempt did NOT clear the quota — it's driven
by alarm *count*). Notification *sounds* also can't carry a full closed-app adhan (Samsung ~7s
truncation — the very reason for the 22-part split). adb lives at
`C:\Users\Ahmed Elsaid\adb-tools\platform-tools\adb.exe` (Wireless debugging).

**Fix shipped this session (Android full, iOS best-effort):** ONE exact alarm per prayer
(~10 total, not ~200) that starts a NATIVE foreground service playing the FULL adhan — runs
entirely in native at fire time (no JS/React), reliable in Doze, works for all users without
hand-whitelisting.

- **NEW local Expo module (the repo's FIRST) `modules/nour-adhan/`** — Kotlin, Android-only.
  `expo-module.config.json` registers `com.nour.adhan.NourAdhanModule` (verify discovery with
  `npx expo-modules-autolinking search -p android`). **build.gradle MUST mirror
  expo-intent-launcher: plugins `com.android.library` + `expo-module-gradle-plugin` ONLY** —
  the expo plugin applies Kotlin and androidx.core is transitive; adding an explicit kotlin
  plugin or pinned `androidx.core` dep causes plugin/version conflicts. Pieces:
  - `AdhanScheduler.kt` — `AlarmManager.setExactAndAllowWhileIdle` per prayer; persists the
    schedule to SharedPreferences (base req code 7100, test 7099, MAX_ALARMS 64) so it can
    re-arm after reboot; falls back to inexact only if exact-alarm perm is missing.
  - `AdhanAlarmReceiver.kt` → `startForegroundService` (the alarm grants a ~10s temp
    allowlist, so FGS-start-from-background is permitted).
  - `AdhanPlayerService.kt` — FGS type `mediaPlayback`; `MediaPlayer` on `USAGE_ALARM`
    (sounds on silent/DND), requests audio focus (ducks the RNTP queue), ongoing **Stop**
    notification, `stopSelf` on completion. Fajr uses `adhan_fajr`.
  - `BootReceiver.kt` — re-arms persisted alarms on `BOOT_COMPLETED`.
  - Full `adhan.mp3` + `adhan_fajr.mp3` bundled in
    `modules/nour-adhan/android/src/main/res/raw/` (copied from `apps/web/public/audio`;
    res/raw names MUST be lowercase_underscore). Module manifest declares the service +
    receivers + `FOREGROUND_SERVICE`/`FOREGROUND_SERVICE_MEDIA_PLAYBACK`/`RECEIVE_BOOT_COMPLETED`.
- **JS:** `lib/adhan-native.ts` (`requireOptionalNativeModule("NourAdhan")`, no-op on iOS).
  `use-azan-notifications.ts` rewired — `buildAdhanInstants` (exported for tests; reuses
  `getPrayerDay`, drops sunrise/past/**per-prayer-disabled** — also fixes the old bug where
  `perPrayer` was ignored) → Android `AdhanNative.scheduleAll`; iOS = one expo-notification per
  prayer with the ≤30s `adhan_notify.wav` (Apple's ceiling). `scheduleTestAzan` → `playTest(60s)`
  on Android. `useAzanNotifications` now takes `perPrayer`+`volume` (`azan-scheduler.tsx`
  updated). `lib/notifications.ts` reduced to the foreground handler + `IOS_AZAN_SOUND`/
  `AZAN_PREFIX` (removed `AZAN_PIECES`/`ensureAzanChannel`/22 channels). `use-foreground-adhan.ts`
  is now **iOS-only** (`Platform.OS!=="ios"` early-return; Android FG adhan is the native
  service via audio focus). `app.json`: `sounds` → just `adhan_notify.wav`, **versionCode 5→6**.
  Deleted the 22 `assets/audio/adhan_part_*.wav`. Added `apps/mobile/.easignore`
  (excludes web audio / admin / docs from EAS uploads).
- ⚠ **Gotcha:** a non-hook helper must NOT be named `use*` — `react-hooks/rules-of-hooks`
  fired on a plain `useNativeAdhan()` helper (renamed `nativeAdhanActive`).
- **Local gates GREEN:** typecheck, lint, jest **19 suites / 63 tests** (new
  `__tests__/azan-scheduler.test.ts`), `expo export --platform android`, autolinking discovery.
- **REMAINING (device-only, needs one EAS build on the new org):** Kotlin compile + on-device:
  clean install → **"Test adhan (1 min)"** locked → full adhan plays; `dumpsys alarm | grep -c
  nour` ≈10 not ~200; force Doze (`adb shell dumpsys deviceidle force-idle`) and confirm a
  near-term prayer fires full-length; reboot re-arm; RNTP music ducks/resumes.

## iOS adhan — Critical Alerts (2026-07-01)

**iOS has no equivalent of the Android native-service design above** — no `AlarmManager`,
no way to wake a killed app or start a service at a scheduled time, and a scheduled local
notification can only carry a bundled sound **≤30s** (Apple's hard ceiling, not a code gap).
So iOS keeps its existing two-tier design (closed-app: one `≤30s adhan_notify.wav`
notification per prayer; foreground: full adhan via `use-foreground-adhan.ts`) and closes the
one real gap vs Android — a plain notification sound is silenced by the Silent switch/Focus/DND,
where Android's `USAGE_ALARM` isn't.

- **`app.json` `ios.entitlements`**: `com.apple.developer.usernotifications.critical-alerts: true`.
- **`use-azan-notifications.ts`**: `requestNotificationPermission` now also requests
  `allowCriticalAlerts: true`; both the real schedule and `scheduleTestAzan` set
  `interruptionLevel: "critical"` on the iOS notification content.
- **Not self-service**: `com.apple.developer.usernotifications.critical-alerts` requires an
  Apple Developer Program membership + a support-form request to Apple justifying the
  prayer/alarm use case, then must be baked into the provisioning profile EAS builds with.
  Until granted, `interruptionLevel: "critical"` and `allowCriticalAlerts` degrade silently to
  a normal notification (no crash, no DND-piercing) — the code is correct either way.
- Tests: `__tests__/azan-scheduler.test.ts` "iOS Critical Alerts" block asserts both the
  permission request shape and `interruptionLevel:"critical"` on the scheduled content
  (jest-expo defaults `Platform.OS` to `"ios"`, so `scheduleTestAzan`/the exported helpers
  exercise this branch directly without mocking Platform).
- **Remaining (device + Apple account only)**: request the entitlement from Apple, build with
  a Critical-Alerts-enabled profile, verify on a real device with Silent on + a Focus enabled
  (simulator doesn't play notification sounds).

## Play-Store pre-publish audit + hardening (2026-07-03)

Full production-readiness sweep before the first Google Play submission. Three parallel
read-only subagent audits — **performance**, **crash-safety**, **store/build readiness** — all
returned **GO with NO code blockers**; the app was already code-complete and gate-green. Two
commits landed (`beb96c2` fix + `513809d` chore, PUSHED to `origin/main`). Full gate re-verified:
**tsc 0 · lint 0 · 23 suites / 76 tests**.

**Audit conclusions (don't re-explore — these areas were checked and are CLEAN):**
- **Timers/effects**: every `setInterval`/`setTimeout` is `useFocusEffect`-gated or cleared;
  RNTP listeners use `useTrackPlayerEvents` (auto-unsub); sleep-fade/live-retry timers clear on
  unmount. No leaks.
- **Lists virtualized**: Quran index + reader, adhkar reader, playlist detail all use `FlatList`
  + `keyExtractor`. (Home grid is a deliberate `ScrollView`+flex-wrap — the documented numColumns
  fix; fine while the catalog is small.)
- **AsyncStorage**: `device-local.ts` generic `read<T>` + `player-context` readers all try/catch
  + type-validate → corrupt storage degrades to defaults, never throws. Exemplary.
- **Native call sites guarded**: onboarding (location/magnetometer), location-picker,
  battery-optimization, downloads, foreground-adhan, player load — all try/catch or `.catch`.
- **No debug residue**: zero `console.*` / TODO / FIXME / hardcoded test URLs in app code (only
  the intentional `lib/api.ts:4` localhost fallback). The "Test adhan (1 min)" button is a
  deliberate user-facing verify feature, not dev-only.
- **Config correct**: `app.json` package `com.nour.mobile`, version `1.0.0`, versionCode `6`,
  newArch, scheme `nour`, EAS Update (`runtimeVersion:appVersion` + `updates.url`), all assets
  present. `eas.json` production builds an **AAB** on `production` channel + valid submit block.
  `.easignore` excludes web audio/admin/docs. RNTP pins to exactly `4.1.2` (patch applies).

**Fixes applied this pass:**
- **Root `ErrorBoundary`** exported from `app/_layout.tsx` — expo-router auto-mounts it, so any
  render throw becomes a themed recoverable retry screen (`common.error`/`common.retry`) instead
  of a native white-screen on release. This is the systemic net for the locale-deref class below.
- **Embedded-locale `?? .ar ?? .en` fallbacks** propagated to the `obj[locale]` derefs the author
  hadn't guarded (the schema makes `ar`/`en` REQUIRED, so the fallback is the proven-green idiom
  from `playlist-card.tsx:27`, typechecks clean): `app/index.tsx` categories (`flatMap` drops
  malformed rows), `app/playlist/[slug].tsx` (category chips + `queueTracks` + `downloadAll` +
  header `display` + the 3 track-row `title` sites), `app/adhkar/index.tsx` (renderItem returns
  null if absent), `app/adhkar/[slug].tsx`. Prod data is currently clean so these never fired, but
  they're now consistent + non-fatal. `noUncheckedIndexedAccess` does NOT catch `obj[locale]`
  (keyed union access is typed as always-defined) — this is a runtime-only guard.
- **`runTestAdhan` try/catch** (`app/prayer-times/index.tsx`) — the documented latent silent
  reject (native module absent / `ReactContextLost`) now surfaces an error Alert (was the user's
  original "nothing happened").
- **`.gitignore`** now ignores `google-play-key.json` / `*google-play*.json` — the runbook places
  the Play service-account key there (referenced by `eas.json` submit) but it wasn't ignored.

**Pre-build checks the audit flagged (NOT code — do before `eas build --profile production`):**
1. `eas env:list --environment production` MUST show
   `EXPO_PUBLIC_API_BASE_URL=https://nour-platform-web.vercel.app` — else the AAB bakes
   `localhost` → blank app. (The `production` build profile has no explicit `environment` key and
   no inline var; it relies on default env resolution. Adding `"environment":"production"` to
   `build.production` in `eas.json` would make it explicit — a safe nice-to-have.)
2. **Play Console**: declare the restricted permissions (`USE_EXACT_ALARM`,
   `REQUEST_IGNORE_BATTERY_OPTIMIZATIONS`) as prayer/alarm justification + fill the Data-safety
   form (collects **location** + schedules **local notifications**; no accounts/analytics/ads,
   all state device-local). Privacy policy: `https://nour-platform-web.vercel.app/privacy` (200).

**✅ Perf cascade fix DONE (`715411a`, 2026-07-03)** — user reported the app was "very very slow"
(nav + radio play/stop). Root cause: `useProgress(250)` (player-context `:321`) fed
`currentTime`/`duration` into the main context `value` memo, so the whole context object rebuilt
~4×/sec during playback. Every `usePlayer()` consumer re-rendered on each tick — incl.
`useDockSpacing()`, which Home + every list screen call; expo-router keeps screens **mounted**, so a
live radio stream (infinite) re-rendered the whole tree 4×/sec forever → JS-thread starvation → laggy
nav + play/stop. Fix: `currentTime`/`duration` moved OUT of `PlayerContextValue` into a separate
**`PlayerProgressContext`** with a `usePlayerProgress()` hook, consumed ONLY by `mini-player.tsx` +
`app/player.tsx` (the two progress-bar surfaces). `usePlayer()` no longer changes on the tick.
`PlayerProvider` now nests `<PlayerContext.Provider><PlayerProgressContext.Provider>`; tests use the
real provider so both are supplied. **Pattern: keep any high-frequency (per-frame/per-tick) value in
its own context — never in a broadly-consumed one.**
- **✅ Nav re-render storm ALSO fixed (`6400a6e`)** — after the cascade fix the user still felt tab-switch
  lag ("page opens, THEN the pill moves"). `useDockSpacing()` (`lib/use-dock-spacing.ts`) called
  `usePathname()`, and it's used by Home/Quran/Adhkar/Playlist/Downloads/radio — all kept MOUNTED by
  expo-router — so EVERY navigation re-rendered ALL of them synchronously → JS-thread storm → janky
  switch + delayed pill. The pathname only shrank the pad on the `/player` modal (never rendered by this
  hook; bg screens hidden behind the modal anyway). Fix = drop `usePathname`; depends only on insets +
  `hasQueue`. **Pattern: never call `usePathname()`/route-subscribing hooks from a hook used by
  always-mounted screens.** The tab-bar pill is already `useNativeDriver:true` (not the bottleneck).
- ⚠️ **Secondary suspect for "radio stop takes a long while" (NOT yet fixed — verify on device after
  the cascade fix):** the live-stream auto-retry in `player-context.tsx` (`Event.PlaybackError`
  handler, ~`:420`) resumes playback on ANY live PlaybackError **regardless of user intent** — if
  pausing/stopping a live stream emits an error, the retry timer (≤2.4s backoff) could resurrect it.
  If stop is still laggy once the cascade fix is on-device, gate the retry on a "user wants playback"
  ref. Radio START latency is mostly inherent live-stream buffering (DNS/TLS/buffer) + cold-connect
  5xx retry — not a render bug.
- Still open (nice-to-have, not a blocker): no `React.memo` anywhere — wrapping `AyahRow`/`PlaylistCard`
  is cheap insurance (but on Home, `app/index.tsx` passes a fresh `categories` array per render, so
  memoize the per-card lookup too).

## iOS release readiness (2026-07-03)

**iOS is NOT production-ready** (Android is GO). The app is cross-platform + iOS-*aware*, but
has **never been built, never run on a simulator/device, and there is no Apple Developer
account** — a separate mini-project gated on account + build + device QA, not missing code.

- **In place** (verified): `app.json` `ios` = `bundleIdentifier com.nour.mobile`,
  `UIBackgroundModes:["audio"]`, `supportsTablet`, `critical-alerts` entitlement; icon is
  flattened opaque RGB (App Store rejects alpha). `eas.json` = `build.production.ios`
  distribution `store`, `build.preview.ios` simulator, `submit.production.ios` reading
  `APPLE_ID`/`APPLE_TEAM_ID` env. Critical Alerts code degrades gracefully until Apple grants
  the entitlement (see "iOS adhan — Critical Alerts").
- **Gaps before a build**: no `ios.buildNumber`; `APPLE_ID`/`APPLE_TEAM_ID`/`ascAppId` unset;
  no `ITSAppUsesNonExemptEncryption:false` (export compliance); `EXPO_PUBLIC_API_BASE_URL` must
  be in the EAS `production` env. Blockers: **$99/yr Apple account**, first build, on-device
  verification, and the non-self-service Critical Alerts entitlement request.
- **iOS functional reality**: closed-app adhan is weaker by design — no
  `AlarmManager`/foreground-service (the native `modules/nour-adhan/` is Android-only); iOS =
  ≤30s notification clip closed-app, full adhan only foreground via `use-foreground-adhan.ts`.
- **Full step-by-step iOS runbook** (enroll → ASC record → credentials → simulator smoke →
  export-compliance → Critical Alerts request → production build/TestFlight → App Store review):
  see `apps/mobile/publish_play_store.md` → "Publish Nour Mobile to the Apple App Store (iOS)".

## 2026-07-05 — Quran audio-overlap fix + EAS project migration

- **Quran reader ayah-overlap FIXED (`1c7e7df`)**: each `Reader` owns its own expo-audio player
  that kept playing after blur; re-entering from the home Readers shelf spun up a 2nd player →
  overlapping recitations. Fix: `useFocusEffect(useCallback(() => () => stopAyah(), [stopAyah]))`
  in `features/quran/components/reader.tsx` (stops on blur AND unmount).
- **EAS project MIGRATED to personal account (`8bfbf3b`)**: `app.json` `owner`
  `volunteering-apps`→`ahmedmuhammedelsaid`, new `projectId`/`updates.url` (`e95180e7-…`).
  ✅ **New project's EAS env verified 2026-07-05: `EXPO_PUBLIC_API_BASE_URL=https://nour-platform-web.vercel.app`
  is set on BOTH `production` and `preview`** (was empty right after migration). `eas.json`
  credentials/`ascAppId` are per-project too. `publish_play_store.md` still names the OLD
  `volunteering-apps/nour-platform` project — update when you next touch it.
- **Radio + Readers-shelf risk review (2026-07-03, subagent): NO blockers.** Endpoints verified
  live (`/api/v1/quran/reciters` 13 rows, `/api/v1/radio` 7 stations, all streams HTTPS);
  `isLive` path skips seek/resume/duration; malformed-row guards present. Two cosmetic
  post-launch follow-ups: (a) saved playback-rate (e.g. 1.5x) is applied to live streams at load
  (`player-context.tsx` setRate at load) → stalls at the live edge; (b) `recordRecentlyPlayed`
  runs for radio → no-op rows in Home "Continue listening".

## Verify before shipping

```bash
cd apps/mobile
pnpm typecheck && pnpm lint && pnpm test
npx expo export --platform android   # confirms the JS bundle compiles
```
Device checklist + build/submit steps: see `apps/mobile/deploy.md`.

## Qibla compass — native module (2026-07-05, `5164083`, PUSHED, REBUILD-GATED)

Went through JS sensor attempts (Magnetometer, DeviceMotion, `Location.watchHeadingAsync`)
and a WebView (ADR 0010, failed to load on RN 0.85 New-Arch) before landing on the
correct fix: a local Expo native module **`modules/nour-compass`** (mirrors `nour-adhan`)
reading the **fused rotation-vector sensor** — the same one browsers use, so it doesn't
suffer raw-magnetometer "accuracy 0". Android `TYPE_ROTATION_VECTOR` + `GeomagneticField`
declination → `trueHeading`; iOS `CMMotionManager .xTrueNorthZVertical`. JS bridge
`lib/compass-native.ts` (safe no-op if native module absent) → `use-compass-heading.ts`
feeds a reanimated SharedValue → UI-thread SVG rotation in `qibla-compass.tsx` (GPU,
no per-sample re-render — that render-path fix is what made it *smooth*; the native
sensor swap is what makes it *accurate*). ADR `docs/adr/0011` (supersedes 0010).
**Needs `eas build` (not OTA) to test — module absent on OTA shows the static dial.**
Kotlin/Swift only compile at EAS build time; unverified on-device as of this write.
See [[project_qibla_feature]] for the full attempt history/gotchas.

## Prayer arc/countdown web-parity pass (2026-07-04/05) — JS-only, OTA-able

`a62d47f`..`0eb6b76`, all pushed. User-driven mirror-to-web pass on the Home widget
(`prayer-times-widget.tsx`) + full screen (`app/prayer-times/index.tsx`) + shared
`sun-arc.tsx`.

- **Next-prayer row**: was a vertical stack; now one `flex-row items-baseline` row,
  DOM order `[label, name, countdown]` — auto-mirrors under `I18nManager.forceRTL`
  (AR shows countdown/name/label, EN shows label/name/countdown), matching web's
  `PrayerCountdown`. Dropped the extra "· at HH:MM" suffix on the full screen.
- **Arc dot labels — 4 iterative fixes, now settled:**
  1. Switched from react-native-svg `<Text>` (does NOT shape/join Arabic — glyphs
     rendered disconnected) to a real RN `<Text>` overlaid on the `<Svg>` via a
     `StyleSheet.absoluteFill` view. Enabled `showLabels` on the Home widget too
     (web hides them below `sm`; mobile shows them always per explicit request).
  2. Under `I18nManager.forceRTL`, Yoga mirrors the overlay's absolute `left%`/
     `transform` — labels landed on the wrong side. Fix: force the overlay
     `<View style={{direction:"ltr"}}>` so `left`/margins stay physical.
  3. Percentage `translateX` centering resolved inconsistently under forced RTL
     (shifted labels left of their dot) — replaced with a fixed-width box
     (`LABEL_BOX=96`) + numeric `marginLeft: -48` + `textAlign:"center"`.
  4. An `i%2` stagger (added to dodge collisions) made vertical gaps inconsistent
     per-dot. Removed it — now one constant lift matching web's exact recipe
     (`isNext ? 24 : 14`, same viewBox units as `apps/web/.../sun-arc.tsx`).
- **Pattern for next time**: any RN-SVG arc/overlay needs (a) RN `<Text>` for
  Arabic, (b) `direction:"ltr"` on the overlay under forced RTL, (c) numeric
  margins not percentage transforms, (d) match web's constant offsets rather than
  inventing per-index staggers. See [[project_mobile_sun_arc_bloom]].

## Qibla native compass + prayer countdown fixes (2026-07-06, PUSHED, OTA `preview`)

Native `nour-compass` module verified on-device for the first time (see
[[project_qibla_feature]] for the full attempt/root-cause log). Summary: (1)
per-sample `withTiming` caused a lagged/stuck needle → direct SharedValue
assignment; (2) raw ~33Hz sensor noise then looked jittery → EMA smoothing
(`alpha=0.3`); (3) aligned-state glow/pulse/ping added to `qibla-compass.tsx`
(mirrors web, reuses the sun-arc corona `withRepeat` pattern) + z-order fix
(pointer now draws below the rotating dial, matching web); (4) "Facing Qibla"
text recolored to `text-primary` (gold) + pulses in sync.

**nour-compass Android build fix** (`29f0599`, committed on `main`, NOT pushed, 2026-07-06): first EAS Android build failed at `:nour-compass:compileReleaseKotlin` — bare `return@Function` is illegal under Kotlin 2.1.20 K2 because the zero-arg `Function(name){}` overload is `body: () -> Any?` (must return a value). Fix = restructure `start`/`stop` to `if`-blocks (no bare returns). Rule: never bare-`return@Function`/`return@AsyncFunction` in an Expo Kotlin module. Needs a fresh `eas build` to confirm green (EAS quota ~15/mo).

**Prayer countdown freeze fixed** (`prayer-times/index.tsx` +
`prayer-times-widget.tsx`): the full screen displayed
`formatCountdownClock(upcoming.msUntil, locale)` where `msUntil` is baked in
once inside `getNextPrayer`, and the `useMemo` deps (`[day, now.toDateString()]`)
only recomputed once per calendar day — the countdown was frozen almost all
day. New `features/prayer-times/components/prayer-countdown.tsx` (mirrors
web's `PrayerCountdown`) is an isolated leaf owning its own 1s tick, computing
`target - now` fresh every render; used by both surfaces. Also added the
missing per-minute memo dependency on the full screen (widget already had it).
**Follow-up refinement (`a4913a3`):** BOTH the full screen's and the Home
widget's own `now` tick were dropped 1s→60s (`setInterval(..., 60_000)`),
since the isolated `<PrayerCountdown>` leaf owns the only per-second tick
actually needed — the parents only need minute-granularity for the arc body/
upcoming-key.

## Pre-Play-Store perf pass #2 — live-radio correctness + render insurance (2026-07-06)

User reported the app still felt slow everywhere post-launch-audit; investigated live via an
`eas update` OTA (not a rebuild) since the app was already release-mode on device. Three fixes,
all pushed to `main` (`a4913a3`, `531fd22`, `ea82e2c`), OTA-published to the `preview` channel,
device-verified working by the owner:

1. **Prayer-tick throttle** — see above.
2. **Live-radio retry/rate/recents correctness (`531fd22`)** — root cause of "radio stop takes a
   while": the live-stream `PlaybackError` auto-retry (`player-context.tsx`) resumed playback on
   ANY error regardless of user intent, including a connection drop caused by the user's own
   pause/stop; an already-armed retry timer could also fire minutes after a later pause (found
   in review, not the first pass). New `lib/playback-intent.ts` singleton
   (`getUserWantsPlayback`/`setUserWantsPlayback`) is written by every JS control
   (play/pause/toggle/retry/load-effect/sleep-fade) AND the lock-screen remote handlers
   (`playback-service.ts` Remote Play/Pause/Stop) — the retry path checks it both when arming
   and at fire time. Same review pass also found a saved non-1x rate was applied to a live
   stream on load AND via the Now-Playing speed chips (stalls the live edge — both paths now
   skip `TrackPlayer.setRate` for `isLive`), and live sessions wrote no-op rows into
   recently-played (now skipped). Regression tests in `__tests__/player-context-retry.test.tsx`.
3. **Render insurance (`ea82e2c`)** — `PlaylistCard` wrapped in `React.memo`; Home's per-card
   `categories` prop was previously a fresh array literal every render (defeats memo), now built
   once into a `Map` keyed by playlist id alongside the existing `visible`/`categoryById` memos.

**Verification:** full mobile jest standalone 24 suites (only the documented `home-screen`
cold-cache flake, pre-existing, unrelated), typecheck/lint clean, `expo export --platform
android` compiles. Published via `eas update --branch preview --environment preview
--clear-cache` (NOT a rebuild — same `versionCode 6` binary, runtime version 1.0.0 matches).
**`versionCode` bumped 6→7 (`f1399b5`, chore, committed NOT pushed).** Full monorepo
`turbo run lint typecheck test build` re-verified green after the bump (only the documented
`home-screen` flake). **A fresh `eas build` (production profile, for the actual Play Store AAB —
no production build has ever been made, only `preview` APKs) is still the one pending step,
deliberately deferred by the owner.**

## Radio/player: pause on force-close + restore controls on reopen (2026-07-07, JS-only, OTA-able)

**Bug (owner-reported):** play a radio station → force-close the app (swipe from recents) →
audio kept playing headlessly, and on reopen the in-app mini-player was **gone**, so there was
no way to stop it from inside the app.

**Root cause:** `PlayerProvider` (`lib/player-context.tsx`) holds `queue`/`currentIndex` in React
state, which resets to empty on every fresh JS boot; `mini-player.tsx:46` gates on `hasQueue`, so
after an app kill (JS context wiped, native RNTP service survives) the mini-player never rendered.
`setupPlayer()` also never set `android.appKilledPlaybackBehavior` → RNTP default `ContinuePlayback`
kept the audio alive. Nothing persisted the now-playing queue (only prefs/positions/recent).

**Fix (owner chose "pause on force-close + restore controls"), all in `lib/player-context.tsx`:**
- `updateOptions({ android: { appKilledPlaybackBehavior: AppKilledPlaybackBehavior.PausePlayback } })`
  — swiping the app away now **pauses** (notification stays, native session survives paused).
- New `SESSION_KEY = "nour.player.session"` persists `{ queue, index }` (full `QueueTrack`, so
  `isLive` survives) via a persist effect gated on a `sessionHydratedRef` so the empty boot state
  can't clobber a surviving session before it's read.
- An **adopt-on-mount** effect: after `setupPlayer()`, if `TrackPlayer.getActiveTrackIndex()` shows a
  surviving native track, it reads the persisted session (fallback: reconstruct from
  `getQueue()` via `nativeToQueueTrack`, loses `isLive`) and rehydrates `queue`/`currentIndex` so the
  mini-player returns. A one-shot `skipNextLoadRef` makes the existing `[currentIndex, queue]` load
  effect bail once, so it does **not** `reset()`+`add()`+`play()` (which would restart/hiccup the
  stream). `setUserWantsPlayback` reflects the real native state (paused after a kill).
- A stale session is harmless: it's only ever *read* when `getActiveTrackIndex()` returns a live
  index, so a leftover session from a fully-closed app (RNTP gone) never makes a phantom player.

**Tests:** extended the `jest.setup.js` RNTP mock (`getActiveTrackIndex`/`getQueue`/`getPlaybackState`
defaults + `AppKilledPlaybackBehavior` enum) + new `__tests__/player-context-session.test.tsx` (4
tests: pause-playback configured; session persisted on `loadQueue`; rehydrate-without-reset/add on
reopen; no phantom player on a cold start). Gate green: typecheck/lint clean, 24/25 suites (only the
documented `home-screen` cold-cache flake), `expo export --platform android` compiles. **Purely JS →
OTA-shippable (`eas update --branch preview`), no `eas build`.**

**Qibla "~20° drift" report investigated + NOT a bug (2026-07-06):** owner saw
the needle start correct then apparently drift ~15-20° right. `git diff` proved
no compass math changed since the last confirmed-good state (only cosmetic
glow/z-order edits). Live logcat via the still-present `[qibla-debug2]` raw/
unwrapped/smoothed log showed: stable ~137° for ~27s, then a clean jump to
~318° (~180° away) held rock-stable for the rest of the capture — i.e. two
genuine stable readings, consistent with the owner physically reorienting the
phone mid-test, not sensor drift or a code regression. Owner confirmed "works
fine" after. The `[qibla-debug2]` log is still in `use-compass-heading.ts`
(harmless no-op cost) — remove whenever convenient, not urgent.
All JS-only, OTA-shippable.

## Quran recitation routed through RNTP (2026-07-07, JS-only, OTA'd) — PR #20 merged (`4032f33`)

**Bug (owner-reported):** tapping a reciter → recitation played but had NO transport controls;
leaving the Reader either kept it playing headlessly (uncontrollable) or, after the earlier
`1c7e7df` fix, force-STOPPED it on blur. Owner wanted it to **keep playing WITH controls**.

**Root cause:** two audio engines. Quran used `expo-audio` (`use-ayah-audio.ts`), a Reader-local
player with no mini-player / lock-screen / background presence — separate from the RNTP player
that playlists/radio use (which has all of those).

**Fix (commits `1ac5e27`+`8f81234`):** route recitation through the ONE RNTP player.
- New pure `features/quran/lib/ayah-queue.ts`: `buildAyahQueue(surah,ayahs,reciter,locale)→QueueTrack[]`
  (id `quran:<numberGlobal>`, title=surah·ayah, artist=reciter name, artwork=`assetUrl(reciter.image)`;
  skips ayahs with null `audioUrl` → **queue index ≠ data.ayahs index**, so locate by id) + `ayahTrackId`/`parseAyahTrackId`.
- `reader.tsx` drives `usePlayer()`: tap → `loadQueue(queue, idxById)` (same ayah → `toggle()`);
  autostart → `loadQueue(queue,0)` once (ref-guard); highlight/scroll derive from
  `parseAyahTrackId(player.currentTrack?.id)`. **DELETED** `use-ayah-audio.ts` + the two-engine
  mutual-pause effects + the `useFocusEffect` stop-on-blur + the repeat-ayah toggle. Overlap now
  structurally impossible (one engine). **No `player-context.tsx` change.**
- **Accepted trade-offs:** ayahs are normal tracks → get resume positions + appear in "Continue
  listening" (mid-ayah resume possible since everyayah ayahs lack `durationSecs`); repeat-ayah
  dropped (player repeat-one covers it); `quran.repeatAyah` locale string left orphaned (harmless).
  If mid-ayah resume annoys → add an `ephemeral` flag to `QueueTrack` (WOULD touch player-context).
- Tests: `__tests__/ayah-queue.test.ts` (4) + rewired `quran.test.tsx` (mocks `@/lib/player-context`,
  asserts tap→`loadQueue` `quran:1` @0). Full gate green: 26 suites/90 tests, typecheck/lint, expo export.
- **Pending:** on-device verify after OTA (mini-player appears, keeps playing on leave, lock-screen
  controls, no overlap, plays on silent switch — RNTP playback category replaces `playsInSilentMode`).
  Design spec/plan: `docs/superpowers/specs|plans/2026-07-07-quran-recitation-through-rntp*` (docs/ gitignored).

## Adhan scheduling-window depletion — 60-day pool + native rolling re-arm (2026-07-14)

**Symptom (owner):** fresh install fires the adhan on time for ~2-3 days, then silently stops
when the app is left closed.

**Root cause (architectural, not config):** the Android adhan schedule only ever covered **~2
days** and nothing rolled it forward from the closed state. `buildAdhanInstants`
(`use-azan-notifications.ts`) looped `dayOffset <= 1` (today+tomorrow); `AdhanScheduler.arm()`
uses one-shot `setExactAndAllowWhileIdle`; `AdhanAlarmReceiver` only started the player — it
did NOT re-arm the next day. Refill happened ONLY on app cold-start / settings change / reboot.
So a fresh installer opening the app a lot kept re-rolling the 2-day window (worked ~2-3 days);
once they left it closed, the window drained and the adhan stopped until next open.

**Fix (owner chose native fix + A72 verify + ~60-day pool):** keep ~12 alarms ARMED (quota-safe;
the old ~200-alarm scheme is what hit the per-app allow-while-idle quota and silenced Fajr — see
memory `project_mobile_adhan_alarm_quota`), backed by a **~60-day persisted POOL** of Aladhan
instants. Each fire re-arms the next pooled instant → rolls the window forward with no app open.
Aladhan stays the single time source (no native compute → no display/fire parity regression).
- JS `use-azan-notifications.ts`: `HORIZON_DAYS = 60` (loop `dayOffset < 60`); Android passes ALL
  instants to native; iOS sliced to `IOS_MAX_AZAN = 40` (its hard 64 pending-notif OS cap, shared
  with azkar). `getPrayerDay` caches per month so 60 days ≈ ≤3 fetches then cache/offline-compute.
- Native `AdhanScheduler.kt`: split **persisted pool (full future list)** from **armed window
  (`MAX_ARMED = 12`)**. New `rearmFromPersisted()` arms nearest 12 from the pool WITHOUT shrinking
  it; used by both boot and post-fire. `MAX_ALARMS = 64` kept only as the cancel-sweep ceiling.
- `AdhanAlarmReceiver.kt`: after `startForegroundService`, calls `rearmFromPersisted` (the rolling
  step; cheap — SharedPreferences read + ~12 setExact, safe in the broadcast window).
- `BootReceiver.kt`: now calls `rearmFromPersisted` (was `rearmPersisted`, which shrank the pool).
- `app.json` versionCode 7 → **8**. Test `__tests__/azan-scheduler.test.ts` updated for the 60-day
  horizon (head = today+tomorrow, length `3 + 59*4`, day-59 present, no day-60).

**Gates:** mobile jest 26 suites/90 tests, tsc, eslint, `expo export --platform android` all green.
Kotlin has no local compile (no Android SDK here) → **REBUILD-GATED + device-verify pending**:
needs one `eas build --profile preview` (NOT `eas update` — OTA can't ship the native change, and a
JS-only OTA would make the OLD native arm ~64 alarms = re-trigger the quota bug). A72 checks:
`dumpsys alarm` shows ~12 armed (not 2/200); 1-min test under forced Doze; after a real fire the
window rolls forward WITHOUT reopening; reboot re-arms.

### Adhan-window fix — follow-ups (2026-07-15)
- Fix + tests PUSHED to `origin/main`: `da1d019` (native rolling re-arm + 60-day pool) +
  `7d27cb3` (dispatch tests: iOS caps at `IOS_MAX_AZAN=40`, Android hands the FULL pool to
  native — `scheduleAzanNotifications` now exported as the test seam). Full monorepo
  lint/typecheck green; mobile 26 suites/92 tests. (`home-screen.test.tsx` flakes only under
  turbo parallel load — passes 4/4 isolated; pre-existing timer-teardown, not this change.)
- **Pre-build de-risk done** (EAS attempts are quota-limited): Kotlin reviewed compile-clean,
  manifest unchanged (receivers already registered), `versionCode` 8, EAS project = live
  `ahmedmuhammedelsaid`, and BOTH `preview` + `production` EAS envs confirmed to hold
  `EXPO_PUBLIC_API_BASE_URL`. Build itself still user-run; A72 `dumpsys` verify still pending.
- ⚠️ **OTA-vs-native gotcha (why the adhan fix can't ship via `eas update`):** `runtimeVersion.
  policy = "appVersion"` → runtimeVersion == the `version` string (still `1.0.0`). I bumped
  `versionCode` 7→8 but NOT `version`, so old-native (vC7) and new-native (vC8) builds share
  runtimeVersion `1.0.0` — an OTA to `1.0.0` lands on BOTH, and the 60-day JS on old native
  does `.take(64)` = re-triggers the quota bug. **Rule going forward: bump `version` on any
  native change** so runtimeVersion isolates native builds from JS-only OTAs. Owner leaning
  **store-primary** (native releases via Play Store; OTA only for internal test + true JS-only
  hotfixes on the same version). See memory [[project_mobile_ota_vs_build_discipline]].
- Concurrent session landed `a498753` (web+mobile player close/replay controls, JS-only) on
  `main` on top of the adhan commits — all pushed; working tree clean.

## Pre-release review → release plan (2026-07-15, review-only session, no code)

Full Android/Play release plan at repo-root **`review_mobile_report_fable.md`** (untracked/
local; supersedes mobile §3 of the now-deleted `fable_review_for_apps.md` — its iOS section
(§4) was redundant with "iOS release readiness" above and wasn't preserved separately,
2026-07-17 doc cleanup). Rulings: THE gate = one
`eas build --profile preview` + A72 verify (adhan re-arm Kotlin + nour-compass K2 fix never
compiled/run; checklist in report §3); register Play Console IMMEDIATELY (personal acct =
14-day/20-tester closed test = the bottleneck); `REQUEST_IGNORE_BATTERY_OPTIMIZATIONS`
keep-vs-drop = Opus decision pre-submission. **Pending (planned, NOT done):** Phase 2 hygiene —
qibla-debug2 log (`features/qibla/hooks/use-compass-heading.ts:71`), `eas.json` explicit
`"environment":"production"` on `build.production`, `publish_play_store.md` still names old
`volunteering-apps` project, `.gitignore` edit uncommitted; then preview build (user-run) +
first-ever production AAB.

## Phase 1 gate PASSED + Phase 2 hygiene DONE (2026-07-15, on-device session)

**Phase 1 (THE release gate) — all 4 checklist items PASS on the A72** (versionCode 8,
owner's own preview build, already installed — not built this session): armed-alarm count
12–14 (healthy, not ~2/~200); Doze-firing confirmed via logcat (`usage=USAGE_ALARM
content=CONTENT_TYPE_MUSIC`, channel `adhan_playback`, full clip); reboot re-arm confirmed
(`BootReceiver` re-armed 12 alarms with the app never opened — first `dumpsys alarm` read
of 0 was a race against the async boot JS init, resolved seconds later); **window-rolls-forward
confirmed on a REAL Maghrib fire** (19:57, app closed the whole time, pool re-armed to 14
afterward). Release gate is clear — the 60-day adhan re-arm fix (`da1d019`/`7d27cb3`) is
device-verified.

**Phase 2 hygiene — committed + pushed `0c8efd2`:** removed qibla-debug2 log, added
`eas.json` `build.production.environment:"production"`, fixed `publish_play_store.md`'s
stale `volunteering-apps`→`ahmedmuhammedelsaid` EAS project reference, deleted
`capture-crash.sh` (owner call: one-off scratch script, no longer needed). Full
`pnpm turbo run lint typecheck test build` green (25/25) before push.

**Next: Phase 3** — Play Console registration ($25, register ASAP since personal accounts
eat a 14-day/20-tester closed-test window), `REQUEST_IGNORE_BATTERY_OPTIMIZATIONS`
keep-vs-drop decision (Opus call, pre-submission), then first production AAB build. Plan
in `review_mobile_report_fable.md` §5 (Phase 3 steps) — still untracked/local, unchanged.

## Radio revamp (mobile) — lantern StationCard, 2-col grid, Recently Played capped to 4 (2026-07-16, JS-only)

Mirrors the same revamp already shipped on web + the extension ([[project_extension_radio_shelf_ui]] / [[project_radio_feature]] in memory). `features/radio/components/station-card.tsx` rewritten from a row-list card to a lantern grid tile: arch shape (`rounded-t-3xl rounded-b-2xl`), centered icon circle (new inline `RadioGlyph` RN-SVG, mirrors the web glyph path), star+waveform LIVE badge (new `Star8Icon` + `WaveformMini` — the waveform breathes via a UI-thread Reanimated loop, same technique as the prayer-times sun-arc corona pulse in `sun-arc.tsx`), favorite star repositioned to a top-end absolute overlay, primary play button at the bottom. **RN has no CSS box-shadow/blur** the way web's box-shadow bloom works, so "glow while playing" is a pragmatic adaptation, not a pixel port: a solid semi-transparent gold circle (`GlowHalo`) behind the icon, opacity-pulsed with the same Reanimated `withRepeat`/`withTiming` idiom — visually in the same family, not identical CSS. `app/radio/index.tsx` switched from a stacked vertical list to a `flex-row flex-wrap` 2-col grid (`w-[48%]` wrapper per card, same pattern as the home playlist grid) to fit the new tile shape. Also capped **Recently Played to the last 4** (`RECENT_VISIBLE_COUNT`) — `nour.radio.recent` still stores up to 12 (unchanged), only the render is capped; `recent` is already MRU so `.slice(0,4)` is correct with no re-sort. Extracted `features/radio/lib/station-view.ts` (`toStationView(station, locale)`) out of the screen's inline mapper so the new home preview shelf (below) can reuse it. `__tests__/radio.test.tsx` unchanged (same a11y labels, still green). Full turbo gate green 25/25 (mobile 97).

## Radio home preview shelf (mobile) — replaces RadioHomeCard (2026-07-16, JS-only)

Mirrors the web homepage shelf. NEW `features/radio/components/radio-preview-shelf.tsx`: first 4 curated stations (server `order`), same lantern `StationCard`, tap plays inline via `usePlayer()` + device-local favorites (`getRadioFavorites`/`toggleRadioFavorite`/`recordRecentStation`), heading row with an **"Explore more" → router.push("/radio")** link. Mounted in `app/index.tsx` right after `<RecitersShelf />` (was: `<RadioHomeCard />` sitting above the Readers shelf, alongside `QiblaHomeCard`) — **deleted** `features/radio/components/radio-home-card.tsx` since the new shelf's own Explore-more link covers the same navigation (no redundant entry point). i18n: `home.radio`/`home.radioExplore` (ar/en); removed the now-orphaned `radio.homeCardSubtitle` key. `__tests__/home-screen.test.tsx`'s `mockApi` helper gained a `/radio → []` branch (mirrors the existing `/quran/reciters → []` branch) so the Home-screen tests don't accidentally feed the shelf playlist-shaped fixtures. NEW `__tests__/radio-preview-shelf.test.tsx` (3 cases: empty→null, caps to 4, Explore-more navigates). Full turbo gate green 25/25 (mobile 97).

## Readers shelf: tap plays Al-Fatiha in background, opens surah list (2026-07-16, JS-only, cross-surface)

`features/home/components/reciters-shelf.tsx` `selectReader`: no longer `router.push("/quran/1?autoplay=1")`. Now fetches `/quran/surah/1?reciter=<slug>` (NEW `features/quran/lib/al-fatiha-queue.ts`, `getJson`+map to `QueueTrack[]`), `usePlayer().loadQueue(queue, 0)`, then `router.push("/quran")` (surah list). Same change on web + extension, full detail in root `APP_CONTEXT.md`. No overlap risk: the RNTP-unified reader already pauses the shared queue when real ayah playback starts. `__tests__/reciters-shelf.test.tsx` updated (mocks `usePlayer`/`getJson`, asserts `loadQueue` + `push("/quran")`, no more `autoplay=1`). ⚠️ Hit a jest gotcha while writing the mock: `jest.mock(() => ({ usePlayer: () => ({ loadQueue }) }))` used SHORTHAND property syntax — a blind find/replace renaming `loadQueue`→`mockLoadQueue` (jest's hoist-guard requires the `mock`-prefixed name) also silently renamed the shorthand key, so `usePlayer()` returned `{mockLoadQueue}` instead of `{loadQueue: mockLoadQueue}` and the component's real `loadQueue` was `undefined`. **Always write mock-factory object properties explicitly (`{ loadQueue: mockLoadQueue }`), never shorthand, when the local var must be `mock`-prefixed for jest's hoist check.**

## Adhkar reminder tap deep-link + 14-day horizon (2026-07-16, JS-only)

Two gaps closed: (1) tapping a sabah/masaa reminder notification only opened the app — no
handler existed. NEW `features/prayer-times/hooks/use-azkar-notification-router.ts` (mounted
in `_layout` as `<AzkarNotificationRouter />`): `addNotificationResponseReceivedListener`
(warm tap) + one-shot `getLastNotificationResponseAsync` (cold start — the launching tap is
NOT delivered to the live listener), routes `data.kind === "azkar-reminder"` →
`router.push(/adhkar/<slug>)`; dedupe key = `identifier:notification.date` (identifier alone
recurs across reschedules). First notification-tap router in the repo — extend per-`kind`
here if azan taps ever need routing. (2) `use-azkar-reminders.ts` horizon 2 → `HORIZON_DAYS`
= 14 (10 on iOS: azan reserves `IOS_MAX_AZAN=40` of the hard 64 pending-notification cap,
10×2=20 keeps total 60<64). `jest.setup.js` expo-notifications mock gained the two response
fns; NEW `__tests__/azkar-notification-router.test.tsx` (4 cases). Extension counterpart:
notification click now opens the built-in new-tab reader (root APP_CONTEXT). Ships via OTA;
**tap-routing + multi-day firing device-verify pending (A72)**.

## Quran surah list — mirrored web's illuminated grid + progress ring (2026-07-16, JS-only)

Mirrors the web redesign (root `APP_CONTEXT.md` + memory). `features/quran/components/surah-index.tsx`: `SurahRow` (single-column `FlatList` row) → `SurahCard`; `app/quran/index.tsx`'s `FlatList` switched to a 2-col grid (`numColumns={2}`, `columnWrapperStyle={{gap:12}}`, each card `flex-1 mb-3`). RN has no CSS `conic-gradient`, so the reading-progress ring is a `react-native-svg` `Circle` with `strokeDasharray`/`strokeDashoffset` (same "SVG stands in for a missing CSS feature" pattern as `sun-arc.tsx` / `station-card.tsx`'s `GlowHalo`), colors hardcoded to `--color-primary`/`--color-border` (dark) — same precedent as `station-card.tsx`'s `GOLD` constant. Corner-bracket ornament is two absolutely-positioned plain `View`s (RN has no pseudo-elements). Progress is read ONCE at the screen level via the same `["quran-last-read"]` query key `ContinueReading` already uses (`getQuranLastRead`), matched against `surahs.data` to compute one surah's `ayahInSurah/ayahCount` percentage — every other card gets `progressPct=null` (plain badge), not a fabricated 0%, same rule as web. NEW `__tests__/surah-card.test.tsx` (2 cases). Existing `__tests__/quran.test.tsx` untouched, still green. Full mobile suite 30/30 (`home-screen.test.tsx` flake reconfirmed pre-existing under full-monorepo-gate load, passes 4/4 in isolation — not a regression). **Visual layout NOT device/simulator-verified this session** — only unit tests + typecheck/lint confirmed; verify on A72 before treating this as fully shipped. Extension mirror still pending (root APP_CONTEXT tracks it).

## Adhkar home preview shelf (2026-07-16, pushed `6b9b9d9`, JS-only/OTA-eligible)

Mirrors web/extension (root `APP_CONTEXT.md` has the full cross-surface writeup). NEW
`features/home/components/adhkar-preview-shelf.tsx`: `useQuery(adhkarListQuery())`,
`.slice(0, ADHKAR_PREVIEW_COUNT)` from `@repo/shared-core/adhkar/preview`, icon by array
position (not per-set), `router.push` to `/adhkar/[slug]` on card tap / `/adhkar` on
Explore more. Wired into `app/index.tsx` after `<RadioPreviewShelf />`, before
`{libraryBar}`. **Caught a real regression via `home-screen.test.tsx`** (not the documented
flake — reproduced in isolation both before and after the fix): `mockApi()`'s catch-all
`return Promise.resolve(playlists)` now also answered the new shelf's `/adhkar` fetch,
so the playlist fixture's "Apple"/"أب" text rendered twice and broke `getByText`. Fixed
by adding an `/adhkar` → `[]` guard alongside the existing `/quran/reciters`/`/radio`
ones. **Lesson reconfirmed**: always re-run a "known flaky" mobile test in isolation
before trusting that label. New `__tests__/adhkar-preview-shelf.test.tsx` (4 cases).
Full mobile suite 29/29 green after the fix. **Owner must run `pnpm seed:adhkar`
against Atlas** for the shelf to show the intended 5 sets (Sabah/Masaa/Sleep/Wake/Salah,
Mosque excluded) — see root `APP_CONTEXT.md` for the seed-order fix.

**Follow-up 2026-07-17 (pushed `f04d621`)**: Waking Adhkar now also hidden from THIS shelf
specifically (owner request) — `.slice(...)` swapped for `buildAdhkarPreview(sets,
{excludeWake:true})` (shared-core), shelf now shows 4 cards, no backfill. The full
`/adhkar` list screen (`app/adhkar/index.tsx`) is untouched — Wake-up still shows there.
Extension's home shelf deliberately kept at 5 (root `APP_CONTEXT.md` has the full
cross-surface writeup + the icon-shift gotcha this filter had to avoid).

## Quran Juz tab — Juz Shelf, first SectionList in the app (2026-07-17, `e9f12fc`, JS-only)

Mirrors web (root `APP_CONTEXT.md` has the full write-up + the juz-boundary data source rationale). `app/quran/index.tsx`'s Juz branch was a static non-scrolling placeholder `View` (`quran.juzPlaceholder` text) — now a real `SectionList` (`sections` built from `JUZ_BOUNDARIES.map(b => ({title:`Juz ${b.juz}`, data: surahsInJuz(b.juz, surahs.data)}))`, from NEW `@repo/shared-core/quran/juz`). NEW `features/quran/components/juz-shelf.tsx` exports `JuzRow` (number badge, english+arabic name, ayah range — full count or partial `ayahs X-Y` when a juz splits the surah). Orphaned `quran.juzPlaceholder` key removed from both locale catalogs. NEW `__tests__/juz-row.test.tsx` (3 cases) + a 4th case added to existing `__tests__/quran.test.tsx` (tab switch renders "Juz 1" + its surah). Full mobile suite green (`home-screen.test.tsx` flake reconfirmed pre-existing, not a regression). **Visual layout not device-verified this session** — same caveat as the surah grid above.

## Prayer-times: Aladhan iso8601 absolute instants + noon-anchored stepping (2026-07-17, `f2e5146`+`3f1d646`, JS-only → OTA-eligible)

`lib/aladhan.ts` is now thin AsyncStorage glue over NEW `@repo/shared-core/prayer-times/aladhan` —
timings requested with `iso8601=true` and parsed as ABSOLUTE instants carrying the CITY's per-date
offset (was: device-local parse, wrong when device tz ≠ selected city tz or the device tz database
disagrees with the official source about Egypt's DST switch date). Cache key now
`nour.prayer.calendar.v2.…` (stale v1 months orphaned deliberately). `getPrayerDay` signature
unchanged — `use-prayer-day.ts`, `use-azan-notifications.ts`, and the `azan-scheduler.test.ts` mock
all untouched by the swap. Day-stepping in `buildAdhanInstants` + `use-azkar-reminders.ts` is now
NOON-anchored: on a 25h DST fall-back day an app-open near midnight could land two dayOffsets on the
same calendar date → the same prayer instant armed under two distinct ids (double adhan). Native pool
self-corrects on the first app open after OTA (`AdhanScheduler.kt` clearPersisted-then-persist — full
replace, no flush migration needed). NEW `__tests__/aladhan.test.ts` (3 cases) + a 60-distinct-dates
invariant in `azan-scheduler.test.ts`. ⚠️ `__tests__/aladhan.test.ts` flaked once under full-suite
load while a concurrent session was mid-edit (passes 3/3 in isolation) — apply the home-screen
re-run-in-isolation rule before treating it as a regression. **Device-verify pending (A72)**: adhan
fires on the Aladhan minute after OTA + one app open.

## Sabah/Masaa launcher quick actions (2026-07-17, REBUILD-GATED)

Home-screen entry point for the adhkar readers: long-press the Nour launcher icon →
"أذكار الصباح" / "أذكار المساء" items (user drags either onto the home screen as a
standalone icon); tap opens the app on `/adhkar/<slug>` (warm + cold start). NEW dep
**`expo-quick-actions@6.0.2`** (ADR 0012, SDK-56 pairing). NEW
`features/prayer-times/hooks/use-adhkar-quick-actions.ts` (mounted as `<AdhkarQuickActions />`
in `_layout` next to the notification router): `useQuickActionRouting()` + `setItems` of 2
stable-id items (`sabah`/`masaa`) once `useAzkarReminderSettings` hydrates — slugs come from
the same settings the reminders use, hrefs `encodeURIComponent`-wrapped (the
`use-azkar-notification-router.ts:41` precedent). Android shortcut icon = plugin-baked
`shortcut_adhkar` drawable from the monochrome ن (`app.json` plugin entry); icon omitted on
iOS via `Platform.select`. `jest.setup.js` mocks both module + `/router` subpath; NEW
`__tests__/adhkar-quick-actions.test.tsx` (3 cases). **Native module ⇒ rebuild-gated, NOT
OTA**: `version` 1.0.0→1.1.0 + `versionCode` 8→9 (runtimeVersion=appVersion isolation).
**Device-verify pending (A72)** on the next preview build: long-press → 2 Arabic items →
pin → tap cold+warm → correct reader; also check label truncation (fallback: shorten titles
to "الصباح"/"المساء").

## Global top progress bar (2026-07-17, `25fc77a`)

`components/navigation-progress.tsx` mounted next to `<Stack>` in `_layout.tsx` — thin
`bg-primary` bar at `insets.top` driven by `useIsFetching()` (expo-router nav is instant;
the perceived home-card delay is the destination screen's queries). 150ms show-debounce,
plain `Animated` trickle to 0.85, snap-to-1 + fade when fetches settle. JS-only → OTA-eligible
(not yet OTA'd). Test `__tests__/navigation-progress.test.tsx` (4 cases) — ⚠️ RTL v13 hides
`accessibilityElementsHidden` elements from all queries incl. `testID`; pass
`{ includeHiddenElements: true }`. Visual device-verify pending (A72).

## Offline-first pass #1 (2026-07-18, `b0c25eb`+`6b6f4cd`+`d97583b`+`ef31715`+fix `f4a0903`, pushed + OTA'd runtime 1.1.0)

Prayer times (Aladhan cache + compute fallback) and Qibla were already offline; this pass covers
**adhkar + Quran reading**. Implemented Sonnet, reviewed Opus (verdict SHIP AFTER FIXES; both fixed).

- **Query-cache persistence** (`_layout.tsx`): `PersistQueryClientProvider` + `createAsyncStoragePersister`
  (deps `@tanstack/react-query-persist-client` + `query-async-storage-persister`, exact-pinned `5.101.0`
  to match react-query — ADR 0013). Key `nour.query.cache.v1` (**mobile-only, NOT a cross-surface
  `nour.*` contract**), maxAge = default gcTime = 30d, `buster` = `app.json` `expo.version`.
  ⚠️ `dehydrateOptions.shouldDehydrateQuery` EXCLUDES `["quran","surah"]` keys — the whole cache
  persists as ONE AsyncStorage value, and 114 surah payloads would plausibly blow Android's ~2MB
  CursorWindow per-row READ limit (write succeeds, restore throws, provider treats it as no-cache).
  Never re-add big payloads to the blob; give them a file store instead.
- **Per-surah file store** (NEW `lib/quran-offline-store.ts`): one JSON file per
  (surah, locale, translation|"default", reciter) under `documentDirectory/quran-offline/`
  (expo-file-system modern `Directory`/`File`/`Paths` API); `writeSurah`/`readSurah`/`pruneStaleSurahs`
  (prunes non-current-identity files each prefetch run). `quranSurahReaderQuery` queryFn (`lib/queries.ts`)
  tries network first, falls back to the file on failure, else rethrows.
- **Background prefetch** (NEW `lib/offline-prefetch.ts`, mounted in `_layout` 3s post-`localeReady`):
  all adhkar details + all 114 surahs via the `lib/queries.ts` factories (keys match), concurrency 3,
  `fetchQuery` NOT `prefetchQuery` (prefetchQuery swallows errors → failure would be unobservable).
  Completion marker `nour.quran.offline.v1` = `{locale, translation, reciter, version}` — `version`
  MUST stay in the marker: the buster wipes the persisted cache on app update, and a version-blind
  marker would early-return forever leaving offline empty (Opus CONFIRMED finding). Any fetch failure →
  stop silently, marker unset, retry next launch. Accepted: 3s delay could race a slow cache restore
  (wasteful refetch, never corrupting); no run-lock (fetchQuery dedup suffices).
- **Data-first error gates** (7 screens: home, adhkar list/reader, playlist detail, quran index/reader,
  radio): `isError` → `isError && !data` so cached data renders when an offline refetch fails. Pattern
  for new screens: never gate on `isError` alone. TS narrowing needs an explicit `if (!data) return null`
  after the gate (the old `isError || !data` narrowed for free; `isError && !data` doesn't).
- **jest.setup.js**: expo-file-system mock is now a small in-memory virtual FS (live `exists`/`size`,
  `write`/`text`/`list`/`delete`) — backward-compatible with the downloads tests. Tests:
  `__tests__/offline-prefetch.test.tsx` (marker semantics, file-store write, queryFn fallback) + an
  adhkar-list cached-data-despite-error case.
- ⚠️ **STALE gotcha correction**: `react-hooks/exhaustive-deps` IS configured now (warn +
  `--max-warnings 0`) — the old "rule not found" note above is obsolete; satisfy the rule, don't disable.
- **Device-verify pending (A72, needs the vC9 build)**: online first-launch → let prefetch finish
  (~114 fetches) → airplane mode → force-close → cold start → unvisited surah + adhkar reader + prayer
  times + qibla all render; also confirm `quran-offline/` file count = 114.
