# Mobile App — Post-Build Feedback, Bugs & Execution Plan

> **Single source of truth** for the post-build fix pass on `apps/mobile`. Self-contained:
> context, confirmed decisions, full spec for all 26 reported points, the model to use per
> phase, and an explicit **model-switch stop point** at the end of each phase. Read
> `apps/mobile/APP_CONTEXT.md` first (mandatory in this repo). Web counterparts live in
> `apps/web/features/*` and `packages/ui/src/blocks/audio-player/*`.

---

## 0. How to use this document

- Execute **one phase per session**. Each phase declares the **model** to run it on.
- At the end of every phase there is a **🛑 STOP — MODEL SWITCH** marker: run the
  verification gate, commit, then switch the Claude Code model to the one named for the
  next phase before continuing. This keeps cost optimal (Opus for design/state-machines,
  Sonnet for features, Haiku for mechanical work — per `CLAUDE.md` §15).
- **One commit per concern**, message `[AhmedMuhammedElsaid][fix|feat|refactor]: …` with the
  `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>` trailer. Never bundle
  concerns. Re-check `git rev-parse HEAD` / `origin/main` right before each push (multiple
  concurrent sessions run on this repo). Stage explicit paths, not `-A`.
- Update `apps/mobile/APP_CONTEXT.md` in the same commit that ships each phase.

### Model legend
| Tier | When (per `CLAUDE.md` §15) |
|---|---|
| **Opus** | New abstraction / contract change, first-of-kind pattern, complex state machines, cross-file refactors, native/notification/security-sensitive code. |
| **Sonnet** | Feature with an existing sibling pattern, CRUD, forms, lists, UI from existing primitives, tests. |
| **Haiku** | Mechanical clone/propagation, renames, string/i18n edits, config, doc mirrors, single-file obvious fixes. |

---

## 1. Context

The first working APK is installed and usable. During navigation Ahmed logged 26 issues:
real bugs (adhan toggle not persisting, literal `{h}h {m}m` countdown, double audio
playback, broken tafsir), web-parity gaps (rich media player, playlist artwork,
autoplay-on-continue), and UI/UX refinements (sun/moon size + light-mode theming, splash
revert, icons, always-visible tab bar). This plan fixes all 26 plus proactive cleanups, with
no functional gaps.

### Confirmed product decisions
- **Adhan (points 13/15):** **Both** — a short (~25 s) adhan clip as the prayer-notification
  sound (reliable when the app is closed) **and** the full adhan via the audio engine when the
  app is open/running.
- **Media player (points 10/19):** **Full-screen Now Playing** screen, full web parity (seek,
  repeat, shuffle, volume, speed, sleep timer).
- **Language (points 6/22):** **Reload app on switch** (persist choice + `Updates.reloadAsync()`)
  — the only reliable way to flip RTL + localized data on React Native.

### Global constraints
- **Rebuild batch.** Anything touching native config / assets / new native modules needs a fresh
  **dev-client / EAS build** (not a Metro reload). These are grouped at the end so we cut **one**
  build: `expo-updates` (Phase 3), `@react-native-community/slider` (Phase 4), the
  expo-notifications custom adhan sound + Android channel + bundled asset (Phase 9), and any
  `app.json` plugin edit.
- **CI is all-or-nothing.** Before any push run the FULL monorepo gate, not per-app filters:
  `pnpm turbo run lint typecheck test build` (frozen-lockfile, stops at first red).
- **EAS Free-plan Android build cap** resets **2026-07-01** — confirm quota before the final
  rebuild, or build locally (JDK 17 present; still needs Android SDK/NDK).

---

## 2. Traceability — every reported point maps to a phase

