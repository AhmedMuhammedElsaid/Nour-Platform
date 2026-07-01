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
  - *Closed-app (short clip):* `assets/audio/adhan_notify.wav` — a 24s mono fade-out clip
    trimmed from `apps/web/public/audio/adhan.mp3` with ffmpeg. Registered in `app.json`
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

## Verify before shipping

```bash
cd apps/mobile
pnpm typecheck && pnpm lint && pnpm test
npx expo export --platform android   # confirms the JS bundle compiles
```
Device checklist + build/submit steps: see `apps/mobile/deploy.md`.
