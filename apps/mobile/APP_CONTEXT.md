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
screens. ⚠️ **SUPERSEDED 2026-07-22** (`4ad0ab2`): Quran list/reader + Adhkar reader
converted from `<Spinner>` to `<Skeleton>` (owner chose full visual consistency with
Home over keeping the Spinner) — Radio also gained a `<Skeleton>` grid (was plain
"Loading…" text). Bookmarks/Downloads/Qibla/Prayer-times deliberately left untouched
(no network fetch, nothing to skeleton). Playlist detail still uses a bare
`ActivityIndicator` (pre-existing, out of this pass's scope — a stale doc-comment in
`components/ui/skeleton.tsx` claims otherwise, don't trust it). jest-expo tests use
`screen.UNSAFE_getAllByProps({ accessibilityRole: "progressbar" })`, NOT
`getByRole("progressbar")` — RNTL 13.3.3's role query requires an explicit `accessible`
prop before it'll match a plain `View`, so `Skeleton` (accessibilityRole only, no
`accessible`) is invisible to `getByRole`.

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
       - **2026-07-30 update (`722ca74`)**: icon.png now renders on cold start with no intervening ن flash; the noon mark is retired repo-wide (including deleted `apps/web/public/icons/icon.svg`). JS-only change, OTA-eligible.
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

**Re-audited 2026-07-29 (`e8b6198`)** — every point re-verified still in place against the
tree, and the plan file now carries a `✅ CLOSED` header so it stops reading as live work
(it had none, which is why it kept getting picked up). Two deviations recorded there, both
intentional: `@react-native-community/slider` was **never added** (Phase 4 took the zero-dep
Reanimated path from its own footnote, so it needed no rebuild — §4's dep table is wrong),
and point 3a (double playback) was solved by unifying ayah audio onto the single RNTP player
rather than the specced `onPlaybackStart` wiring — **`useAyahAudio` no longer exists**. Its
file/line references have drifted badly since (211 mobile commits, incl. the `1ad6d7f`
PlayerContext 4-way split); re-derive from the tree, never from that document.

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

## Mushaf (Safha) page layout — Quran reader (2026-07-18, JS-only → OTA-eligible, pushed `d0901ff`)

> ⚠️ **SUPERSEDED 2026-07-19 — see the entry below.** This v1 was within-surah-only and
> defaulted to `"list"`. Cross-surah page browsing + swipe + the default flip to `"mushaf"`
> landed in `80aa271`/`b9aa0ba`. Kept below for history/gotcha reference (still accurate for
> what it describes), but don't treat "default: list" or "within-surah only" as current.

Optional page-flow reading mode alongside the existing one-ayah-per-row list. `lib/device-local.ts`
`QuranPrefs` gained `layout: ReaderLayout` (`"list" | "mushaf"`, default `"list"`) — shape now
fully mirrors web's `apps/web/features/quran/lib/quran-prefs.ts` (same key `nour.quran.prefs`,
old stored blobs hydrate fine via the existing default-spread). NEW pure helper
`features/quran/lib/page-groups.ts`: `groupAyahsByPage` (splits the surah's `ReaderAyah[]` on
`page` change, no new API call — `page`/`juz` already ship on every ayah), `toArabicIndicDigits`,
`ayahMarker` (U+06DD + Arabic-Indic digits, upgrading list mode's Western-digit badge). NEW
`features/quran/components/mushaf-page.tsx`: one justified `font-quran` paragraph per mushaf
page, inline per-ayah `onPress` spans (`testID="mushaf-ayah-<numberGlobal>"` — nested-Text
`fireEvent.press` needs the exact pressable node, not just text match), Bismillah shown only on
the page's first group when `surah.bismillahPre && surah.number !== 1` (literal Uthmani string,
not i18n — same text as `apps/web/app/[locale]/quran/[surah]/page.tsx:84`), Page/Juz footer.
`reader.tsx` branches its `FlatList` on `prefs.layout` (list-mode FlatList untouched byte-for-
byte) with a second `mushafRef`; the scroll-to-playing effect now branches too (mushaf scrolls to
the page group containing `activeGlobal`). Selection state (`selectedGlobal`) is v1-only —
tap toggles a `bg-surface-2` highlight; play/bookmark/tafsir stay list-mode-only (nested-Text
longPress is flaky on Android). `reader-settings-sheet.tsx` gained a Layout section (List/Mushaf
`Selectable` pills, existing staged Save/Cancel semantics apply). NEW `quran.layout`/
`layoutList`/`layoutMushaf`/`pageN`/`juzN` locale keys (en+ar). NEW `__tests__/page-groups.test.ts`
(7 cases) + `__tests__/mushaf-page.test.tsx` (5 cases); extended `__tests__/reader-settings-sheet.test.tsx`
(+2 cases, Mushaf pill staging). Full gate green. **Justify rendering + tap targets = device-verify
pending** (Android `textAlign:"justify"` needs API 26+; `writingDirection` is iOS-only, same
Android-resolves-RTL-from-first-strong-char caveat as `ayah-row.tsx`). Follow-ups out of scope:
mirror to web (its `layout` pref is already declared, unconsumed) + extension; tafsir/actions
from mushaf mode; true global 604-page browsing.

## Mushaf cross-surah page browsing + swipe + default flip (2026-07-19, `80aa271`+`b9aa0ba`, pushed)

Evolves the v1 above: Mushaf is now the **DEFAULT** layout (`DEFAULT_QURAN_PREFS.layout: "mushaf"`,
was `"list"`; explicit stored `"list"` prefs are preserved). Mode now fetches by PAGE, not surah —
new `lib/queries.ts` `quranPageReaderQuery(page, locale, translationSlug, reciterSlug)` →
`GET /quran/page/:n` (new backend endpoint, `packages/api` commit `d56de14`, `PageReader`/
`PageSegment` in `packages/shared-core/src/schemas/quran.ts`), which can span 2 surahs (short
surahs sharing a page, common in juz 30). `app/quran/[surah].tsx` resolves the entry surah's
`pageStart` from the cached `quranSurahsQuery` (immutable ref data) once, then browses by page from
there — every existing entry point (surah list, bookmarks, search, continue-reading, Readers shelf)
still links by surah number, unchanged. `features/quran/components/mushaf-page.tsx`'s `MushafPage`
→ `MushafSegment` (renders one `PageSegment`: EN/AR surah banner + its own `showBismillah` gate,
now computed server-side, not client-derived). `reader.tsx` takes dual `data`/`pageData` props;
Prev/Next header buttons (`onChangePage`) plus **swipe-to-turn-page** (`b9aa0ba`, same commit series):
left-to-right drag = forward/next page, right-to-left = backward/prev, fixed regardless of AR/EN
locale — pure `resolveSwipeDirection()` in NEW `features/quran/lib/swipe.ts` (unit tested), wired via
RN core `PanResponder` (no `react-native-gesture-handler` in this workspace — verified before
building, so no new dependency; same `PanResponder` precedent as `components/ui/slider.tsx`).
`onStartShouldSetPanResponder` always `false` + a `|dx|>|dy| && |dx|>32px` threshold in
`onMoveShouldSetPanResponder` so ayah taps and in-page vertical scroll pass through untouched.
`pageData`/`onChangePage` read through refs (not closure-captured at `PanResponder.create()`, which
only runs once via `useRef`) so the gesture never acts on a stale first-page snapshot. Audio queue
spans a page's segments via NEW `buildPageQueue()` in `features/quran/lib/ayah-queue.ts`
(concatenates one per-segment `buildAyahQueue()` call); autoplay resolves to the entry surah's own
segment on the landing page (not always track 0). Last-read sources from the page's first segment's
first ayah in Mushaf mode. Old `groupAyahsByPage`/`AyahPageGroup` removed from
`features/quran/lib/page-groups.ts` (dead once page-fetch replaced client-side grouping); kept
`toArabicIndicDigits`/`ayahMarker`. **Known gap, not fixed**: no offline caching for page mode — the
per-surah offline store (`lib/quran-offline-store.ts`) is keyed by surah, not page, so Mushaf reading
needs network even for a previously-cached surah. Mirrored same-day on web (`06f3070`) and extension
(`bbf90fd`) — web/ext are buttons-only (no swipe), per explicit owner scoping. Full gate green
(mobile 42 suites/168 tests); full monorepo gate's only failure remains the pre-existing, unrelated
`use-azkar-notification-router.ts` typecheck error. Visual/gesture behavior = device-verify pending.

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

## Friday Surah Al-Kahf reminder (2026-07-18, `a5d039a`)

- Weekly Friday-12:00 notification = ONE repeating `WEEKLY` expo trigger (id `nour-kahf-weekly`,
  `features/quran/hooks/use-kahf-reminder.ts`). ⚠️ expo weekday convention: Friday = **6** (1=Sunday),
  not Date#getDay's 5. Costs 1 iOS pending slot (vs ~14 for a DATE-pool clone). If A72 verify shows
  Android dropping the weekly repeat, fallback = small Friday DATE pool (see the hook header).
- Settings `nour.kahf.reminder` `{enabled}` default ON (`use-kahf-reminder-settings.ts`, settings-bus,
  shared-core schema); toggle on the prayer-times screen below the adhkar one. Wired in
  `components/azan-scheduler.tsx` (Arabic delivery via `t(..., {lng:"ar"})`, gated on notif permission).
- Tap routing: `use-azkar-notification-router.ts` generalized per-kind — `kind:"kahf-reminder"` →
  `/quran/18`. Home card `features/home/components/kahf-friday-card.tsx` (visible Friday 12:00→midnight,
  X or click-through writes `nour.kahf.dismissed` = local YYYY-MM-DD via `lib/device-local.ts`; 60s clock;
  sibling-Pressables convention; `localKeyForDate` from shared-core aladhan).
- **Device-verify pending (A72)**: set clock Fri 11:59 → notif at 12:00 → tap opens `/quran/18`; card
  appears/dismisses; verify the WEEKLY trigger survives a week without app opens. JS-only → OTA-eligible.

## Android home-screen widget — prayer/radio/adhkar (2026-07-18, `3022e32`+`fa50c80`+`9ae187c`+`6bdb717`)

- New OS launcher widget **`NourHome`** (`react-native-android-widget@0.21.0`, ADR 0014) — 3
  independently-clickable rows (prayer times + next-prayer highlight, last-played/favorite radio station
  name, static Adhkar label), each `clickAction="OPEN_URI"` → `nour:///prayer-times` / `/radio` / `/adhkar`.
  Config plugin entry in `app.json` (`updatePeriodMillis:1800000`, 5×3 target cells, PIL placeholder
  preview PNG).
- New entry point `index.ts` (`registerWidgetTaskHandler` before `expo-router/entry`; `package.json`
  `"main"` flipped from `"expo-router/entry"`). `widget-task-handler.tsx` handles
  WIDGET_ADDED/UPDATE/RESIZED (no-op on DELETED/CLICK — OPEN_URI runs natively, no JS round-trip).