| # | Reported point | Phase |
|---|---|---|
| 1 | Adhan toggle turns itself off after navigating away | 1.2 |
| 2 | Sun/moon icon too small | 2.1 |
| 3a | Quran audio + queue player play simultaneously | 4.1 |
| 3b | Downloaded record won't play offline; no player shows | 4.3 |
| 4 | Home library empty on first open | 1.3 |
| 5 | Countdown shows literal `Fajr in {h}h {m}m` | 1.1 |
| 6 | Tafsir popup always English + only the first ayah works | 3.4 |
| 7 | Continue-reading section touches the bottom bar | 1.4 |
| 8 | Lists show random emoji, not the owner's image | 6 |
| 9 | Light mode: moon transparent; arc/widget not themed | 2.2 |
| 10 | Media player feels poorer than web | 4.4 |
| 11 | Bring back the old ن animated splash (keep app icon) | 8 |
| 12 | App must work offline + voice records play offline | 4.3 |
| 13 | Adhan must fire at prayer time when toggled on | 9.1 |
| 14 | Location detection on permission grant | 9.2 |
| 15 | (dup of 13) adhan plays at prayer time | 9.1 |
| 16 | Quran settings need Save/Cancel buttons | 9.3 |
| 17 | Continue-listening must auto-play like web | 4.2 |
| 18 | Download / done icons look poor | 7 |
| 19 | Player needs repeat + volume mixer (web parity) | 4.4 |
| 20 | Bottom tab bar must show on every screen | 5.1 |
| 21 | Adhkar reader needs a progress bar reflecting checks | 9.4 |
| 22 | Adhkar titles not localized (always EN) | 3.3 |
| 23 | Location modal ✕ overlaps the status bar/battery | 1.5 |
| 24 | Library default filter ("newest") is empty | 1.3 |
| 25 | Quran tab: white header + duplicate title | 5.2 |
| 26 | Light-mode dark/light toggle moon icon tiny + light bg | 2.3 |

---

## Phase 1 — Quick correctness fixes  ·  Model: **Sonnet**
*No rebuild. Pure RN/JS. (Sub-items 1.1 and 1.4 are Haiku-trivial if run standalone.)*

**1.1 — Countdown literal `{h}h {m}m` (pt 5).** i18next interpolates with `{{double}}` braces;
the `prayer` namespace uses single `{...}`. In `locales/en.json` + `ar.json` fix `countdown`,
`at`, `locationSet` and **audit the whole `prayer` namespace** → `{{h}}`, `{{m}}`, `{{time}}`,
`{{city}}`. Callers already pass the values (`features/prayer-times/components/prayer-times-widget.tsx`,
`app/prayer-times/index.tsx`).

**1.2 — Adhan toggle not persisting (pt 1).** `app/prayer-times/index.tsx` holds `notifEnabled`
in `useState(false)` only → resets on remount. Add an `azanEnabled` boolean to the persisted prefs
in `features/prayer-times/hooks/use-prayer-settings.ts` (AsyncStorage `nour.prayer.prefs`), hydrate
into state, write on toggle. Mirror web `use-adhan-settings.ts`.

**1.3 — Home library empty / default filter (pts 4 & 24).** `app/index.tsx` defaults `sort="newest"`
(no client sort; relies on server order) + `activeCategory=null` (all). Set default sort to **`"az"`**
(deterministic, user-requested) so the grid is always populated on first open; keep category = all.
Confirm `playlistsQuery(locale)` returns data; ensure the empty state offers retry.

**1.4 — Continue-reading touches tab bar (pt 7).** With the tab bar always visible (Phase 5), the
Home `FlatList` `contentContainer` needs dock-aware bottom padding and `features/home/components/continue-reading.tsx`
a bottom margin. Audit every detail `FlatList` (`pb-24` → dock-aware) so content never hides behind
the bar.

**1.5 — Location modal ✕ over status bar (pt 23).** The picker modal header in
`app/prayer-times/index.tsx` uses only `pt-4`. Wrap in `SafeAreaView` / add `useSafeAreaInsets()`
top inset so the ✕ clears the status bar/battery.

**Acceptance:** countdown shows real numbers in both locales; toggle survives navigation; Home shows
playlists immediately; nothing clips under the dock; ✕ is fully tappable below the status bar.

**Verify:** `pnpm typecheck && pnpm lint && pnpm test` in `apps/mobile`. Commit each sub-item separately.

> ### 🛑 STOP — MODEL SWITCH → **Opus** for Phase 2
> Run the gate, commit Phase 1, update `APP_CONTEXT.md`, then switch to **Opus** (Phase 2 changes a
> shared component contract).

---

## Phase 2 — Prayer-times arc + theming (pts 2, 9, 26)  ·  Model: **Opus**
*Cross-file contract change on a shared presentational component. Preserve the existing corona
breathing pulse (Reanimated, added earlier) and the absolute-coord crescent mask.*

`features/prayer-times/components/sun-arc.tsx` hardcodes the **dark** palette regardless of theme and
draws a small disc (`r=5.5`).

**2.1 — Bigger sun/moon (pt 2):** sun disc `r 5.5 → ~9`, corona `24 → ~28`; scale the moon crescent +
corona proportionally. Keep the pulse and the gaussian-blur bloom.

**2.2 — Theme-aware colors (pt 9):** add a `theme` prop sourced from `lib/theme-context.tsx`
`useTheme()`. Resolve light vs dark hexes from `packages/ui/src/styles/tokens.css` — dark: sun
`#e4c57e`, moon `#d6e3ff`, muted `#5a4a38`; light: sun `#c8a050`, moon `#4a6fb8`, muted `#6b7670`,
primary `#9a7830`. **Both** callers must pass `theme` (shared signature): the Home widget
`prayer-times-widget.tsx` AND `app/prayer-times/index.tsx`. Theme the whole widget (text, arc stroke,
dots), not just the sun/moon.

**2.3 — Light-mode toggle icon (pt 26):** `components/theme-toggle.tsx` uses the `☾` emoji — tiny with
a light pill in light mode. Replace with a proper RN-SVG sun/moon icon (new entry in
`components/icons/`), themed stroke color, no background — matching the tab-icon style.

**Acceptance:** sun/moon noticeably larger; moon clearly visible in **both** light and dark; arc + dots
+ text recolor with theme; toggle icon crisp and legible in both modes.

**Verify:** gate green; add jest coverage rendering `SunArc` in both `theme="light"` and `theme="dark"`.

> ### 🛑 STOP — MODEL SWITCH → **Opus** for Phase 3
> Stay on **Opus** (Phase 3 is a cross-cutting system change). Commit + update `APP_CONTEXT.md` first.

---

## Phase 3 — Localization system (pts 6, 22)  ·  Model: **Opus**
*Cross-cutting; introduces `expo-updates` (rebuild-batch). May touch the web app + require a web redeploy
for the tafsir half.*

Root cause: `lib/i18n.ts` `initialLocale` is computed once from the device locale at boot;
`components/locale-switcher.tsx` neither persists a choice nor reloads, so switching does nothing and
adhkar titles/tafsir stay in the boot language.

**3.1 — Reactive locale:** add **`expo-updates`**. In `locale-switcher.tsx`, on switch: persist to
AsyncStorage `nour.locale`, call `applyTextDirection`, then `Updates.reloadAsync()` — **guard it to a
no-op in Expo Go / dev where unavailable**.

**3.2 — Boot from persisted locale:** `lib/i18n.ts` reads `nour.locale` first, falls back to device
locale; `initialLocale` stays the resolved export other modules import.

**3.3 — Adhkar titles localized (pt 22):** fixed transitively — `azkar[locale].title` now follows the
chosen language. Verify on `app/adhkar/index.tsx` + `[slug].tsx`.

**3.4 — Tafsir broken (pt 6):** the **client is correct** — `features/quran/components/reader.tsx`
`onOpenTafsir` builds a fresh `{numberGlobal, ref}` per ayah and `tafsir-sheet.tsx` refetches on change.
The "only first ayah / empty for the rest" symptom is therefore **server-side**. Inspect
`apps/web/app/api/v1/quran/tafsir/route.ts` (+ `packages/api` tafsir service): confirm it keys tafsir by
the passed `ayah` numberGlobal for **every** ayah and honors `locale`; fix whichever side returns
empty/English-only. **If the fix is server-side it requires a web redeploy, not a mobile rebuild.** Add a
regression test for a non-first ayah and for `locale=ar`.

**Acceptance:** switching language reloads the app and flips UI strings, RTL, adhkar titles, and tafsir
language; tafsir loads for any ayah, not just the first.

**Verify:** gate green; locale-persistence unit test; tafsir endpoint regression test. If web changed,
redeploy web and re-hit `…/api/v1/quran/tafsir?ayah=<n>&locale=ar`.

> ### 🛑 STOP — MODEL SWITCH → **Opus** for Phase 4
> Stay on **Opus** (Phase 4 is the player state-machine + first-of-kind screen). Commit + docs first.

---

## Phase 4 — Audio & player (pts 3, 12, 17, 10/19)  ·  Model: **Opus**
*Largest phase: state-machine wiring + a new screen. Introduces `@react-native-community/slider`
(rebuild-batch) — see note. Split commits per sub-item.*