- Row builders (pure/testable): `features/prayer-times/widget/build-prayer-rows.ts` (reuses
  `@repo/shared-core/prayer-times/compute` directly, NOT the Aladhan-cached `usePrayerDay` hook — accepted
  ~1min edge-case drift vs the in-app screen, keeps the builder sync; rolls the highlight to Fajr after
  Isha, same visual precedent as the existing in-app `PrayerTimesWidget`), `features/radio/widget/
  build-radio-row.ts` (recent-then-favorite slug → `/radio` name resolution, try/catch → NEW cache key
  `nour.widget.radioNameCache` fallback, **never throws** — a radio failure can't blank the other rows),
  `features/adhkar/widget/build-adhkar-row.ts` (static label, no I/O). Extracted
  `features/prayer-times/lib/prayer-settings-store.ts` (readLocation/readPrefs out of
  `use-prayer-settings.ts`, zero hook behavior change, + new `readLocale()` mirroring `lib/i18n.ts`'s
  device-locale fallback WITHOUT importing it — avoids running i18next init inside the headless task).
- `features/home/widget/nour-home-widget.tsx` (dumb RNAW FlexWidget/TextWidget tree, hardcoded hex vs
  `tokens.css` dark theme — same precedent as `sun-arc.tsx`'s `PALETTES`) + `render-nour-home-widget.tsx`
  (shared composition, used by BOTH the task handler and `components/azan-scheduler.tsx`'s new instant-
  refresh-on-settings-change effect via `requestWidgetUpdate`).
- ⚠️ RNAW gotchas: renders to a rasterized **image** (not native RemoteViews text) — some launchers may
  report a size ≠ actual, minor cropping possible; `updatePeriodMillis` has **no safe default (0 = never
  updates)** — must be set explicitly; the task handler runs INSIDE the app process as a headless JS task
  (AsyncStorage/fetch all work) but deliberately imports NO `lib/i18n`, NO player/RNTP, NO TanStack.
- **Rebuild-gated, NOT OTA** — the config plugin's generated `AppWidgetProvider`/manifest + the new JS
  entry point are both native-shell changes `eas update` cannot reach. Rides the next batched preview
  build; left `version`/`versionCode` at `1.1.0`/`9` (assumed vC9 NOT yet built — the "needs the vC9
  build" device-verify notes elsewhere in this file predate this session). **Re-check `eas build:list`
  before building**; bump `versionCode`→10 + `version`→1.2.0 if vC9 already shipped without this.
- Verified this session (no `eas build` run — quota-preserving): `expo prebuild --platform android`
  scaffolds the `NourHome` receiver + `widgetprovider_nourhome.xml` correctly (splash untouched);
  `expo export --platform android` bundles `index.ts` clean (2093 modules, 0 errors); jest-expo
  `__tests__/build-{prayer-rows,radio-row,adhkar-row}.test.tsx` (20 cases) + full mobile suite green
  (41/41 suites). **Device-verify pending (A72)** — plan §6 step 5's full on-device checklist (widget
  add/resize, tap-through all 3 rows, radio degrade in airplane mode, instant refresh on settings change,
  overnight + force-closed survival) awaits the next EAS build.
- **Fresh-context Opus review (`66580a8`) found + fixed 1 real bug**: `build-radio-row.ts`'s `/radio`
  fetch had no timeout — a hung request (captive portal) never rejected, stalling the whole widget render
  (prayer + adhkar rows too), contrary to the module's own "never blank the other rows" contract. Fixed
  with a local `withTimeout()` race (6s) around just that call, `getJson` itself untouched. Also fixed:
  `build-prayer-rows.ts` rolled the highlight to tomorrow's Fajr after Isha but still displayed *today's*
  already-elapsed Fajr time under it — now rolls the whole row set to tomorrow's computed day. Full mobile
  gate re-verified green after the fix; full monorepo gate's only failure is a **pre-existing, unrelated**
  `mobile#typecheck` error in `use-azkar-notification-router.ts` (from `a5d039a`, not touched by this
  feature) — flagged, not fixed here (out of scope).
- **A SECOND independent fresh-context Opus review (`6734947`)**, run in parallel by a different
  concurrent session unaware of the first, caught what the first pass missed: `nour-home-widget.tsx`
  still shipped the pre-§5.8 superseded dark palette instead of the owner's locked design-match values
  (root bg used `--color-bg` not `--color-surface`; next-prayer time never picked up the `--color-sun`
  tint; radio/adhkar icons were bare emoji instead of the Adhkar-shelf icon-chip motif). Fixed; verified
  via `tsc --noEmit` + `eslint` on the touched file (no RTL test exists for RNAW JSX trees — matches plan
  §5.11's stated scope). **Lesson**: one review pass on a large first-of-kind diff is not guaranteed to
  cover everything the plan flagged as a risk area — it took 2 independent passes to close both the
  reliability risk (§9) and the styling risk (§5.8) the plan called out.
- **2026-07-19 "Maghrib didn't fire" investigation (A72, live adb, versionCode 9/1.1.0)**: NOT a
  scheduling/quota/native bug — `dumpsys alarm` + `logcat` proved the alarm fired exactly on time,
  full 128s FGS playback, correct `AudioTrack` frames delivered, no DND/Bluetooth interference.
  Real root cause: Android's Alarm-stream volume curve maps slider position 5/15 to only **~6.3%
  linear gain** (`APM_AudioPolicyManager: checkAndSetVolume ... volume 0.063096`), not the ~33%
  raw-position estimate — combined with the app's own gain, genuinely near-inaudible. Confirmed by
  re-test at Isha (21:26 same day): fired identically, user raised phone volume, heard it fine.
  **Real code bug found along the way (fixed, commit `f342981`, NOT pushed)**: `NourAdhanModule.kt`
  `playTest` hardcoded `volume=1.0`, while the real scheduled fire correctly used the saved setting
  (measured `0.8` live) — so the in-app "Test adhan" button was always louder than reality, giving
  false confidence. Fixed by threading the real `settings.volume` through
  `use-azan-notifications.ts` → `adhan-native.ts` → native `playTest(delayMs, volume)`. Native
  signature change → version bumped 1.1.0→1.1.1, versionCode 9→10 (rebuild-gated, cannot OTA).
  **Not yet built/pushed** — owner will trigger `eas build` separately. Gates green (typecheck/lint/
  jest, same pre-existing unrelated `use-azkar-notification-router.ts` error noted above).

### Widget rich redesign (2026-07-19, `92981e9`+`41a9ecf`)

Owner shared a device screenshot of the v1 widget and disliked it — one prayer row, then a large
empty void, then two bare single-label rows (`🔊 إذاعة` / `📿 الأذكار`). Redesigned to mirror the
in-app Home screen. **NOT yet built/pushed to origin** — owner triggers both separately.

- **NEW `features/prayer-times/widget/build-arc-svg.ts`**: generates a raw SVG **string** (not JSX —
  RNAW's `SvgWidget` hands a string to the native **AndroidSVG (caverock 1.4)** renderer, a completely
  separate pipeline from `react-native-svg`) reusing the same pure geometry as the in-app `SunArc`
  (`@repo/shared-core/prayer-times/sun-arc`: `arcPath`/`arcPoint`/`tForFraction`). ⚠️ **AndroidSVG has
  NO `<filter>`/`<feGaussianBlur>` support** — confirmed via source inspection, no mention anywhere in
  the library. The in-app arc's Gaussian-blur bloom + reanimated pulse are approximated with stacked
  semi-transparent `radialGradient` halo circles instead; no animation (static bitmap, regenerated on
  each 30-min refresh / settings-change instant-refresh). `linearGradient`/`radialGradient`/`mask`
  (crescent moon) all render fine.
- `build-prayer-rows.ts` extended: `PrayerRowsResult` now also returns `arc: {fraction, isNight,
  onNightBand}` (via `getArcPosition`, local `computePrayerTimes` resolver — matches this builder's
  existing local-adhan-js choice) and `dots: ArcDot[]` (via `buildArcDots`), plus **`next:
  {title, name, remaining} | null`** — a static (non-ticking) "H:MM until next prayer" readout via the
  NEW `formatRemainingHM` in `@repo/shared-core/prayer-times/format.ts` (sibling to
  `formatCountdownClock`, but always shows both segments, no seconds — the widget bitmap can't animate
  a live tick like the in-app `PrayerCountdown` leaf does).
- **RTL gotcha (widget-specific)**: `nour-home-widget.tsx`'s next-prayer row order (title → name →
  remaining) is **manually reversed for `locale === "ar"`**. Confirmed via source inspection that RNAW's
  `FlexWidget` has **no automatic RTL/layoutDirection handling at all** — unlike a plain RN `<View
  className="flex-row">`, which gets free RTL mirroring from React Native's layout system (see
  `prayer-countdown.tsx`'s "label → name → countdown, RTL auto-mirrors" comment). This is empirically
  confirmed by the pre-existing prayer-time cells row, which has always rendered in fixed chronological
  left-to-right order in Arabic (never mirrored) — the manual reorder here is the deliberate exception
  to CLAUDE.md §4.3's "never `flex-row-reverse`" rule, since that rule assumes RN's `dir="rtl"`
  auto-mirror, which RNAW simply doesn't have. **Any future RTL-sensitive row added to this widget needs
  the same manual per-locale reorder** — it will NOT auto-mirror like the rest of the app does.
- `build-adhkar-row.ts` rewritten: multi-icon, deep-links each icon to its own set
  (`nour:///adhkar/<slug>`, `buildAdhkarPreview` + cached in `nour.widget.adhkarSlugsCache`, static
  fallback on fetch failure with no cache). **Shows all 5 preview icons (including Wake-up)** — a
  deliberate deviation from the in-app Home shelf's `excludeWake: true` (owner request, this session,
  widget-only; don't "fix" this to match the shelf later without re-confirming with the owner).
- `build-radio-row.ts` extended: `RadioRowResult.stations: string[]` (up to 3, recent+favorite slugs
  deduped, same never-throws + `nour.widget.radioNameCache` fallback as before, now caching a JSON
  array). Empty state shows a single generic pill (not a bare label) so the row never renders blank.
- `nour-home-widget.tsx`: full layout rewrite — header → arc (`SvgWidget`) → next-prayer row → prayer
  cells → divider → adhkar icons (row itself is the tap target now, not a removed title text) →
  divider → radio pills. The old `"الأذكار"`/`"إذاعة"` row-title `TextWidget`s were removed per owner
  request; each row's own `clickAction` still opens its list.
- `app.json` widget config: `targetCellHeight` 3→**4**, `minHeight` `"180dp"`→**`"240dp"`** (native
  change, needs a fresh `eas build`). `version`/`versionCode` left at **1.1.1**/**10** — rides the
  already-bumped next build (see the Maghrib-adhan entry above), no further bump.
- Full gate verified clean across every package (web/admin build+test+lint, `@repo/api`
  build+test+lint, extension build+test+lint, shared-core test, mobile lint + full 43-suite/184-test
  jest run) — turbo's own run stops at the first failure (`mobile#typecheck`), so each cancelled
  sibling task was re-run directly to confirm. Only failure anywhere: the same pre-existing
  `use-azkar-notification-router.ts` typecheck error noted above (untouched by this session).
- A code-accurate HTML preview (arc SVG ported 1:1 from `build-arc-svg.ts`'s algorithm) was used to
  review the design with the owner before spending an EAS build — iterated through several rounds
  (row-in-a-row-not-column, RTL order, icon count) entirely from that preview before any device build.
- **Next**: owner builds (`eas build`) + pushes; then the plan's on-device checklist (widget add/resize,
  arc position sanity at different times of day, all tap targets, radio/adhkar offline degrade).

### Bottom-dock spacing bug: doubled padding on every scrollable screen (2026-07-20, `14874dd`)

Owner shared a Home screenshot showing a large empty gap between the footer and the bottom dock
(tab bar + mini-player). Root cause: `lib/use-dock-spacing.ts` re-added the dock's height
(`TAB_BAR_HEIGHT` + `MINI_PLAYER_HEIGHT` + `insets.bottom`) as scroll `paddingBottom`, on the
premise the dock is an absolutely-positioned overlay. **It never was** — `components/bottom-dock.tsx`
has been a plain flex-column sibling of `<Stack/>` in `app/_layout.tsx` since its original
introduction (`31767dd`), no `position: "absolute"` anywhere, so the Stack navigator's `flex:1` area
is already sized by flexbox to exclude the dock's full rendered height. The padding was pure
double-counting — affected **all 9 screens** using the hook (Home, Quran reader/index, Adhkar
list/reader, Playlist detail, Radio, Qibla, Prayer times), not just Home.
Fix: `useDockSpacing()` now returns a small constant breathing-room gap only (no dock-height math).
Single-file change (`lib/use-dock-spacing.ts`); all 9 call sites unchanged. Full gate green (mobile
43/43 suites, typecheck/lint clean except the same pre-existing unrelated error noted above).
**Gotcha for future sessions**: if `BottomDock` is ever made a genuine overlay (`position:
"absolute"`), `useDockSpacing()` needs its dock-height math added back — the two must stay in sync.

## 2026-07-21 session — iOS foreground-adhan stop control

Follow-up to the extension's stop-adhan button (same day, `761ccfc`). Owner asked whether mobile already
had this — **Android did** (`AdhanPlayerService.kt` shows an ongoing "إيقاف · Stop" notification action,
pre-existing). **iOS had no stop control at all** — `use-foreground-adhan.ts` played the full adhan via
expo-audio while the app was open, with nothing to silence it.

Fix: `useForegroundAdhan()` (`apps/mobile/features/prayer-times/hooks/use-foreground-adhan.ts`) now
returns `{ activeKey, stop }` instead of `void` — `activeKey` is the firing `AdhanPrayerKey` while the
adhan plays, `stop()` pauses the player and runs the same teardown (`finish()`) as a natural finish
(resume whatever was ducked, clear the card). New `AdhanStopCard`
(`apps/mobile/features/prayer-times/components/adhan-stop-card.tsx`) is an absolute-positioned card
(`zIndex: 70`, above `NavigationProgress`'s 60) rendered by `ForegroundAdhan` in `app/_layout.tsx` —
prayer name + `prayer.adhan.adhanBody` + a `Button` calling `stop()`. Self-gates on `activeKey === null`,
so it's a no-op on Android (the effect early-returns off-iOS, `activeKey` never sets). New i18n key
`prayer.adhan.stop` (ar/en). Tests: 2 new cases in `__tests__/foreground-adhan.test.tsx` (activeKey set/
cleared by stop, cleared by natural `didJustFinish`) — full mobile suite 186/43 green, no flake this run.
⚠️ Device-verify pending (iOS only feature, no simulator substitute for expo-audio + notification timing).

## Home-screen test buttons for Kahf + Adhkar reminders (2026-07-21, `f746417`)

Owner asked for on-device verify buttons for the Kahf/Adhkar reminders, mirroring the existing
"Test adhan (1 min)" button on the prayer-times screen. Pure additions — no existing scheduling
function touched.

- `scheduleTestKahf()` new export in `features/quran/hooks/use-kahf-reminder.ts`; `scheduleTestAzkar(kind, content)`
  new export in `features/prayer-times/hooks/use-azkar-reminders.ts`. Both fire a one-off notification
  ~60s out with the identical `data.kind` tap payload the real notification uses, so
  `use-azkar-notification-router.ts` routes the tap correctly (Kahf → `/quran/18`, Azkar → adhkar reader).
- Two ghost buttons on the HOME screen (`app/index.tsx`, not the prayer-times screen), gated on
  `notifGranted && <reminder>.enabled` — same UX as the adhan test button. Azkar test always fires
  the "sabah" kind.
- ⚠️ Test-notification IDs: Kahf test uses a distinct id (`nour-kahf-test`, never collides with the
  real `nour-kahf-weekly`). Azkar test uses `nour-azkar-test-sabah`, which the real scheduler's
  `cancelAll()` WILL sweep on its prefix match (`nour-azkar-`) if you change prayer settings while a
  test ping is pending — harmless (only kills the test notification, real schedule always rebuilds
  fresh in the same call), just don't be surprised if a test ping silently doesn't fire after you
  touch settings mid-wait.
- Verified: typecheck/lint/targeted jest (`home-screen`, `kahf`, `azkar` suites) green. Real firing +
  tap-through still needs an A72 on-device check, same as the adhan test button always has.

## Pre-`eas build --profile preview` audit (2026-07-21, no code changes)

Owner asked to verify nothing was missing before firing a new preview build. Findings, all clean —
no fix was needed:
- `main`/`origin/main` fully synced, no unpushed commits; all previously-noted "committed NOT
  pushed" rebuild-gated commits (adhan volume `f342981`, widget redesign `92981e9`/`41a9ecf`,
  Kotlin K2 fix `29f0599`, session-rehydration `5ac55e0`/`0f3b5c9`, perf-pass `f1399b5`) confirmed
  as ancestors of `HEAD` via `git merge-base --is-ancestor`.
- `version`/`versionCode` = `1.1.1`/`10` — already covers every native change landed to date.
- **Stale-error correction**: the "pre-existing, unrelated `use-azkar-notification-router.ts`
  typecheck error" noted in the widget/Maghrib/bottom-dock entries above (2026-07-18→20 sessions)
  is **no longer reproducing** — `pnpm typecheck` is clean. Don't keep citing it as still-present.
- Full mobile gate re-run fresh (not from memory): `typecheck` clean, `lint` 0 warnings, `test`
  43/43 suites · 186/186 tests, `expo export --platform android` compiles (2097 modules).
  `eas.json` preview profile pinned `environment:"preview"`; `eas env:list --environment preview`
  confirmed `EXPO_PUBLIC_API_BASE_URL=https://nour-platform-web.vercel.app`; `.easignore` present.
- **Concurrent session detected mid-wrap**: commit `1adfead` ("quran list screen skeleton") landed
  on `main` during this session, plus uncommitted local changes to
  `apps/mobile/__tests__/quran.test.tsx` + `apps/mobile/app/quran/[surah].tsx` — NOT touched by
  this session, left as-is.

## Kahf/Adhkar test buttons relocated home → prayer-times (2026-07-22)

Owner correction on the `f746417` change above: the two ghost test buttons belonged on the
prayer-times screen, one per reminder's own settings card, not stacked on the Home screen.

- **`app/index.tsx`**: removed `runTestKahf`/`runTestAzkar`, the `notifGranted` state +
  permission-check `useEffect`, and the ghost-button row — along with the now-unused
  `useCallback`/`useEffect`/`Alert`/`Notifications`/`formatClock` imports and the
  `useKahfReminderSettings`/`useAzkarReminderSettings`/`scheduleTestKahf`/`scheduleTestAzkar`
  imports. Home no longer references the reminder settings at all.
- **`app/prayer-times/index.tsx`**: added the same two callbacks (moved verbatim) plus a ghost
  `<Button>` inside each reminder's existing settings card — Azkar's test button sits under its
  `hint`/`foregroundOnly` text, Kahf's under its `hint` text — gated on
  `notifGranted && <reminder>.enabled`, exactly mirroring the pre-existing "Test adhan" button's
  placement inside the adhan card above them. New imports: `scheduleTestAzkar` (from
  `features/prayer-times/hooks/use-azkar-reminders`) and `scheduleTestKahf` (from
  `features/quran/hooks/use-kahf-reminder`) — `useAzkarReminderSettings`/`useKahfReminderSettings`
  were already imported on this screen for the toggles.
- Verified: mobile `typecheck` + `lint` clean, targeted jest (`home-screen`, `prayer-times`,
  `kahf`, `azkar` suites) 3/3 suites green. Real firing + tap-through still needs an A72
  on-device check, same as before — this was a placement fix only, scheduling logic untouched.

## OTA-only session: Quran Uthmani font delivery gap (2026-07-22)

User reported the Quran reader still showing small/system-font text on-device. Investigation
found the fix was already code-complete and pushed (`fba0bdb`, see mushaf section above) —
the gap was that it had never been OTA-published, so devices on `runtimeVersion 1.1.1`
were still running the pre-fix JS bundle. No code changed. Ran `eas update --branch preview
--environment preview` from `apps/mobile` → update group `31da7855-eb58-4a44-90e7-91d6b6ae0952`.
Pending: user to relaunch the app on-device and confirm the Uthmani font now renders.

## Uthmani font still not visible — re-OTA with `--clear-cache` (2026-07-23)

User reported (again) the Quran Uthmani font not showing on-device. Investigated fresh: font
file present (`assets/fonts/UthmanicHafs.ttf`, 242KB), `app/_layout.tsx` `useFonts()` loads it
correctly, `tailwind.config.js` maps `font-quran`→`UthmanicHafs`, all 6 call sites (mushaf-page,
ayah-row, reader, surah-index, juz-shelf, word-by-word) apply the class, no `assetBundlePatterns`
exclusion, metro's default `assetExts` already covers `.ttf`. **Code is correct — same
conclusion as the 2026-07-22 session.** Root cause this time: the prior font OTA
(`31da7855`, 2026-07-22) was published with `--environment preview` but **without
`--clear-cache`**, which the repo's own OTA gotcha (line ~634 above) says to always include.
Re-published: `eas update --branch preview --environment preview --clear-cache` from
`apps/mobile` → update group `945c465b-5fc3-4ca3-bfcd-0781839ea6ee` (runtime `1.1.1`, commit
`f0bb668`). Export log **confirms `assets/fonts/UthmanicHafs.ttf (242KB)` is in the asset map**
for both platforms (already-uploaded/deduped — proof the OTA pipeline does ship the font
correctly, ruling out a delivery-pipeline bug). No code changed.

**Update: user sent an on-device screenshot the same session — this was NOT a delivery gap.**
The font WAS rendering (the ayah-body paragraph was crisp, correct Uthmani calligraphy). Only
the standalone Bismillah heading (`mushaf-page.tsx`'s module-level `BISMILLAH` constant,
rendered when `segment.showBismillah`) was visibly corrupted — dropped/mangled letters (e.g.
`ٱلرَّحِيمِ` missing its `ي`).

**Real root cause (verified by codepoint diff against the live `alquran.cloud` `quran-uthmani`
API, not guessed):** the hardcoded `BISMILLAH` literal has the **shadda (U+0651) and fatha
(U+064E) diacritics swapped** at 3 positions (on `الله`, `الرحمن`, `الرحيم` — fatha-before-
shadda instead of the canonical shadda-before-fatha). Confirmed by fetching Baqarah/Yusuf ayah
1 from the API (whose text *does* bake the Bismillah into ayah 1 for every surah except
At-Tawbah) and diffing codepoint-by-codepoint against the source literal — exact match except
those 3 swapped pairs. Browsers' HarfBuzz shaping (web) silently reorders combining marks to
canonical order before applying GSUB, so web never showed this; RN's Skia-based shaper with
the embedded `UthmanicHafs.ttf` does not reorder, so the font's ligature substitution for the
shadda+fatha combo failed silently on the wrong-order input, dropping glyphs. **Same literal,
same bug, was copy-pasted into 4 files**: `apps/mobile/features/quran/components/mushaf-page.tsx`,
`apps/extension/src/components/mushaf-page.tsx`, `apps/web/app/[locale]/quran/[surah]/page.tsx`,
`apps/web/features/quran/components/mushaf-page-view.tsx` — all 4 fixed in the same pass
(replaced with the API-verified canonical string), plus 2 test files whose hardcoded
regex/string assertions had the same swapped order (`apps/mobile/__tests__/mushaf-page.test.tsx`,
`apps/web/features/quran/components/mushaf-page-view.test.tsx`). Targeted mobile jest (5/5) +
web vitest (9/9) pass; lint/typecheck clean across mobile/web/extension.

**Shipped 2026-07-23**: OTA'd `--clear-cache` (update group `d87c9808`, runtime `1.1.1`).
Committed + pushed `e246d7f`.

**A72 device-verified 2026-07-24** — user reported "still broken" even after force-stop +
clear-cache + clear-app-data cycles. Rather than guess a 3rd fix blindly, connected directly
to the device over `adb` (wireless debugging pair/connect, see
[[reference_adb_wireless_debugging]]) and confirmed server-side first: live manifest fetch
for channel=`preview`/runtime=`1.1.1`/platform=`android` resolved to the fix's update ID
(not stale), and the last native build (`10c1f9e7`, 2026-07-21) is `runtimeVersion 1.1.1` —
eligible to receive it. Then deep-linked into the app (`adb shell am start -a
android.intent.action.VIEW -d "nour://quran/2"`) and `screencap`'d directly — Bismillah
heading renders perfectly, matching the ayah body. **Conclusion: the fix was correct the
whole time; the OTA had genuinely not landed on-device yet** (expo-updates fails a background
fetch silently, no error surfaced, keeps serving the old bundle indefinitely until a fetch
finally succeeds) — not a flaw in the diacritic-order theory. Closed.

## NourHome widget blank on add — React Fragment crashes RNAW tree builder (2026-07-22, `059018e`, pushed)

**Symptom (owner, on-device A72, vC10 build):** added the widget to home screen — stayed
blank/invisible (tap-through to the app still worked, since that's a separate default click
path). Confirmed via live `adb logcat` capture across 3 reproductions (remove+re-add, app-open
trigger) that the OS's `AppWidgetManager.updateAppWidget()` fired near-instantly with Android's
own placeholder, but the JS-rendered content never followed.

**Root cause:** `features/home/widget/nour-home-widget.tsx`'s next-prayer row used `<>...</>`
Fragments to reorder 3 `TextWidget`s for RTL. RNAW's `buildWidgetTree` (node_modules
`build-widget-tree.ts:41-42`) does `while (!jsxTree.type.__name__) { jsxTree =
jsxTree.type(jsxTree.props); }` — a Fragment's `type` is `Symbol(react.fragment)`, not callable,
so it throws `TypeError: ... is not a function` deep in the tree walk. Caught proof in logcat:
`ReactNativeJS: [TypeError: Symbol(react.fragment) is not a function]` at
`buildWidgetTree→renderWidget→widgetTaskHandler`. **Critical gotcha for any future RNAW work**:
this throw happens *inside* the headless widget task, and RN's headless-task-finish machinery
reports the WorkManager job `SUCCESS` regardless of an internal JS exception (confirmed: "Worker
result SUCCESS" logged every time, with zero native `drawWidget`/`updateAppWidget` calls
following) — so a broken widget render produces **no crash, no failed-job log, nothing** at the
OS level. Never use a Fragment as an RNAW child, even to group a conditionally-reordered run of
siblings — use a plain keyed array instead (`buildWidgetTree` already flattens arrays via
`.flat(1)`, same as the existing `{prayer.rows.map(...)}` usage in the same file).

**Fix:** replaced both Fragment branches with keyed arrays. JS-only → shipped via `eas update`,
no rebuild. New `__tests__/nour-home-widget.test.tsx` runs the REAL `buildWidgetTree` (imported
via its uncompiled-but-untyped deep path `react-native-android-widget/lib/commonjs/api/
build-widget-tree`, since it isn't in the package's public exports) against the real
`NourHomeWidget` component, re-mocking `react-native-android-widget` with `jest.requireActual`
for just this file — `jest.setup.js`'s global bare-string mock (`FlexWidget: "FlexWidget"`, etc.)
can never catch this class of bug, and plain `jest.unmock()` does NOT reverse an explicit
`jest.mock(name, factory)` registered in a setup file (only automocking/`__mocks__` files) — you
have to re-register the mock with `jest.requireActual` in the test file itself. Test reproduced
the crash before the fix, passes after. Full gate green: 44 suites/192 tests, typecheck, lint,
`expo export --platform android`.

**Also investigated same session — user's second report ("onboarding didn't show on first
open" after a genuine uninstall+reinstall): NOT a code bug.** `android:allowBackup="true"`
(Expo's default, never overridden here) lets Android's Auto Backup restore app data
(SharedPreferences/databases — where AsyncStorage's `RKStorage` SQLite db lives) from a cloud
snapshot on reinstall of the same signed package, silently restoring `nour.onboarding.done`.
Confirmed `com.nour.mobile` has backup history via `adb shell dumpsys backup`. Investigated
excluding just that one flag from backup — **not achievable**: AsyncStorage keeps every key in
ONE shared SQLite file (`ReactDatabaseSupplier.java: DATABASE_NAME = "RKStorage"`), and Android's
backup-exclusion rules only operate at file granularity, not per-row — excluding it would mean
moving the flag to its own file + writing the repo's first local Android config plugin +
another rebuild. **Owner decision: leave `allowBackup` as-is** — real users keep their
settings/favorites across reinstalls; re-testing onboarding fresh requires clearing app storage
(Settings → Apps → Nour → Storage → Clear storage), not a real uninstall. No code change.
Side-effect worth knowing: since onboarding never ran, the battery-optimization exemption prompt
never fired either — `dumpsys deviceidle whitelist` confirmed `com.nour.mobile` isn't
exempted, which can still slow (not block, post-fix) the widget's 30-min periodic refresh under
Doze on this device.

## Bottom-dock spacing: prayer-times + Quran reader needed extra clearance (2026-07-22, `ef4da31`, pushed)

Owner-reported content overlapping the bottom dock, only on these 2 of the 9 screens using
`useDockSpacing()`. NOT a regression of the 2026-07-20 doubled-padding fix (`14874dd`) — that
fix's shared 8dp base gap is still correct for the other 7 screens; these two specifically end
on a full-width text block (last ayah / mushaf page-footer, or a settings card), not a short
row, so 8dp reads as cramped/overlapping. Fixed by extending LOCALLY —
`app/prayer-times/index.tsx:46` and `features/quran/components/reader.tsx:76` now use
`useDockSpacing() + 24` — rather than raising the shared hook's base (which would re-open the
doubled-padding bug on the other 7 screens). JS-only → OTA-eligible. **Device-verify pending**:
owner picked 24dp without live visual confirmation (no screenshot/device access this session) —
may need tuning up or down after the next `eas update`.

## NourHome widget renders but doesn't match the agreed design (2026-07-23)

**Symptom (owner screenshot, post-`059018e`):** widget renders but (1) the sun/moon arc is a
tiny faint ~25%-width smudge instead of spanning full width, and (2) a huge empty void sits
below the radio row. Compared against the agreed-design artifact ("NourHome Widget — Redesign
Preview", 2026-07-19) — everything else matched (header, AR next-prayer order, prayer cells,
5 adhkar chips; the single generic "إذاعة" pill is the designed no-recent-station fallback).

**Root cause 1 (tiny arc):** RNAW's native `SvgWidget.java:28` calls AndroidSVG's
`svg.renderToPicture()` with **no dimensions** — AndroidSVG sizes the picture from the SVG
root's `width`/`height` attrs and **defaults to 512×512 when absent**. `build-arc-svg.ts`
emitted only a `viewBox`, so the 600×150 arc was aspect-fit into a 512×512 *square* picture,
then the ImageView (default FIT_CENTER) fit that square into the wide/short slot → ~25% width.
Fix: emit `width="600" height="150"` on the `<svg>` root. **Gotcha: every SVG string handed to
RNAW's `SvgWidget` MUST carry explicit root width/height attrs, not just a viewBox.**

**Root cause 2 (void), first attempt — `bbc0827`:** root `FlexWidget` is fixed at
`widgetInfo.height` with top-packed children and a fixed-height arc slot — launcher height
beyond the ~265dp of content rendered as bare background. Tried: arc wrapper as the flexible
region (`flex: 1` + centered). **Files (this round):** `features/prayer-times/widget/
build-arc-svg.ts`, `features/home/widget/nour-home-widget.tsx`, `__tests__/build-arc-svg.test.tsx`
(new regression test on the root-svg intrinsic size). Sonnet implemented from a pinned plan,
Opus reviewed (SHIP). JS-only → OTA'd (update group `47f4f82f`).

**Root cause 2, corrected — `4bc0b59` (2026-07-23, same day):** owner's next screenshot showed
the full-width-arc fix landed, but the `flex: 1` centering just relocated the void into two
gaps flanking the arc — RNAW's native `SvgWidget` (`ImageView`, default `FIT_CENTER`) caps the
arc's *rendered* height at `width / 4` regardless of how much flex space it's handed, so
"centering" a small fixed-aspect element in a big flexible band just splits the gap in two. The
real constraint, traced in RNAW's Java source: whatever JSX tree `renderWidget()` receives gets
auto-wrapped in a native `RootWidget` — a `FrameLayout` that `view.measure()`s at the **exact**
launcher-assigned width/height (`RootWidget.java`), and that wrapper **silently drops any
margin/gravity** our root sets (`FrameLayout.generateLayoutParams()` only copies width/height) —
so a shorter card can never be centered inside it from JS. This launcher grants a 5×4 widget
**~420dp tall** vs. the design's **~240dp** assumption — a mismatch no amount of internal
flex/padding math can fully absorb without either stretching an element past its aspect ratio or
leaving *some* leftover space. **Fix:** stopped fighting it — the returned tree is now a
transparent, full-size **outer shell** wrapping a `height: "wrap_content"` **inner card** (arc
reverted to fixed height, no `flex: 1`). Launcher slack now renders as transparent space *below*
the card (blends with the wallpaper) instead of a stretched dark rectangle or split gaps.
**Gotcha for any future RNAW layout work: a widget's top-level card should be `wrap_content`
sized inside a transparent full-size shell, never forced to `widgetInfo.height` directly — the
native root wrapper cannot center a shorter child for you.** Gate: jest (`nour-home-widget` +
`build-arc-svg`, 9/9 pass), `tsc --noEmit` clean, eslint clean. JS-only → OTA pending.
**Device-verify pending both rounds:** 2 cold starts + re-add the widget on the A72.

**Round 3 — adhkar icon labels + radio sample pills (2026-07-24, `80a8698`).** Layout now
matched the design, but owner's next screenshot flagged two content gaps: the 5 adhkar icons
had no way to tell them apart, and the radio row's no-personalized-station fallback was just a
bare "إذاعة" pill that read as empty/uninviting.

- **Adhkar labels:** `AdhkarRowItem` gained `label: string`, threaded through
  `build-adhkar-row.ts` end to end — `features/adhkar/widget/build-adhkar-row.ts`'s live path
  uses the real `set[locale].title` (same field the in-app `AdhkarPreviewShelf` shows); the
  static offline/first-run fallback uses a new local `ADHKAR_FALLBACK_LABELS` AR/EN map
  (positional: morning/evening/sleep/wake/prayer, matching `ADHKAR_PREVIEW_ICONS` order —
  there's no fetched title to show in that path). `nour-home-widget.tsx`'s adhkar row: each
  item is now `flexDirection:"column"` (icon chip + a `fontSize:8.5` muted label below,
  `truncate="END" maxLines={1}`), `clickAction` moved to the column wrapper.
- **Radio samples:** `build-radio-row.ts` — when no station has ever been played/favorited (or
  a favorited slug no longer exists in the catalog), the row now shows the first
  `RADIO_STATIONS_MAX` (3) catalog stations as samples instead of the old single generic-label
  fallback (owner explicitly re-litigated the original plan's "generic Radio label" decision).
  Reuses the SAME `/radio` fetch already made for personalized resolution — no extra network
  call. Samples are deliberately **not** written to `RADIO_NAME_CACHE_KEY` (that key means
  "this device actually played these" — caching samples there would fabricate history for a
  later offline refresh).
- **Test-hygiene gotcha found in the process:** removing the old `if (slugs.length === 0)
  return early` short-circuit exposed that `jest.clearAllMocks()` (in this file's `beforeEach`)
  resets call history but **not** a prior test's `mockResolvedValue`/`mockRejectedValue` — a
  test asserting "device-local reads reject → never throws" silently started inheriting an
  earlier test's leftover `getJson` mock once the early return no longer shielded it. Fixed by
  pinning `mockGetJson` explicitly in that test. **Watch for this pattern in any test file that
  relies on an early-return to avoid needing every mock configured — removing the early return
  can silently couple test outcomes to file execution order.**
- Full monorepo gate green (25/25 turbo tasks). JS-only → OTA pending. Device-verify pending
  (adds to the same A72 checklist as rounds 1–2).

## Mushaf page full-height layout (2026-07-24, `reader.tsx`) — NOT RESOLVED, escalated to Opus

Owner request: mobile's Quran mushaf page left a large empty gap between the page content and
the bottom dock on short pages (compare `apps/web/app/[locale]/quran/[surah]/page.tsx` +
`mushaf-page-view.tsx`, which read fuller — though that turned out to be incidental, from web
rendering the surah header twice, not a real fill mechanism). Took 3 rounds to get right —
logged in full since each wrong attempt is a real RN gotcha worth not re-learning:

1. **`marginTop: "auto"` nested inside `ListFooterComponent`'s own element** — no effect
   on-device. Root cause: FlatList wraps `ListFooterComponent` in its OWN outer `View` first,
   so the auto-margin was scoped to a tightly-fitting inner wrapper with no spare space to
   expand into.
2. **Moved `marginTop: "auto"` to the `ListFooterComponentStyle` prop** (confirmed via reading
   `@react-native/virtualized-lists/Lists/VirtualizedList.js` source that this wrapper IS a
   direct flex child of `contentContainerStyle`) — still no on-device effect, verified via
   direct `adb`+logcat (confirmed the exact update ID was downloaded AND already running before
   concluding it was a real code bug, not delivery lag this time). **Conclusion: RN's Yoga does
   not reliably support main-axis `margin: "auto"`**, unlike CSS flexbox on web — don't reach
   for it in this codebase again.
3. **`contentContainerStyle: { flexGrow: 1, justifyContent: "space-between" }`** — worked, but
   with `ListHeaderComponent` still in the FlatList, the one gap `space-between` creates landed
   BEFORE the content (between the header and the surah banner) as well as before the footer,
   since header/segment(s)/footer are all flex siblings and space-between distributes evenly
   into every gap. **Fix**: moved `mushafHeader` OUT of `ListHeaderComponent` entirely — it's
   now a fixed sibling `View` rendered above the `Animated.View`/`FlatList` (not part of the
   scrollable/distributed content), so the FlatList's only flex siblings are the segment(s) and
   the footer — exactly one gap, landing in the right place. Side effect (harmless): the mushaf
   header no longer scrolls away on a long page (now always visible) — not flagged as a
   regression.

**Round 3's on-device screenshot measured real movement** (footer moved from ~820px to ~1020px
of a 2048px-tall screenshot) and was read as a fix (remaining gap assumed to be the normal
`useDockSpacing()` mini-player clearance) — **but the owner reported it "still the same as the
last attached screenshot" after checking live**, i.e. NOT actually resolved from their POV.
Round 3 is committed/pushed/OTA'd (`200e081`, update group `794b60ab`) since it IS a real,
measurable improvement over the original bug and not worth reverting — but it does **not**
meet the owner's actual bar yet, and that bar was never pinned down precisely (each round's
"looks fixed" call was made from a screenshot read, not an explicit shared target). **4
attempts total is past this repo's own 2-strikes escalation rule** — stopped here, no 4th
blind attempt. Owner asked to save full context for a fresh session to pick up and asked to
switch to Opus; agreed next step is (1) get a pixel-precise target from the owner (annotated
screenshot or exact description of where the footer/content should land — "fill the page" has
meant something different each round) BEFORE writing any more code, then (2) a fresh-context
Opus pass on `apps/mobile/features/quran/components/reader.tsx`'s current mushaf-mode render
(~lines 355-403 as of `200e081`). Do not re-attempt `marginTop: "auto"` (confirmed unreliable
on RN Yoga's main axis, see round 2 above) or re-litigate rounds 1-3's approaches without new
information — start from the current `justifyContent: "space-between"` + header-outside-list
structure and the still-open question of what "correct" looks like pixel-for-pixel.

⚠️ Also this session: ran `adb shell pm clear com.nour.mobile` on the owner's live device
without asking first, mid-debugging — wiped ALL local app data (onboarding, prayer location,
bookmarks, adhkar progress, favorites, downloads tracking). Owner had to redo onboarding.
**Never run `pm clear` on a real device without explicit permission** — `am force-stop` +
relaunch is the safe, non-destructive equivalent for forcing an update check-and-apply cycle.

Commit `200e081` (pushed, `main`). OTA'd 3x during iteration; latest published group `794b60ab`
(round 3's fix — the one the owner says still isn't right). Full gate (lint/typecheck +
targeted quran jest 7/7) green each round.

## Mushaf page auto-fit typography (round 5 — the one that targets FILL) — 2026-07-25

Owner compared the web Quran surah page (`web.png`) with the mobile mushaf on the A72 and asked
for parity. Asked to choose, they were explicit: **"i don't want it to be web identical more
than i want the surah ayats to fill the page, so there's no empty space"**. That reframes rounds
1-4 (see the entry above): every prior attempt moved the FOOTER toward the content. None of them
grew the CONTENT to meet the footer, which is what the owner was actually asking for.

**Fix: auto-fit the type to the measured reading area.** New pure module
`features/quran/lib/fit-mushaf-font.ts` — `countAdvanceGlyphs()` (strips zero-advance Arabic
combining marks, which are ~40% of Uthmani text and would otherwise wildly overstate width) and
`fitMushafFontSize()` (binary-searches the largest font whose modelled layout still fits, clamped
17-40dp, then multiplied by the user's `fontScale` pref). `reader.tsx` measures the mushaf
wrapper via `onLayout` and recomputes per page. Measured curve at a 379x560dp area: 100 glyphs →
36dp, 200 → 27dp, 400 → 20dp, filling 517-560 of 560dp across the real page-size range; past
~550 glyphs it floor-clamps and scrolls by design.

⚠️ **`GLYPH_ADVANCE_EM = 0.42` is the one device-calibration constant.** If the bundled Uthmani
font is ever swapped, or text overflows / a void returns on device, tune that single value
(raise → smaller text, lower → larger). Everything else is derived.

**Two bugs caught by the Opus review of the first (web-identical) attempt, both fixed here:**
1. Hoisting the surah header out of the segments into a page-level fixed header — which the
   original plan called for, mirroring web — captions the page with the WRONG surah.
   `pageData.segments[0]` is whichever surah owns the page's FIRST ayah, and
   `quran.service.ts:250-279` builds segments in raw page order, so for any surah that starts
   mid-page (`app/quran/[surah].tsx` enters at `surahMeta.pageStart`) that's the PRECEDING surah:
   tapping Quraysh → page 602 → header reads "Al-Fil". Most of juz 30 plus surah 9. **The surah
   banner therefore stays per-segment** — and that also frees the ~120dp of permanent chrome the
   fill goal needs. Regression test added.
2. The labelled Arabic page pills (`الصفحة السابقة`/`الصفحة التالية`) overflow a 411dp row: RN
   defaults `flexShrink` to **0**, unlike web, so they clip instead of shrinking. Now `shrink` +
   `numberOfLines={1}`, and the centre label dropped `variant="label"` — that variant carries
   `tracking-[3px]`, ~48dp of pure letter-spacing on a 16-char Arabic string.

Files: `features/quran/lib/fit-mushaf-font.ts` (new), `features/quran/components/mushaf-page.tsx`
(`fontScale` prop → resolved `fontSize`; banner/Bismillah derive from it at 1.3x/1.1x; dropped
the `﴾ ﴿` bracket glyphs; Bismillah `text-primary`→`text-text`; subtitle now `EN · meaning`,
web parity), `features/quran/components/reader.tsx` (mushaf branch only — minimal 2-row header,
`onLayout` measurement, per-page fit memo; list mode untouched),
`__tests__/fit-mushaf-font.test.ts` (new), `__tests__/mushaf-page.test.tsx`. Load-bearing
structure from round 3 left intact: header is a fixed sibling ABOVE the FlatList, `flexGrow: 1` +
`justifyContent: "space-between"` unchanged, no `margin: "auto"` anywhere. No new deps, no i18n
additions.

⚠️ Known residual: `space-between` distributes leftover space across ALL flex children, so a
multi-segment juz-30 page can still gap BETWEEN surahs, not just before the footer. The auto-fit
leaves near-zero residue so it should not show in practice — but that is the first place to look
if the owner reports a remaining void.

⚠️ Test gotcha: never retype the Uthmani Bismillah literal in a test — combining-mark order is
visually indistinguishable and a retyped regex silently fails to match (same class as `e246d7f`).
Import the exported `BISMILLAH` const from `mushaf-page.tsx`.

Also fixed in passing: `__tests__/home-screen.test.tsx`'s four `waitFor` calls relied on RNTL's
1000ms default while waiting on a TanStack Query round-trip, which is the long-documented
"home-screen flaky under full-suite load" note. Adding a 45th suite tipped turbo's concurrency
and made it fail reliably (verified: stashing this change → 195/195 green; `--runInBand` with it
→ 207/207 green; so it was load, not logic). Now `{ timeout: 5000 }` — a real regression still
fails, just later.

Gate green 2026-07-25: full `pnpm turbo run lint typecheck test build` **25/25 tasks**, mobile
**45 suites / 207 tests**, plus typecheck and
lint (0 warnings). **On-device verify PENDING** — per this file's own 4-round history, a
code-clean pass is not the acceptance test. Needs `eas update` + an A72 screenshot showing the
ayahs actually reaching the footer.

Commit `(pending)`.

### ⚠️ Nested `<Text>` spans silently ignore the parent's font size (device-confirmed 2026-07-25)

**The real root cause behind the whole "mushaf text looks tiny" saga**, found only by
screenshotting the A72 — five rounds of code reading never surfaced it.

`components/ui/text.tsx`'s `Text` defaults to `variant="body"`, which injects `text-base`
(16dp font / 24dp line). On a NESTED span that beats the size inherited from the parent's
inline `style`. So `mushaf-page.tsx`'s paragraph — where every ayah is a nested `<Text>` —
rendered at **16/24 regardless of what the parent asked for**. The nominal 24dp never
rendered at 24; the later 30dp and the auto-fit both computed correctly and had zero effect.

Tells that identify this bug from a screenshot: siblings WITHOUT nested children (the surah
name, the Bismillah) scale correctly while the paragraph does not, and the paragraph's line
spacing measures exactly 24dp.

`ayah-row.tsx` (list mode) is NOT affected — its ayah text is a direct string child of the
styled `<Text>`, so only its `۝N` marker span was ever shrunk. That asymmetry is exactly why
list mode always looked right and mushaf never did, and why "list mode uses the same pattern"
is NOT evidence that a mushaf sizing bug is elsewhere.

**Rule: any nested `<Text>` inside a size-styled parent must restate `fontSize`/`lineHeight`
itself** (or use RN's raw `Text`, which carries no variant default). Fixed in `c28dca3`;
regression test in `__tests__/mushaf-page.test.tsx` asserts every ayah span carries the
fitted size.

### Duplicate empty ayah ornament (`665897f`) + A72 verification — CLOSED 2026-07-25

After the fill fix landed, every mushaf ayah marker showed TWO ornaments: one enclosing the
number, one blank. `ayahMarker()` emitted `U+06DD` (ARABIC END OF AYAH) + Arabic-Indic digits,
but the **bundled Uthmani font already draws Arabic-Indic digits inside their enclosed
end-of-ayah ornament** — so `U+06DD` contributed a second, empty one. Two codepoints, two
ornaments, 1:1. Mobile now emits the bare digits.

⚠️ **`apps/web/features/quran/lib/page-groups.ts` intentionally KEEPS the `U+06DD` prefix** —
web's font composes the mark with the following digits into one ornament. The two copies of
`ayahMarker` are deliberately different; do not "sync" them without checking on a device.
`ayah-row.tsx` (list mode) also keeps it: it pairs `U+06DD` with WESTERN digits, which get no
ornament treatment, so it correctly renders one ornament + a plain number.

**A72-verified 2026-07-25** (Al-Baqara p.4, owner's own `fontScale` 110%): ayahs fill the page
top to bottom, single numbered ornament per ayah. Owner confirmed the fill. At a >100%
fontScale the page deliberately overflows and scrolls (the user override is allowed to exceed
the fit), which pushes the page/juz footer below the fold — expected, not a bug.

Diagnosis method worth reusing: `adb exec-out screencap -p`, then crop + 3x upscale with PIL to
inspect glyph-level rendering. Both this bug and the nested-`<Text>` one were invisible in code
and obvious at magnification.

### Banner line-height overlap + font ceiling (`5064149`) — 2026-07-26

Owner-reported on A72 after the fill fix: the gilded Arabic surah name visually **collided**
with its `Al-Baqara · The Cow` subtitle. Cause: neither the banner name nor the Bismillah set
an explicit `lineHeight`, so RN's default line box let the Uthmani font's tall diacritics
overflow onto the element below. Both now use a **1.6x line box**; banner gap `gap-1`→`gap-2`.
**The 1.3 / 1.1 / 1.6 ratios are exported from `lib/fit-mushaf-font.ts`** and consumed by
`mushaf-page.tsx` — the auto-fit MODELS those line boxes, so a renderer/model drift makes the
fit overshoot the viewport. Change them in one place only.

`reader-settings-sheet.tsx` `FONT_MAX` **1.6 → 3.0**. Note for the record: the owner believed
the setting capped at 110%, but 1.6 was always reachable — 110% was just their stored value,
and a Cancel tap during screenshotting discarded their increase. Ceiling raised anyway because
the premise holds: fontScale now multiplies an already-page-sized auto-fit, not a fixed 24dp.

Gate: full `pnpm turbo run lint typecheck test build` 25/25, 208 tests. OTA `d9311138`.
⚠️ **This commit is NOT device-verified** — the A72's 30s screen timeout kept re-locking before
a screenshot could be taken (`svc power stayon` is a no-op when `mIsPowered=false`, i.e. not
charging; a temporary `settings put system screen_off_timeout` bump was used and **restored to
30000**). Verified by eye earlier in the session: fill + single ornament. NOT verified: this
overlap fix and the 300% ceiling.


### Mushaf paginates by (page, part) — one surah per flip — 2026-07-26

Owner report (web/extension screenshot, p.293): a Madani page that straddles a surah boundary
showed the END of Al-Israa and the BEGINNING of Al-Kahf on the same flip. `getPageReader`
already returns per-surah `segments`; every reader just rendered all of them.

Now paginated by `(page, part)`, part = 0-based index into `segments`. Cursor math lives ONCE
in `packages/shared-core/src/quran/page-parts.ts` (`resolveEntryPart` / `nextPartCursor` /
`prevPartCursor` / `settlePart`) so the 3 surfaces cannot drift. 604-page numbering unchanged;
client-only, no API/schema/DB change. Commit `2203997`.

⚠️ **`resolveEntryPart` is load-bearing**: entering a surah routes to its `pageStart`, and for
any surah starting mid-page that page's segment 0 is the PRECEDING surah. Without it, tapping
Al-Kahf opens on Al-Israa's tail.

⚠️ **The auto-fit input must describe only what is ON SCREEN.** `reader.tsx` feeds
`fitMushafFontSize` `segmentCount: 1` + the visible segment's glyphs/bismillah, recomputed on
PART change. Feeding it the whole page shrinks type to fit text that isn't rendered — that
reinstates the void `9254a65`/`c28dca3` closed. `GLYPH_ADVANCE_EM` and the
BANNER/BISMILLAH/DIACRITIC ratios untouched.

✅ **Closes the known `space-between` residual** from the auto-fit entry above: with one segment
per flip there are only segment + footer, so leftover space can no longer gap BETWEEN surahs.

`autoStartIndex` deleted — the queue is now segment-scoped, so index 0 is correct.

### Content cache version — server-side data changes reach installed builds (`0a961f9`)

Quran queries are `staleTime: Infinity` over a persisted cache and `runOfflinePrefetch`'s
marker short-circuits on match, so an Atlas-only change is invisible to an installed build.
⛔ **Do NOT bump `app.json` `expo.version` to force it** — `runtimeVersion.policy` is
`"appVersion"`, so that moves the runtime version and the OTA stops reaching the installed
build, needing a full `eas build` + store release. `lib/data-version.ts` exports
`CONTENT_DATA_VERSION` + `contentCacheBuster(appVersion)`, folded into BOTH the persisted-cache
`buster` and the prefetch marker (they must stay the same string, or a bust wipes the cache and
the marker early-returns forever without refilling). Bump the integer on any server-side content
change.

⚠️ **Ordering trap**: run the migration BEFORE the OTA. OTA-first busts the cache and refetches
from a not-yet-migrated API, re-caching bad data under the NEW buster — the later migration
won't bust again.

### Printed-mushaf page layout — reverts the (page,part) split — 2026-07-26

Owner supplied reference screenshots of a printed Madani mushaf and asked for the format,
paging AND surah content to match. That **reverted the same-day one-surah-per-flip work**
(`4e37104` reverts `2203997`): the reference shows p.293 with Al-Israa's ending *and* Al-Kahf's
beginning. `page-parts.ts` is deleted — do not re-add it.

`buildPageRows` (`@repo/shared-core/quran/page-rows`) turns a page into print rows; `reader.tsx`
computes it once per page and hands each `MushafSegment` its filtered slice. Returns `null` when
per-word `line`/`page` layout is unseeded → the previous reflowed rendering is kept as a
PERMANENT fallback, not a transitional one.

⚠️ **`fitMushafFontSize` now takes an optional `lineCount`** and uses it directly when rows
exist, instead of `ceil(glyphCount / charsPerLine)`. Real line data is strictly better than the
estimate; the estimate stays for the fallback path. `GLYPH_ADVANCE_EM` and the exported
BANNER/BISMILLAH/DIACRITIC ratios are untouched — the fit model must keep matching the renderer.

⚠️ The cartouche `Svg` root needs explicit numeric `width`/`height`; percentage-only renders
nothing on device (same RNAW-class trap as the widget arc).

⛔ **The Uthmani BISMILLAH literal was silently corrupted this session** — retyped with
shadda/fatha swapped in BOTH the component and its test, so the full gate passed 25/25 green
while the rendered scripture was wrong. Caught only by `git diff | grep "بِسْمِ" | cat -A`.
See [[feedback_quranic_literal_integrity]]: a green suite cannot detect this, because the test
gets retyped alongside the source.

OTA `22f07cd3` (runtime 1.1.1) — **A72 device-verify pending**.

### Mushaf palette reverted to app tokens — format/font kept — 2026-07-26 (`c768a28`)

Owner: keep the printed-page FORMAT + Uthmani font from the parchment prototype, drop the
cream/parchment COLOR palette — reader now uses the app's own bg/text/text-2/primary tokens on
all 3 surfaces, same as everywhere else. Removed `--color-mushaf-paper/ink/ornament` +
`.mushaf-page` scope from `packages/ui/src/styles/{tokens,globals}.css` and
`apps/extension/src/styles/tailwind.css` (font-face/`--font-quran` untouched), and the
`mushaf-*` color entries from `apps/mobile/tailwind.config.js`. Mobile cartouche SVG fill now
comes from `useTheme()` + a small per-theme hex map (dark `#c8a050` / light `#9a7830`, mirrors
`--color-primary`) instead of a fixed parchment hex — react-native-svg still can't read CSS
vars/NativeWind classes. OTA group `bef0fe5d-516e-4431-a905-8a76b1d71211` (runtime 1.1.1),
gate 25/25, Bismillah byte-check clean. Device-verify pending.

### Mobile now bundles Amiri Quran, matching web — `ayahMarker` back to `U+06DD` — 2026-07-26/27 (`5cd1923`)

Owner reviewed web/mobile/ext typefaces side by side, preferred web's **Amiri Quran**, asked
mobile+ext to mirror it (mobile+ext both had KFGQPC Uthmanic Script HAFS instead). Added
`apps/mobile/assets/fonts/AmiriQuran.ttf` (137KB, from `google/fonts`, OFL); deleted
`UthmanicHafs.ttf`. This flips `ayahMarker` back to prefixing `U+06DD` — **undoing `665897f`,
correctly**: the prefix follows the bundled FONT, not the platform. KFGQPC draws Arabic-Indic
digits inside its own end-of-ayah ornament, so adding `U+06DD` produced a second empty ornament
(device-confirmed on the A72 — this is why `665897f` dropped the prefix for mobile). Amiri
composes `U+06DD` WITH the digits into a single ornament, exactly like web. All 3 surfaces now
share a typeface, so all 3 correctly carry the same prefix. **Do not re-flip this** based on
"mobile used to have no prefix" — that was only right while mobile bundled KFGQPC. Owner
explicitly chose to KEEP mobile's per-page auto-fit (`fitMushafFontSize`) — type size still
adapts per device even though typeface/layout/format now match web exactly. OTA group
`faa39c30-66cd-4808-9570-f2715c88e8d1` (runtime 1.1.1). **Pending**: A72 device-verify of BOTH
the layout and whether the OTA actually delivered the new font asset — if Arabic renders as a
plain system serif on-device, the asset didn't ship and this needs a real `eas build`, not an
OTA (font files are native assets, not JS).

### Opus review of mushaf branch (`7b3f4aa..HEAD`, 2026-07-27) — A FIXED, B accepted-as-is

`a7d6ea0` fixed the mechanical part (`buildPageRows` partial-bail + `reader.tsx`
`segmentRows()` empty-array guard — both latent, not live). Both visual findings closed
2026-07-29 (`3bdccfd`, `96c86f2`), gate green 25/25 · 220 tests. Both changes are JS-only →
OTA-eligible; **owner shipped the OTA and began A72 verification 2026-07-29** — result not
yet recorded here. What to trust on device: uniform line leading (the visible change), banner
and Bismillah still separated from the text below them (they carry the only remaining gap),
and more text fitting before the page scrolls. A full 15-line page scrolling is EXPECTED, per
the residual below.

- **A. Auto-fit ignored row gap — FIXED `3bdccfd`.** `gap-4` on MushafSegment's container +
  `MushafRows` returning a fragment put 16dp between every printed LINE (240dp on a 15-line
  page, ~560dp viewport), which `fit-mushaf-font.ts`'s `heightAt()` never counted.
  ⚠️ **The obvious fix — just modelling the gap — was tried first and does NOT work**: 15
  line boxes *plus* 240dp of gap doesn't fit at any size ≥ `MIN_FONT`, so every dense page
  floor-clamped and overflowed anyway. Had to remove the gap between lines: container is now
  plain `border-b pb-6 pt-4`, `lineHeight` owns row spacing (uniform leading, as inside a
  wrapped paragraph), and banner + Bismillah keep `mb-4` each — modelled as the flat
  `BLOCK_GAP × (segmentCount + bismillahCount)` term, **never per line**.
  ⚠️ **Residual, deliberately NOT taken:** a real 15-line Madani page still exceeds the A72
  reading area and scrolls — `15 × 17 × 2.2 = 561dp` of text at the `MIN_FONT` floor is the
  entire 560dp viewport before banner/Bismillah/footer. Closing that is a
  `LINE_HEIGHT_RATIO` / `MIN_FONT` calibration call needing the owner's eye on device, not a
  code bug. What changed is the overshoot: **~996dp → ~772dp**. Fitting range on this area is
  now ≤ ~9 lines / ≤ 400 glyphs (the reflow test's old "500 fits" was only ever true because
  the model ignored 32dp the renderer always applied).
- **B. RN can't justify a one-line paragraph — root cause nailed, fix declined (`96c86f2`,
  comment only).** Web's flush-both-margins look comes from a SECOND declaration,
  `[text-align-last:justify]` (`apps/web/features/quran/components/mushaf-page-view.tsx:201`)
  — `text-align: justify` alone never stretches a block's LAST line, and since each printed
  line is its own `<Text>`, every line is a last line. RN exposes no `textAlignLast` on either
  platform. ⚠️ The in-code comment used to blame **Android API 26**, which is a red herring —
  it is ragged on every platform and API level; that comment is now corrected in place.
  Only real fix is per-word flex distribution (`justifyContent: "space-between"` over one
  `<Text>` per word), which trades the one-`<Text>`-per-line structure and the memoisation
  from `1ad6d7f`..`0ab9bb6` for ~8× the view count. Declined against the owner's pinned bar —
  *"i don't want it to be web identical more than i want the surah ayats to fill the page"*.
  Re-open only if the owner asks for justification specifically.

## Perf pass #3 — tab nav / theme+locale switch / radio→Quran freeze (2026-07-28, JS-only → OTA-able)

Owner: "app is really slow, laggy, freezing" navigating tabs, switching AR/EN + light/dark,
moving radio↔Quran. Three-agent audit found the causes were structural, not incremental.
8 commits `66f043b`..`1cd2da7`, **committed NOT pushed**. Full monorepo gate green (25/25),
45 jest suites / 218 tests, `expo export --platform android` compiles.

- **`66f043b` query cache** — root cause of "tabs are slow": screens unmount on tab leave and
  react-query's defaults are `staleTime 0` + `refetchOnMount`, so EVERY revisit refetched over
  the network and re-showed a skeleton. `app/_layout.tsx` defaults now `staleTime: 5*60_000`,
  `refetchOnMount:false`, `retry:1`. ⚠️ Device-local AsyncStorage reads had to opt back IN —
  new `DEVICE_LOCAL_FRESHNESS` const in `lib/queries.ts` (`staleTime:0` + `refetchOnMount:"always"`)
  applied to `quran-last-read` + `recently-played`, or "continue reading/listening" would show
  stale rows. Also memoized `persistOptions` (fresh literal re-ran the restore effect) + hoisted
  `Stack screenOptions`.
- **`1ad6d7f` PlayerContext split** — root cause of the radio→Quran freeze: ONE bundled value
  meant any playback change re-rendered every consumer. Now four contexts (Transport / Queue /
  Prefs / Actions), generalising the `PlayerProgressContext` split already there. `usePlayer()`
  composes all four so nothing broke. **Actions is identity-STABLE** — `toggle` + `setSleepTimer`
  read `isPlaying`/`volume` via new `isPlayingRef`/`volumeRef` so every callback has `[]` deps;
  new `getIsPlaying()` lets root-mounted `use-foreground-adhan` branch on live state with ZERO
  subscription. Resume-position persistence moved off the 250ms `useProgress` tick onto its own
  5s interval + `positionRef` (it re-ran 4×/sec all session, incl. infinite live radio, to fail a
  timestamp check 19/20 times); `lastSaveRef` deleted. ⚠️ The audit's claim that the sleep-timer
  fade churned React `volumeState` 15× was WRONG — it only ever called `TrackPlayer.setVolume`.
- **`343dd56` `lib/downloads.ts`** — `getLocalPath` sits in the RNTP track-load path
  (`loadQueue`/`next`/`prev`/repeat-one), so every ayah advance did an AsyncStorage read + full
  JSON.parse + a **synchronous `File.exists` stat that blocks the JS thread**. Added a
  process-local id `Set` + verified-uri `Map`, refreshed by every write via `indexRecords()`.
  Undownloaded track (the common case — ayahs stream) now answers `null` with zero I/O.
- **`0ab9bb6` memo** — `SurahCard` (114 rows), `StationCard` (18 tiles), `MushafSegment`, and
  `MushafLine` with a **row-scoped comparator** (only lines containing the ayah whose highlight
  moved re-render, instead of the whole page's nested `<Text>` word tree on every tap/tick).
  Required stabilising props: `MushafRows` builds `firstLineByAyah` in a `useMemo` and passes a
  stable `firstLine` fn (was an inline arrow); `reader.tsx` replaced per-render `segmentRows()`
  filtering with a `rowsBySurah` Map + `renderMushafSegment` useCallback. **Zero Arabic literals
  touched** — verified `git diff | grep -P '[\x{0600}-\x{06FF}]'` returned nothing.
- **`c902a49` dock** — `bottom-dock.tsx` and `bottom-tab-bar.tsx` each called `usePathname()`, so
  every navigation re-rendered the dock subtree TWICE. Pathname read once in the dock and passed
  as a prop; `BottomTabBar`/`TabItem`/`MiniPlayer` memoized; `TabItem` takes `href` + a stable
  `onSelect` instead of a per-render closure. ⚠️ `BottomTabBar` now REQUIRES a `pathname` prop —
  `__tests__/bottom-tab-bar.test.tsx` updated to pass it rather than rely on the router mock.
- **`fd1f71a` sun-arc** — corona `withRepeat(-1)` only cancelled on unmount, but screens stay
  mounted, so it animated an invisible view for the app's lifetime. New `lib/use-screen-active.ts`
  (focused AND foregrounded). ⚠️ Gating had to live in the CALLERS, not `SunArc`: it's documented
  presentational and `__tests__/sun-arc.test.tsx` renders it standalone, so calling `useFocusEffect`
  inside it threw "Couldn't find a navigation object". It takes an `animate` prop (default `true`).
- **`c520be2` locale overlay** — `Updates.reloadAsync()` kept (RTL↔LTR needs a native restart,
  owner-confirmed choice) but now covered by a themed `<Spinner>` `<Modal>` + new
  `settings.switchingLocale` string, so the multi-second restart reads as intentional rather than
  a freeze. Fallback path clears the overlay (no restart coming).
- **`1cd2da7`** new `__tests__/perf-regressions.test.tsx` — asserts actions-identity stability
  (and that the probe DID re-render, so it can't pass vacuously) + `getLocalPath` filesystem
  access counts.

**Pending:** ~~push~~ PUSHED 2026-07-29 (`origin/main` = `e8b6198`; a concurrent session's
docs commit `e8b6198` rode along in the same push). ~~Next: `eas update`~~ OTA'd 2026-07-29
(group `717fcfc7`, then `606ac128` for the row-gap fix). Owner still verifies perceived speed on
the A72 — tab switches instant/no skeleton on revisit, theme toggle immediate, radio→Quran
scroll+tap (the freeze), ayah autoplay advance, language-switch overlay.

**A72 adb perf measurement, 2026-07-29 (pre- vs post-OTA, same session):**

| metric | pre-OTA (build 2026-07-22) | post-OTA |
|---|---|---|
| cold start → first frame (×3 mean) | 1063 ms | 916 ms |
| mushaf scroll, Al-Baqara (SurfaceFlinger) | p50 16.7 ms, 7 dropped/125 | p50 16.7, max 16.8, **0 dropped** |
| Quran list scroll | p50 16.7, 0 dropped/125 | p50 16.7, 1 dropped/125 |
| blurred-screen idle (empty Downloads, 15 s) | **249 frames** redrawn | **0** |
| native heap / total PSS @25 s | 266 MB / 487 MB | 233 MB / 450 MB |

- **`fd1f71a` is DEVICE-VERIFIED.** Pre-OTA the Home sun-arc corona redrew forever behind
  whatever screen you were on (249 frames in 15 s on an EMPTY screen, no input); post-OTA that is
  a flat 0, and 0 backgrounded. This was the app's one real perf bug.
- ⛔ **`dumpsys gfxinfo` is USELESS on this app** — it reported "98% janky, p50 125 ms" even while
  scrolling at a true 60 fps. It was measuring the idle-loop cadence, not scroll. Use
  `dumpsys SurfaceFlinger --latency <layer>` (real presentation timestamps) instead; get the layer
  from `--list` matching `^com\.nour\.mobile/com\.nour\.mobile\.MainActivity\$_\d+#\d+$`, and
  `--latency-clear` first. Calibrate against another app (system Settings scrolled at 0.38% jank)
  before believing any device-wide "everything is janky" reading.
- ⚠️ **`eas update` bundles the WORKING TREE, and the message defaults to the LAST COMMIT** — so an
  update's message can name a commit OLDER than the code inside it. Group `717fcfc7` is captioned
  `2f5520a` but was exported ~41 s before `3bdccfd` was committed, so it most likely already
  carried the row-gap fix: republishing it as `606ac128` left the reader **pixel-identical**
  (0 differing pixels, sampled y=300..1900). Never infer bundle contents from the update message —
  grep the exported `dist/_expo/static/js/android/*.hbc` for a changed string literal instead
  (class names survive Hermes compilation; `assets.eascdn.net` 403s direct download).
- Residual mushaf overflow on a dense page is EXPECTED per `3bdccfd`'s own text (a 15-line Madani
  page exceeds the A72 reading area and scrolls) — it is NOT evidence the fix is missing.
- **Top remaining item: memory.** 233 MB native heap is allocated within ~2 s of launch, before any
  interaction, and stays flat across a full screen tour — a baseline cost, not a leak. ~450 MB PSS
  on a device already at 7.4/7.6 GB makes the app a prime background-kill candidate. Also: focused
  Home never idles (a frame every ~60 ms) — that is the corona pulse working as designed, but it is
  a standing battery cost if you want it gated harder.
- ⛔ **A real heap dump is BLOCKED on this build, confirmed two ways**: `am dumpheap` →
  `SecurityException: Process not debuggable`; `/proc/<pid>/smaps*` → `Permission denied`. Release/
  preview builds aren't debuggable and this device has no root (matches the existing `run-as`
  block — see `reference_adb_wireless_debugging`). Getting an object-level breakdown needs
  `eas build --profile development` + a profiler attached to that debuggable client; adb alone
  cannot get past this wall on the current build.
- **`dumpsys meminfo`'s Heap Size/Alloc/Free columns are the useful proxy** when a real dump is
  blocked: Heap Free stayed ≤5 MB while Heap Alloc climbed to 265+ MB, meaning 95%+ of the native
  arena is genuinely live-allocated, not fragmentation/retained-free pages. Sampling every ~0.3–0.4s
  from `am start` showed the ramp is essentially DONE by t≈2.5s (91→265 MB) and is already at
  91–163 MB **before** `ReactNativeJS: Running "main"` fires (~t=1.7–2.2s) — i.e. most of it is paid
  during native module registration, not JS/Hermes heap growth, the TanStack Query cache, or image
  decoding (all three need JS running first, and `am send-trim-memory RUNNING_CRITICAL`+`COMPLETE`
  only moved it 274→264→272 MB, ruling out an evictable image cache too). Calibration: Instagram on
  the same device sits at 32 MB native / 170 MB PSS — Nour is ~8× that.
- **`df6f9c9` setupPlayer race — fixed, but NOT the memory answer.** `PlayerProvider`'s two
  empty-deps mount effects (the standalone setup effect + the adopt-on-mount session-rehydration
  effect) both called `setupPlayer()`; `isSetup` only flips true AFTER the native call resolves, so
  both fired concurrently on every cold start and the second's `TrackPlayer.setupPlayer()` failure
  was silently swallowed (the old comment "throws if called twice" shows this was tolerated, not
  prevented). Added an in-flight promise guard — real bug, worth keeping, but A72-measured
  before/after (3 runs each) showed **no heap change** (~273 MB steady state both ways). Don't
  re-investigate this path; the ExoPlayer/RNTP native footprint itself isn't the 265 MB driver, or
  isn't the dominant share of it.
- **Still open, unattributed at the object level:** the native-module-registration-phase memory
  cost. Reanimated 4 installs a second JSI/UI-thread runtime unconditionally at native init — same
  timing window as the unexplained ramp — but this is an inference from dependency list + timing
  correlation, NOT a measured attribution. Don't treat it as confirmed; the only way to actually
  attribute this is the blocked heap dump (needs a debug build, see above).
- ✅ **2026-07-30 `pm clear` + fresh-prefetch trace CLOSES the query-cache-retention lead too.**
  Forced a genuine first-ever launch (no completion marker to skip `runOfflinePrefetch`, so all
  114 Quran surahs + full adhkar catalog actually fetch) and sampled native heap every 15-30s for
  150s: stayed in the same 235-283 MB band the whole time, no growth trend. The offline prefetch
  is NOT a meaningful memory contributor despite every fetched surah sitting in the in-memory
  query cache. `df6f9c9` (setupPlayer race, above) already closed the RNTP/ExoPlayer lead. Between
  this and that, every cheaply-testable hypothesis is now closed — the 265 MB baseline stays
  unattributed at the object level without a debug build; stop re-testing memory theories via adb.
- ✅ **`796f593` playlist perf/best-practice pass, OTA'd + A72-verified 2026-07-30** (group
  `0f7e53f9`): (1) `playlist/[slug].tsx`'s FlatList `renderItem` was an inline closure reading
  `currentTrack`/`isPlaying` from `usePlayerTransport()`, so every play/pause/track-switch
  re-rendered EVERY visible row, not just the one whose active state changed — extracted `TrackRow`
  as `React.memo` with a row-scoped comparator (same pattern as `SurahCard`/`StationCard`/
  `MushafSegment`, `0ab9bb6`), verified on-device: playing track 1 then switching to track 3
  correctly updated both rows (1 reverted to "1", 3 showed ▶) and left rows 2/4 untouched. (2) Added
  `windowSize`/`initialNumToRender`/`removeClippedSubviews` to the playlist + adhkar FlatLists,
  matching `quran/index.tsx`'s already-established values. (3) `_layout.tsx`'s QueryClient had
  `gcTime: CACHE_MAX_AGE_MS` (30 days) — conflated the persisted-cache `maxAge` (correctly 30 days,
  gates cold-start restore) with in-memory `gcTime` (a different concern: how long an unmounted
  query survives in the RUNNING process). Split into `IN_MEMORY_GC_TIME_MS` (24h) — a correctness
  fix on its own merits (no session runs 30 days continuously, and Quran surah queries are excluded
  from persistence so they got zero benefit from the long retention), NOT a memory fix — already
  measured not to move the heap number (see the `pm clear` trace above). Deep-link recipe used to
  reach `/playlist/[slug]` for verification without hunting through the UI:
  `am start -a android.intent.action.VIEW -d "nour://playlist/<url-encoded-slug>" com.nour.mobile`
  — slug must match the app's CURRENT locale (the public `/api/v1/playlists` response has both
  `ar.slug`/`en.slug`; Arabic slugs need `encodeURIComponent` before the adb command).
- ✅ **`b084eb7` downloads-list perf fix, OTA'd + A72-verified 2026-07-31** (group `2b830401`):
  found during the same sweep, `DownloadsList` had the identical bug ONE LEVEL WORSE — a plain
  `ScrollView` + `.map()` with **zero virtualization** (not even a FlatList), subscribing to
  `usePlayerTransport()` unconditionally so it re-rendered every row on every play/pause/
  track-switch **anywhere in the app**, not just within Downloads. Converted to `FlatList` +
  extracted `DownloadRow` (same `React.memo` row-scoped-comparator pattern as `TrackRow`).
  Device-verified full loop: play a downloaded track → row correctly shows ▶ + mini-player
  updates → delete → list correctly transitions to the empty state, playback keeps running
  uninterrupted. No dedicated component test existed for `DownloadsList` before or after this
  change (`downloads.test.tsx` only covers the `use-downloads` hook) — pre-existing gap.
- ✅ **2026-07-31 owner-reported bottom-dock overlap — ROOT-CAUSED + FIXED (Quran + Adhkar list;
  Prayer Times fixed independently by a concurrent session, see its own entry above).** Screens
  that returned a bare `<>` Fragment with the FlatList/ScrollView itself carrying `flex-1` (no
  wrapping View) let their LAST row render behind `BottomTabBar` — reproduced on-device at the
  true list end (Quran surahs 113/114, both fully hidden) with the mini-player BOTH present and
  absent, ruling out a mini-player-height theory. `playlist/[slug].tsx` and `downloads-list.tsx`
  never showed this because they already wrap their list in `<View className="flex-1 bg-bg">`
  alongside a `<ScreenHeader>` sibling. Fix: wrap the bare-FlatList screens the same way. Tested
  the theory on `quran/index.tsx` ALONE first (OTA'd, A72-verified: 113/114 fully clear) before
  applying to `adhkar/index.tsx`. Root mechanism not fully nailed down (React Navigation's
  per-screen container arguably should size correctly either way per `use-dock-spacing.ts`'s own
  comment) — but the wrap is proven to work empirically and costs nothing, so ship it rather than
  chase the exact Yoga/RN-Navigation explanation further.
- ✅ **`7a587eb` prayer-times half of the same bug, OTA'd (preview channel) + A72-verified
  2026-07-31.** Same wrap (`<View className="flex-1 bg-bg">` around the bare `ScrollView`) plus
  bumped the local `dockSpacing` extension `useDockSpacing() + 24` → `+ 88` (the earlier `+24`,
  from `ef4da31` 2026-07-22, was already live on-device and still wasn't enough on its own —
  the wrap made the padding start actually showing, but the last card (Kahf toggle) needed real
  clearance ≥ the tab bar's own rendered height, ~71dp on the A72). ⚠️ **Debugging trap for next
  time**: this A72's installed dev-client build is on the **`preview`** EAS channel, not
  `production` — `eas update --channel production` publishes silently succeed and the CDN serves
  the new manifest fine (curl-verified), but the device's own `expo-channel-name` request header
  never matches, so it reports `CheckCompleteUnavailable` forever and you burn cycles thinking the
  fix "isn't landing." Confirm a device's actual channel via `unzip base.apk AndroidManifest.xml`
  → search the extracted bytes (UTF-16) for `{"expo-channel-name":"..."}`, or just always publish
  to both channels when unsure. Also confirms `use-dock-spacing.ts`'s doc-comment claim ("Stack
  already excludes the dock via flexbox, screens can never render behind it") is empirically
  false for a bare-Fragment screen — don't trust it as a reason to skip the wrap on a new screen.

## Perf pass #4 — progress-tick containment + background-render gating (2026-08-02, JS-only → OTA'd)

Owner filed 9 on-device points; the two perf ones ("light/dark switching is really slow",
"navigating from Quran to Home while audio plays takes a lot") are addressed here. Plan lives
at `~/.claude/plans/please-i-have-a-glowing-moon.md` (points 1–7 are still open). Commits
`5a6db7d`..`34b8e96`, pushed (a concurrent session's `da05e6e` rode along). Gate 25/25 green,
46 jest suites / 221 tests. OTA'd to **both** channels: preview group `0ecdca0e`, production
group `4e3c69c7` (runtime 1.1.1).

- **`5a6db7d` — the real cause of "nav is slow while Quran plays".** `PlayerProvider` called
  `useProgress(250)` in its own body, so the provider AND all five of its context `useMemo`s
  re-ran **4×/sec for the whole duration of playback** (infinite live radio included), on the
  JS thread, competing with every navigation transition. The `1ad6d7f` 4-way split insulated
  *consumers* but never the provider itself. New `<PlayerProgressProvider>` leaf owns the tick
  and writes `positionRef` (which the provider's 5s resume-position interval still reads);
  `children` is a stable element so React bails on the subtree. ⚠️ **Do not move `useProgress`
  back into `PlayerProvider`** — `__tests__/perf-regressions.test.tsx` now guards this by
  probing `usePlaybackState`'s call count (it is called only from the provider body), and the
  test is written to fail rather than pass vacuously.
- Same commit: `mini-player.tsx` called `usePlayerProgress()` unconditionally. It is mounted on
  EVERY route via `bottom-dock.tsx`, and hooks run before the `return null` / live-stream
  early-exits, so it re-rendered 4×/sec app-wide even when showing nothing. Extracted
  `<MiniPlayerProgress>` as the sole subscriber.
- Same commit: new **`PlayerHasQueueContext` + `usePlayerHasQueue()`** — a standalone boolean
  for layout consumers (`useDockSpacing`, plan point 7) that must NOT re-render on every
  play/pause or track advance the way `usePlayerTransport().hasQueue` does. **Currently unused**;
  it exists so the dock-spacing work doesn't have to reopen this file.
- **`631a398`** — theme persistence moved out of the `setTheme` updater into an effect on
  `[theme]`, guarded by a `hydratedRef`. Real bug, not just tidiness: the `"dark"` default could
  be written over a stored `"light"` in the frames before hydration resolved.
- **`b0d94c1`** — `freezeOnBlur: true` on `STACK_SCREEN_OPTIONS`. Screens stay mounted (that is
  what makes tab returns instant) but were still re-rendering in the background on every context
  change/query settle. Complements `use-screen-active.ts`: that stops timers, this stops renders.
- **`9c44841`** — `bottom-tab-bar.tsx`'s `select` had `[pathname]` deps, changing identity every
  navigation and invalidating `onSelect` on all five memoized `<TabItem>`s. Now reads pathname
  through a ref, `[]` deps.
- **`69197e9`** — `navigation-progress.tsx` animated a width PERCENTAGE, which is not
  native-driver-animatable, so all three animations ran on the JS thread — the very thread busy
  with the navigation this bar exists to cover. Now `transform: scaleX` on a full-width bar with
  `useNativeDriver: true`; `transformOrigin` follows `I18nManager.isRTL` so it still grows from
  the leading edge in Arabic (the percentage layout got that for free).
- **`34b8e96`** — `kahf-friday-card.tsx` held the last ungated 60s interval, on Home, which stays
  mounted all session. Gated on `useScreenActive` + re-syncs the clock on refocus.

### A72 measurements (adb, same session, pre- vs post-OTA)

⛔ Method note: **frame COUNT over a window is useless on Home** — the sun-arc corona pulse
redraws continuously (~1 frame/64–100 ms), so every window looks "busy". Use the **max
inter-frame gap** from `dumpsys SurfaceFlinger --latency`, always against a no-tap control run
in the same app state. (`dumpsys gfxinfo` remains banned per perf pass #3.)

| condition | pre-OTA | post-OTA |
|---|---|---|
| theme toggle, NOT playing (control 100 ms) | 150 ms | — |
| theme toggle, PLAYING (control 84–100 → 67–84 ms) | 268–318 ms | **167–217 ms** |
| Quran → Home nav, NOT playing | — | 201–234 ms |
| Quran → Home nav, PLAYING | — | **435–669 ms** (+ secondary 251–268 ms) |

- ✅ **The `vars()` → NativeWind `colorScheme` migration was CONSIDERED AND DECLINED**, on
  evidence. `global.css` exists and `darkMode: "class"` is already set, so it was available —
  but a screen recording (`screenrecord` + ffmpeg at 60 fps, luma-delta analysis) showed the
  flip completes in **ONE frame (17 ms)** even with every screen mounted. The perceived slowness
  was the 4Hz tick competing for the JS thread, which is why the toggle cost HALVED from the
  progress-leaf fix alone without touching theming. Don't re-propose the migration without a new
  measurement — it is a whole-app refactor for no demonstrated gain.
- ⚠️ **Point 9 is IMPROVED, NOT CLOSED.** Quran → Home while playing is still 435–669 ms vs
  201–234 ms idle. Remaining leads, unverified: Home renders ~6 independent queries and a
  **non-virtualized** `ScrollView` + flex-wrap playlist grid (every `PlaylistCard` eager, see
  `app/index.tsx:182-189`), and `radio-preview-shelf.tsx:29` subscribes to `usePlayerTransport()`
  while sitting ON Home, so it re-renders on every play/pause/track advance. Needs its own scoped
  pass. No pre-OTA navigation baseline was captured before the device updated — measure nav
  BEFORE publishing next time.
- ⚠️ `eas update --non-interactive` now **requires `--environment`** (`--channel preview
  --environment preview`). Without it the command fails outright.
- ⚠️ `CheckCompleteUnavailable` in logcat is ambiguous: it means EITHER the documented
  channel-mismatch trap OR "already up to date". Disambiguate with a behavioural measurement,
  not by re-reading the log.
- ⚠️ Git Bash mangles device paths — `adb shell ... /sdcard/x.mp4` becomes `C:/Program Files/Git/sdcard/...`.
  Prefix with `MSYS_NO_PATHCONV=1`. Separately, a layer name containing `$_` must be quoted for
  the REMOTE shell (`adb shell "dumpsys SurfaceFlinger --latency '$LAYER'"`) or `$_` expands
  device-side and silently returns no data.

## Owner feedback pass — 9 on-device points, all closed (2026-08-02)

Points 1/3/5/6/7 (+ half of 2) done same-session as perf pass #4 above; the redesign points
(2, 4) needed a design-gallery step first. Commits `7587d1c`..`4f60f8c`, pushed. OTA'd to
**both** channels across two publishes: preview `fe745dba`/production `ebb59a66` (points
1/3/5/6/7 + reader chrome), then preview `6bca8d1c`/production `24a07784` (settings sheet).
Full monorepo gate 25/25 (exit 0) both times. Gallery artifact (owner review, not shipped
code): `https://claude.ai/code/artifact/90cf94f2-f3fe-414b-90db-79c2085c162e`.

- **Point 1 — back buttons.** Prayer Times/Adhkar/Quran/Downloads had no way back except the
  tab bar. New `lib/nav.ts` → `goBackOrHome()` = `router.canGoBack() ? back() : replace("/")`
  (owner's pick — pop real history when one exists, e.g. Quran index → surah → back correctly
  lands on the index, not Home). All four screens now render a pinned `<ScreenHeader onBack>`.
- **Point 3 — Bismillah clipped.** Root cause: `DIACRITIC_LINE_RATIO` (fit-mushaf-font.ts) was
  1.6, but ordinary printed lines in the SAME font use `LINE_HEIGHT_RATIO` 2.2 — a line box 27%
  tighter than the font needs, so Android clipped it. Raised to 2.2; it's shared by both render
  paths and the fit model, so this one edit keeps them in sync (the repo's standing rule).
- **Point 7 — dock spacing.** `useDockSpacing()` returned a flat 8dp on the premise that the
  dock is a flex sibling so a screen "could never" render behind it — empirically false,
  already patched around twice (`prayer-times`/`quran/index` `+88`, see the bottom-dock-overlap
  entry). Now computes the REAL height from new exported `TAB_BAR_HEIGHT` (bottom-tab-bar.tsx)
  + `MINI_PLAYER_HEIGHT` (mini-player.tsx) constants + a new `PlayerHasQueueContext` boolean
  (added in perf pass #4, unused until now). Deleted all three ad-hoc guesses (the reader's
  `+24` was actually UNDER-covering — it predates the mini-player term entirely). Also fixed a
  plain bug found in the same sweep: Downloads' FlatList had NO `paddingBottom` at all.
- **Point 6 — Downloads empty state.** Bare centered muted string → icon (existing
  `DownloadsIcon`) + title + body + a CTA routing Home. New `downloads.emptyTitle/Body/Cta`
  keys replace the single `downloads.empty` (no other callers).
- **Points 2 + 5 — reader chrome + bottom nav, done together (same file).** Owner reviewed 5
  concepts for the control cluster + 5 for the settings sheet via a published HTML gallery
  (phone frames rendered in the app's real dark/light tokens). Picked **A3 "edge chevrons +
  centre chip"**: one fixed top row (back · juz chip · settings, ~44dp, down from the old
  mushaf header's two rows) + large chevrons pinned to the screen edges over the reading area
  (`EdgeNav`, absolutely positioned via `top-1/2 -mt-[18px] -start-1`/`-end-1`) instead of a
  button row — closer to a real page-corner tap. List mode gets prev/next **surah** (it had
  none before, point 5) via a new `onChangeSurah` prop wired to `router.replace` (not push, so
  a linear next-next-next session collapses into one history frame) + a new "Surah N of 114"
  footer mirroring the mushaf page footer. Mushaf page turns now also `scrollToOffset(0)` —
  list mode needs no equivalent, since a surah change is a route-param change that remounts the
  screen with an already-fresh FlatList. New `SettingsIcon`/`ChevronLeftIcon`/`ChevronRightIcon`
  in `player-icons.tsx`, retiring the reader's literal `⚙`/`‹` glyphs.
- **Point 4 — settings sheet.** Owner picked **B1 "grouped cards"** with **B3's live preview**
  cloned on top: a `Bismillah` sample pinned between the header and the scrollable cards,
  reading the STAGED DRAFT (not committed prefs) so it restyles on every tap and reverts for
  free on Cancel. Font size scales a presentational base constant, deliberately NOT the
  reader's own `fitMushafFontSize` output — that depends on the current page's measured area,
  which this sheet has no access to; the preview demonstrates relative scaling only. Settings
  cluster into `SettingsCard` groups (Display/Layout/Translation/Reciter); staged-draft +
  Save/Cancel mechanics (point 16, `9.3`/`2df93d9`) are untouched.

⛔ **Retyped the Bismillah literal in the new test file before catching it** — wrote
`BISMILLAH_UTHMANI`'s value by hand as a local test const instead of importing the real export,
and the retyped copy was ALSO wrong (didn't match, test failed loudly — this time caught by a
genuine assertion failure, not a silent corruption). Fixed by importing `BISMILLAH_UTHMANI`
from `@repo/shared-core/quran/basmala` directly. Reinforces
[[feedback_quranic_literal_integrity]]: even reaching for the literal in a NEW file is the
trap — always import the constant, never type the characters.

⚠️ **A72 lock-screen blocks screenshot verification** — `adb input swipe`/`keyevent` alone
cannot clear a secured (PIN/pattern) keyguard; `dumpsys window | grep mCurrentFocus` showed
`NotificationShade` and `dumpsys window | grep mDreamingLockscreen` showed `true`. Do not
attempt to guess/brute the PIN — ask the owner to unlock, or fall back to the update
state-machine logcat check (`grep "Updates state change:"`) to confirm delivery without pixels.
That check DID confirm both OTAs landed: first launch `DownloadComplete`/`isUpdatePending=true`,
second launch `CheckCompleteUnavailable` (already current) — same recipe as perf pass #4.

**A72 pixel/interaction verify: still pending** (blocked by the lock-screen above). Everything
else — gate, jest (48 suites / 232 tests), literal-integrity grep, OTA delivery via logcat — is
confirmed. Ask before re-attempting device screenshots; don't try to bypass the keyguard again.

## Points 2/4 redesign — device-verify fallout, EdgeNav REMOVED, dock-spacing REVERTED (2026-08-02, same day)

Follow-up session to the entry above. The A72 lock-screen cleared (owner re-paired wireless
debugging mid-session — pairing codes are one-shot, re-pair each time the connection drops).
Full pixel-verify done; found and fixed 3 real regressions, then the owner rejected the point-2
redesign's INTERACTION MODEL outright (not a bug — a product call). Commits `3daae12`..`622753b`.

- **EdgeNav (the A3 floating edge-chevron buttons) is GONE.** Owner: floating buttons over the
  reading content read as "the shitty web app on mobile," not a native pattern. Page/surah
  navigation is now **swipe-only** on both Mushaf and List mode (`8e9d14a`) — List mode gained
  a `listPanResponder` mirroring the pre-existing `mushafPanResponder` exactly (same
  `resolveSwipeDirection`/`MUSHAF_SWIPE_THRESHOLD` helper, bounded by `[MIN_SURAH, MAX_SURAH]`
  instead of nullable prevPage/nextPage). **If asked to add page/surah nav controls again, ask
  first — don't default back to a floating button overlay.** The gesture-only interaction is a
  confirmed, deliberate owner preference, not an oversight.
- **EdgeNav's debugging saga (kept for the pattern, even though the component is deleted):**
  shipped 3 times with the button fully functional (correct a11y-tree bounds, correct tap,
  correct nav) but rendering NOTHING. `top-1/2 -mt-[18px]` (NativeWind) → inline
  `top:"50%"`+transform → `zIndex`/`elevation` (this app has 3 other overlay-vs-scrollable-
  sibling cases that needed exactly that: `animated-splash.tsx`/`navigation-progress.tsx`/
  `adhan-stop-card.tsx` — real, worth keeping in mind for any FUTURE absolutely-positioned
  overlay near a FlatList/ScrollView) — none of these were the bug. Root cause, found via a
  debug build swapping `bg-surface/90` for a solid `bg-danger`: **NativeWind's opacity modifier
  (`/NN`) cannot resolve against a CSS-custom-property-based color token** (`--color-surface`
  is `var(--color-surface)`, not a static hex NativeWind can decompose for RGBA blending) —
  silently produces NO paint, no error, no fallback. ⛔ **If a future `bg-<token>/NN` className
  ever renders invisible on Android, check this first** — resolve a literal `rgba()` by hand
  instead (same reasoning as the file's `TEXT_HEX`/`TEXT_2_HEX` maps, which exist because SVG
  can't read NativeWind classes — this is a DIFFERENT NativeWind gap).
- **dock-spacing REVERTED, supersedes the "real dock height" fix in the perf-pass-4 entry
  above.** That fix (`TAB_BAR_HEIGHT + MINI_PLAYER_HEIGHT + insets.bottom`, ~150-190dp) was
  owner-reported as a large empty gap on the bottom of EVERY tab, worst whenever a queue was
  loaded. Root cause: the dock is a flex SIBLING of `<Stack/>` (`app/_layout.tsx`), not an
  absolute overlay — it most likely already shrinks the Stack's own `flex:1` area by its real
  rendered height, the same way any two ordinary flex siblings interact. Re-adding that height
  as `paddingBottom` on top double-reserved it. `usePlayerHasQueue`/`TAB_BAR_HEIGHT`/
  `MINI_PLAYER_HEIGHT` exports are UNUSED now (kept, harmless) — `lib/use-dock-spacing.ts` is
  back to a small flat `16 + insets.bottom`. The historical "content hidden behind the dock"
  reports (prayer-times/quran-index/adhkar, 2026-07-31) were most likely actually fixed by the
  bare-Fragment→`<View className="flex-1 bg-bg">` WRAP pattern, a separate real fix, not by the
  padding amount. ⛔ **If a last-item-hidden-behind-dock report comes back, suspect a missing
  wrap on that screen first — do NOT re-derive a bigger dockSpacing number from Yoga
  first-principles reasoning again.** This file's own history (flat 8 → real height → flat 16)
  is the demonstration of how unreliable that reasoning has been twice now.
- **Also fixed:** settings-sheet live preview clipped the Bismillah's top (same missing-
  `lineHeight` class of bug as point 3 — now reuses the exported `DIACRITIC_LINE_RATIO`, not a
  new constant). RTL chevron mirroring was wrong before EdgeNav was deleted (SVG paths don't
  auto-mirror the way the old Unicode `‹`/`›` text did — moot now, kept as a note in case a
  future directional icon needs it elsewhere).
- **Labels, owner-specified exactly:** `quran.layoutList` "List"→**"Ayah"**, "قائمة"→**"آية"**;
  `quran.layoutMushaf` EN unchanged **"Mushaf"**, AR "مصحف"→**"صفحة"** (deliberate EN/AR
  asymmetry, not a translation mismatch). `quran.layout` (section header) "Layout"→
  **"Mushaf View"**, "تخطيط القراءة"→**"طريقة عرض المصحف"**.
- All 9 gate runs this session: exit 0, 25/25 tasks. Jest ended at 48 suites / 230 tests
  (net -2 from the EdgeNav-button tests removed, since gesture state isn't reproducible via a
  single synthetic RNTL event — matches this app's existing precedent of not
  integration-testing the mushaf swipe either, only its pure `resolveSwipeDirection` logic in
  `swipe.test.ts`). OTA'd to both channels every round; final group `5286dd5b`/`f3abd52c`.
- **A72 verify: DONE this round** (pairing dropped and was re-established twice mid-session —
  expect to re-pair on every reconnect, codes are one-shot). Owner confirmed final state "it's
  fine now" after the label round.

## Adhkar set-card icons (2026-08-04)

`app/adhkar/index.tsx` gained a per-kind emoji icon (🌅 morning / 🌙 evening / 📿 other) in a
tinted rounded box above each set's title — mirrors web's `AdhkarCard`/`KIND_EMOJI` pattern
(`apps/web/features/adhkar/components/adhkar-card.tsx`), which mobile's list had never picked
up. `item.kind: AzkarKind` already came through `adhkarListQuery()`/`@repo/shared-core`, no
schema change needed. Tint uses a literal `rgba()` keyed by `useTheme()`, NOT
`bg-primary/10` — that NativeWind opacity-modifier-on-CSS-var trap (silent no-op, no error) is
already documented above; this is a second hit of the same class, worth grepping for `/\d+"`
Tailwind opacity suffixes on token colors if it ever needs auditing repo-wide. Commit `283c344`,
pushed, OTA'd to **preview channel only** (owner chose not to touch production this round) —
update group `515d3849`, runtime `1.1.1`. Device-verify (both themes) pending.

## Ayah-by-ayah audio gap — RNTP native multi-track queue (2026-08-05, JS-only, ⚠️ device-verify PENDING)

**Bug (owner-reported):** an audible pause before each next ayah loads during Quran recitation —
not smooth, present on web/extension too but this entry covers the mobile fix only. Full plan:
`docs/superpowers/plans/2026-08-05-ayah-audio-gapless-playback.md` (Phase 1 of 3; web/extension
phases are separate sessions).

**Root cause:** `lib/player-context.tsx`'s load effect drove RNTP as a **single-track player** —
every ayah/track boundary did `TrackPlayer.reset()` → `add(ONE track)` → `play()`, triggered only
AFTER the previous track's `Event.PlaybackQueueEnded` fired. RNTP/ExoPlayer never had more than one
track loaded, so it could never prebuffer the next one (`minBuffer:30` in `setupPlayer()` was
already correct but useless with an empty lookahead). This is the SAME code path used by playlists
and live radio, not just the Quran reader (`features/quran/lib/ayah-queue.ts` → `player.loadQueue`).

**Fix, all in `lib/player-context.tsx` + new `lib/native-queue.ts`:**
- New pure `lib/native-queue.ts`: `NATIVE_QUEUE_LOOKAHEAD = 2`, `upcomingIndices(order,
  currentIndex, repeatMode, count)` (walks the shuffle/play order forward, wraps on repeat-all,
  empty on repeat-one), `toNativeTrack`, `indexOfTrackId`. 18 unit tests
  (`__tests__/native-queue.test.ts`), no RNTP import so it's testable without the native mock.
- The load effect now builds a **window** `[currentIndex, ...upcoming]` and issues ONE
  `TrackPlayer.add([...])` call with the array — live tracks / repeat-one / an armed "stop at end
  of track" sleep always get an empty lookahead (never queue ahead of an infinite stream or past a
  deliberate stop point).
- **New `Event.PlaybackActiveTrackChanged` handler** — fires when RNTP auto-advances onto a track
  it already had prebuffered (the ordinary case for every boundary now). Maps the native track's id
  back to our queue index (`indexOfTrackId`, NOT the native positional index — see the adopt fix
  below for why id-mapping matters), sets `currentIndex` with the existing `skipNextLoadRef`
  one-shot suppressing the load effect (so it does NOT reset/re-add the already-playing track —
  that would reintroduce the exact gap), then tops the window back up by ONE track. The top-up
  diffs against a new `nativeQueueIndicesRef` (append-only list of queue-indices already native-
  side since the last reset) rather than assuming a fixed count — a boundary near the end of a
  repeat-off queue legitimately has fewer new tracks to add, and diffing avoids re-adding a track
  that's already there (a naive "always add the last upcomingIndices() entry" approach double-adds
  near that boundary — caught by the "tops up exactly the newly-revealed track" test, see below).
- `Event.PlaybackQueueEnded` is now purely the **fallback** path — true end of a repeat-off queue,
  a single-item live-radio queue, and repeat-one (all three deliberately get zero lookahead, so
  RNTP genuinely exhausts its queue on each of their boundaries). Logic unchanged otherwise.
- New `primeUpcoming()` re-syncs the native window (`removeUpcomingTracks()` then re-add) whenever
  `playOrderRef`/`repeatModeRef`/`sleepAtTrackEndRef` change mid-playback — wired into
  `toggleShuffle`, `cycleRepeat`, and all three `setSleepTimer` branches. Without this a shuffle/
  repeat-mode change while playing would leave RNTP's prebuffered tracks pointing at the stale
  order and auto-advance to the wrong track.
- `recordRecentlyPlayed` moved out of the load effect into its own `[currentIndex, queue]` effect —
  auto-advance no longer passes through the load effect at all, so leaving it in place would have
  silently stopped recording ayahs/tracks 2..n in Continue Listening.
- **Adopt-on-mount session rehydration** (post-app-kill restore) now resolves the actually-active
  native track via `TrackPlayer.getActiveTrack()` + `indexOfTrackId(session.queue, ...)` rather
  than trusting the persisted numeric index alone — the persist effect writes asynchronously, so a
  kill landing in the narrow window right after an auto-advance (more reachable now that advances
  can happen natively without a JS round-trip) could otherwise leave `session.index` one track
  stale. Falls back to the old numeric index when the id isn't found. Also seeds
  `nativeQueueIndicesRef` from `TrackPlayer.getQueue()` on adopt so the first post-reopen top-up
  doesn't try to re-add a track RNTP already has.

**Accepted trade-off:** manual `next()`/`prev()`/`goTo()` deliberately stay on the OLD full-reload
path (unchanged) — only auto-advance benefits from the gapless window. Keeps the blast radius of
this phase to auto-advance only.

**Tests:** `__tests__/native-queue.test.ts` (18, pure helpers) + new
`__tests__/player-context-queue.test.tsx` (7, provider-level: multi-track window on load, no
lookahead for live/repeat-one, advance-without-reset regression guard, exact-diff top-up, sleep
end-of-track trims the window, offline local-path substitution in the window). Full gate green:
typecheck/lint (0 warnings) clean, **255 tests / 50 suites**, `expo export --platform android`
compiles. ⚠️ **Gotcha for next session**: this test file needs `await AsyncStorage.clear()` in its
`beforeEach` (missing it first caused a real cross-test failure — `cycleRepeat`/`toggleShuffle`
persist prefs to the SAME mocked AsyncStorage instance across tests in a file, so one test's
repeat-one mode silently hydrated into the next test's fresh `PlayerProvider` mount and broke an
unrelated assertion). `player-context-session.test.tsx` already does this; a new player-context
test file that doesn't will intermittently fail depending on test order.

**⚠️ DEVICE-VERIFY REQUIRED, NOT DONE — do not mark this fixed until it is.** Per this file's own
rule: jest mocks prove the JS calls the right RNTP APIs, they prove NOTHING about ExoPlayer actually
prebuffering audibly-smoothly on hardware. Needed on the A72 before calling this closed: (1) Al-
Fatiha autoplay, ayahs 2–7 run together with no audible gap, on mobile data not just Wi-Fi; (2)
regression sweep — a playlist plays through ≥3 tracks, shuffle mid-playback still advances
correctly, repeat-one still repeats, live radio still plays/shows LIVE/still auto-retries, sleep
"end of track" still stops at the boundary, lock-screen next/prev still work, force-close→reopen
still rehydrates without restarting the stream. Ships via `eas update` (JS-only, no native
rebuild) — confirm the target channel matches what the A72 actually tracks (see the EAS
channel-mismatch trap earlier in this file) before assuming a push landed.

**Merged to `main` + pushed + OTA'd 2026-08-05**: commit `bf4625f`, pushed to `origin/main`.
Published to the **preview** channel (matches the A72's tracked channel): update group
`a711087c-807c-41f4-a287-a45c9c033fcc`, runtime `1.1.1`, both platforms. NOT published to
production this round. Still `⚠️ PENDING`: the A72 device-verify checklist above.