**4.1 — Double playback (pt 3a):** `features/quran/components/reader.tsx` calls `useAyahAudio(...)` with no
coordination. Mirror web `apps/web/features/quran/components/reader.tsx`: pass
`{ onPlaybackStart: () => { if (player.isPlaying) player.pause(); } }`, and stop the ayah when the queue
player starts. The hook already accepts opts.

**4.2 — Continue-listening autoplay (pt 17):** web passes `#trackId` and the playlist auto-`loadQueue`s on
mount. Mobile: `features/home/components/continue-listening.tsx` navigates with `?trackId=<id>`;
`app/playlist/[slug].tsx` reads `useLocalSearchParams().trackId` in a **mount-once** effect, finds the
index in `queueTracks`, calls `loadQueue(queueTracks, idx)`.

**4.3 — Offline playback (pts 3b, 12):** `lib/player-context.tsx` already prefers
`getLocalPath(track.id)` over the remote URL — **verify the `file://` URI actually plays in RNTP offline**.
The real gap is UX: `features/downloads/components/downloads-list.tsx` only renders metadata. Add tap-to-play
+ Play-all that builds a queue from downloaded records via `usePlayer().loadQueue`, and show a clear message
when offline and a track isn't downloaded.

**4.4 — Full-screen Now Playing (pts 10 & 19):** all state already exists in `lib/player-context.tsx`
(`repeatMode`, `isShuffled`, `volume`, `playbackRate`, `cycleRepeat`, `toggleShuffle`, `setVolume`,
`setPlaybackRate`, `setSleepTimer`, `goTo`) — only the UI is missing. Build `app/player.tsx` (modal route)
mirroring `packages/ui/src/blocks/audio-player/audio-player.tsx`: large artwork, **seek slider**,
prev/play/next, **repeat cycle** (off/all/one), **shuffle**, **volume slider**, **speed** (0.75–2×),
**sleep timer** (15/30/45/60 m + end-of-track). Make `components/mini-player.tsx` tappable to open `/player`
and add quick repeat + shuffle. Use the SVG icons from Phase 7 (no emoji glyphs).
> **Slider primitive (gap closed):** RN ships no slider. Add **`@react-native-community/slider`** (native →
> goes in the rebuild batch) for the seek + volume sliders — reliable and lightweight. (Alternative: a
> Reanimated/gesture slider with zero deps; only if avoiding the native module matters.)

**Acceptance:** ayah and queue never play at once; tapping a continue-listening item lands on the playlist
**and** starts playing; a downloaded track plays with no network and shows the player; Now Playing exposes
seek/repeat/shuffle/volume/speed/sleep-timer and drives the existing context.

**Verify:** gate green; tests for the autoplay effect and Now Playing controls (mock player-context). Slider
won't render under jest-expo until the dep is added — guard tests accordingly.

> ### 🛑 STOP — MODEL SWITCH → **Sonnet** for Phase 5
> Commit each sub-item + docs, then switch to **Sonnet** (Phases 5–6 are sibling-pattern work).
> Escalate back to Opus only if the nav/header refactor fights back twice.

---

## Phase 5 — Navigation & Quran chrome (pts 20, 25)  ·  Model: **Sonnet**

**5.1 — Tab bar always visible (pt 20):** `components/bottom-dock.tsx` gates the bar with
`isTabRoot(pathname)`, hiding it on playlist/quran/adhkar detail screens. Render `<BottomTabBar>` on **every**
route; keep the mini-player stacked above it (dock inset math) and ensure detail screens' bottom padding
clears the dock (ties to 1.4). `isActive()` already keeps the right tab highlighted on nested routes
(`/quran/123` → Quran active).

**5.2 — Quran header duplication + white bar (pt 25):** `app/quran/[surah].tsx` sets `Stack.Screen
headerShown:true title=…` (default white, unthemed) **and** `reader.tsx` renders its own in-content title —
two titles. Hide the Stack header (or make it a themed custom header) and keep **one** header: back icon next
to the surah title, with settings/repeat beside it. Apply the same audit to `app/quran/index.tsx`.

**Acceptance:** the bottom nav bar is visible on all screens incl. readers/playlist; Quran shows a single
themed header (no white bar, no duplicate title) with a back affordance.

**Verify:** gate green; update `bottom-tab-bar` test for always-visible behavior.

> ### 🛑 STOP — MODEL SWITCH → **Sonnet** for Phase 6
> Stay on **Sonnet**. Commit + docs.

---

## Phase 6 — Playlist artwork (pt 8)  ·  Model: **Sonnet**

Web renders the owner image (`playlist.scholarImage`); mobile `features/playlists/components/cover.tsx`
ignores it and always shows a deterministic emoji+gradient. The DTO already carries `scholarImage`
(`packages/shared-core/src/schemas/playlist.ts`, returned by `/api/v1/playlists`). Update `<Cover>` to render
an `<Image>` when `scholarImage` exists, else fall back to the current emoji/gradient.
> **URL gap closed:** `scholarImage` is origin-relative (e.g. `/muhmd-bakr.png`). RN `<Image>` needs an
> absolute URL — prefix with the **bare API origin** (`EXPO_PUBLIC_API_BASE_URL`), **not** the `/api/v1`
> base that `lib/api.ts` builds. Centralize a small `assetUrl(path)` helper.

Plumb `scholarImage` through `playlist-card.tsx`, the Home grid (`app/index.tsx`), and the playlist-detail
header (`app/playlist/[slug].tsx`).

**Acceptance:** playlists with an owner image show it (correct, non-broken URL); those without fall back
cleanly to emoji/gradient.

**Verify:** gate green; Cover test covering image-present vs fallback.

> ### 🛑 STOP — MODEL SWITCH → **Haiku** for Phase 7
> Commit + docs, then switch to **Haiku** (Phases 7–8 are mechanical).

---

## Phase 7 — Icons polish (pt 18 + player glyphs)  ·  Model: **Haiku**

`features/downloads/components/download-button.tsx` uses emoji (`⬇ ✓ ↻`); the mini-player uses `⏮ ⏸ ▶ ⏭`.
Add proper RN-SVG icons under `components/icons/` (clone the `tab-icons.tsx` pattern — stroke icons taking a
`color` prop; **no new dependency**): download, check/done, retry, plus transport (prev/play/pause/next),
repeat, shuffle, volume. Swap them into the download button, mini-player, and the Now Playing screen for a
consistent, attractive look.

**Acceptance:** no emoji glyphs remain in the download button or player; icons are crisp and theme-colored.

**Verify:** gate green.

> ### 🛑 STOP — MODEL SWITCH → **Haiku** for Phase 8
> Stay on **Haiku**. Commit + docs.

---

## Phase 8 — Splash revert (pt 11)  ·  Model: **Haiku**

Keep `assets/icon.png` as the launcher/native icon (**do not** touch `app.json` icon config). Restore the old
animated splash — the code-drawn gold **ن** mark with radial bloom + gloss shimmer + "نور / Nour Platform"
wordmark and the staggered "Minimal Rise" animation — into `components/animated-splash.tsx`. The prior
implementation is intact at commit **`1457430`**: `git show 1457430:apps/mobile/components/animated-splash.tsx`.
Restore it, **keeping the current reduce-motion + 2.6 s safety-timeout guards**.

**Acceptance:** cold start shows the ن animation; the native splash + launcher icon (the Quran scene) are
unchanged.

**Verify:** gate green; `expo export --platform android` succeeds.

> ### 🛑 STOP — MODEL SWITCH → **Opus** for Phase 9
> Commit + docs, then switch to **Opus** (native notifications + audio engine).

---

## Phase 9 — Adhan audio, location, settings, adhkar progress  ·  Model: **Opus**
*Rebuild-required (notifications + asset + `app.json`). Sub-items 9.2/9.3 are Sonnet-able, 9.4 Haiku-able —
but the adhan work (9.1) sets the model for the phase.*

**9.1 — Adhan firing "Both" (pts 13 & 15):**
- Bundle a short (~25 s) adhan clip in `apps/mobile/assets/audio/` (trim from the web adhan in
  `apps/web/public/audio/`). Register it via the **expo-notifications** config plugin (`sounds: [...]`) in
  `app.json`, create an Android **azan notification channel** with that sound, and set `sound: "<file>"`
  (replacing `sound: true`) in `features/prayer-times/hooks/use-azan-notifications.ts`.
- Add a **foreground handler** (`Notifications.addNotificationReceivedListener`) so that when an
  `nour-azan-*` notification fires while the app is open/running, the **full** adhan plays via the audio
  engine. **Use `expo-audio`** for this one-shot (already used for Quran ayahs), ducking — not clobbering —
  the RNTP queue. (RNTP is reserved for the playlist queue.)

**9.2 — Location detection (pt 14):** the flow in `features/prayer-times/components/location-picker.tsx`
(permission → `getCurrentPositionAsync` → `nearestCity` → persist `nour.prayer.location`) is sound. Harden:
loading/disabled state on the "Use my location" button, permission-denied feedback, and confirm the detected
city fills + persists end-to-end on a device.

**9.3 — Quran settings Save/Cancel (pt 16):** `features/quran/components/reader-settings-sheet.tsx` auto-applies
every change. Stage prefs in local state; add **Save** (apply + persist via `setQuranPrefs`) and **Cancel**
(revert + close).

**9.4 — Adhkar progress bar (pt 21):** the reader (`app/adhkar/[slug].tsx`) + landing (`app/adhkar/index.tsx`)
already render `<Progress>`. Verify it's prominent and updates live as items are checked; pin it as a static
header bar in the reader if it isn't already.

**Acceptance:** toggling adhan schedules notifications that fire the short adhan sound at prayer time (test by
shifting device clock / a near-future prayer) and the full adhan plays when the app is open; location detect
fills + persists; Quran settings Save/Cancel behave; adhkar progress reflects checks.

**Verify:** gate green; then the **final rebuild** (below).

> ### 🛑 STOP — FINAL: rebuild + on-device verification
> Commit + docs. This is the last phase — proceed to §3.

---

## 3. Final rebuild & on-device checklist

After the rebuild-batch phases (3, 4, 9) and any `app.json` change:
```bash
cd "D:/CodeLab/Nour Platform" && pnpm turbo run lint typecheck test build   # full CI gate
cd apps/mobile && npx expo export --platform android                        # bundle compiles
eas build --profile preview --platform android                              # confirm Free-plan quota first
```
On the device:
- **Adhan:** toggle persists across navigation; short clip fires at a (clock-shifted) prayer time when
  closed; full adhan plays when the app is open.
- **Arc:** sun/moon larger; moon clearly visible in **both** light and dark.
- **Language:** switch reloads and flips AR/EN + RTL + adhkar titles + tafsir language.
- **Audio:** no Quran/queue overlap; offline-downloaded track plays and shows the player; continue-listening
  auto-plays; Now Playing has seek/repeat/shuffle/volume/speed/sleep-timer.
- **Nav/UI:** tab bar on every screen; single themed Quran header; playlist owner images render; splash shows
  the restored ن animation; download/player icons look polished; location-modal ✕ clears the status bar.

---

## 4. New dependencies (all in the rebuild batch)
| Dep | Phase | Why | Note |
|---|---|---|---|
| `expo-updates` | 3 | `reloadAsync()` to apply a language/RTL switch | No-op guard in Expo Go/dev. |
| `@react-native-community/slider` | 4 | seek + volume sliders in Now Playing | Native module; jest-mock it. |
| (asset) `assets/audio/adhan.*` | 9 | notification + foreground adhan | Trim from web adhan; ≤30 s for iOS notif sound. |

No web ADR required (mobile). Pin one `react`/`react-dom` across the workspace stays in effect; do not touch
the root lockfile beyond these adds.

---

## 5. Risks / notes
- **iOS notification sound ≤ 30 s** is a hard OS limit — hence the short clip; the full adhan only plays when
  the app is running. Android channel sound is fixed at channel creation — recreate the channel if the asset
  changes.
- **`Updates.reloadAsync`** is a no-op in Expo Go; verify it works in the preview build.
- **Tafsir fix may be server-side** → web redeploy, not a mobile rebuild. Scope it during 3.4.
- **Always-visible tab bar** raises content; re-audit every detail screen's bottom padding (1.4 / 5.1) so the
  Now Playing FAB-style mini-player and the bar don't overlap content.
- **RNTP New-Arch landmines** (compile, TurboModule return-type, ReactHost emit) — re-verify all three on any
  RNTP bump; none of these phases bump RNTP, but Phase 4 touches the player path.
