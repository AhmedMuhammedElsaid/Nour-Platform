# Publish Nour Mobile to the Google Play Store (Android)

> Release runbook for shipping `apps/mobile` to Google Play as an Android App Bundle.
> Companion to `deploy.md` (which covers dev/build mechanics). Read APP_CONTEXT.md first.

## Context
The mobile app (`apps/mobile`, Expo SDK ~56) is **code-complete and green**
(23 jest suites / 78 tests, typecheck + lint clean, `expo export` compiles) and passed a
2026-07-03 3-subagent pre-publish audit (perf / crash-safety / store-readiness) with **no
code blockers — Android is GO**. This is the full path to a Play Store–published AAB.

Two facts shape the timeline:
- **No Google Play account yet** → must register ($25 one-time). A **personal/individual**
  account is subject to Google's 2023+ policy: a **closed test with 20 testers for 14
  continuous days** before production access. An **organization** account (e.g.
  `ahmedmuhammedelsaid`, the existing EAS owner) is **exempt** — register as an organization
  if eligible to skip the 14-day gate.
- **Privacy policy** → add a `/privacy` page to `apps/web` (Play requires a hosted URL
  because the app uses location + notifications).

Already in place (verified): `app.json` has package `com.nour.mobile`, `versionCode 6`,
`version 1.0.0`, EAS Update (`runtimeVersion: appVersion`, `updates.url`), notification
sounds, and all Android permissions. `eas.json` already defines a `production` profile
(Android `app-bundle`, channel `production`) and a `submit.production` block pointing at
`google-play-key.json`, track `internal`. `google-play-key.json` is now gitignored
(`beb96c2`/`513809d`).

**Build quota:** the EAS Free-plan Android quota that was a concern earlier is **not
blocking** — a preview build went through fine on 2026-06-28. The production AAB build can
run whenever the account/listing steps below are ready.

---

## Part A — Code/config changes (in-repo, can do now)

### A1. Privacy policy page — `apps/web`
- Add a localized `/privacy` route (Next.js App Router, mirror an existing static page
  for layout/i18n pattern). Content must cover, in AR + EN:
  - **Location** — used only to compute prayer times; processed on-device / via the
    public Aladhan API; not stored on Nour servers.
  - **Notifications** — local adhan/azkar reminders scheduled on-device.
  - **No accounts, no analytics, no third-party ad SDKs**; all user state is device-local
    (AsyncStorage). The web API is read-only content.
  - Contact email + last-updated date.
- The hosted URL becomes the Play "Privacy policy" field:
  `https://nour-platform-web.vercel.app/privacy` (or final domain).

### A2. Make the production build use the correct API origin
- The `production` build profile has **no `environment`** set, so it resolves the EAS
  **`production`** environment. Confirm `EXPO_PUBLIC_API_BASE_URL` exists there
  (`eas env:list --environment production`); APP_CONTEXT only confirms it for `preview`.
  - If missing: `eas env:create --name EXPO_PUBLIC_API_BASE_URL --value <prod origin>
    --environment production --visibility plaintext`.
  - Without it the AAB silently bakes `http://localhost:3000` → blank app. **This is the
    #1 release footgun** (same class of bug as the preview `localhost` traps).

### A3. Release metadata sanity (`app.json`)
- `version "1.0.0"` + `versionCode 6` are fine for a first release. Leave as-is; bump
  `versionCode` only if a build is rejected and re-uploaded.

### A4. Push any unpushed mobile commits first
- All release commits must be on `origin/main` before a release build (EAS builds from the
  pushed tree unless `EAS_NO_VCS=1`), and the web privacy page redeploys via Vercel on push.

---

## Part B — External setup (manual, mostly interactive)

> These need browser logins / payments / interactive CLI auth. Run interactive CLI auth
> via the `! <command>` prompt prefix so output lands in the session.

### B1. Google Play Console account
- Register at play.google.com/console ($25 one-time). **Choose Organization** if you
  qualify (skips the 20-tester / 14-day closed-test requirement that hits personal accts).
- Create the app: name "Nour", default language Arabic, app (not game), free.

### B2. App signing & keystore (EAS-managed — recommended)
- Run `eas credentials` (or let the first `eas build --profile production` generate it)
  to have **EAS generate and store the upload keystore**. No `KEYSTORE_PASSWORD`/
  `KEY_PASSWORD` needed unless you self-manage. Play App Signing handles the final
  signing key on Google's side — enroll when creating the app.

### B3. Play service account for `eas submit`
- In Google Cloud / Play Console: create a service account, grant it the **"Release to
  testing/production"** permission on the app, download the JSON key, save it as
  `apps/mobile/google-play-key.json` (gitignored — never commit). `eas.json` already
  references this path.

### B4. Store listing assets (Play Console "Main store listing")
- App icon **512×512 PNG** (derive from `assets/icon.png`).
- Feature graphic **1024×500 PNG**.
- **2–8 phone screenshots** (capture on the Samsung A72: Home, Prayer times/sun-arc,
  Quran reader, Adhkar, Now-Playing).
- Short description (≤80 chars) + full description, AR + EN.
- App category (e.g. Books & Reference / Lifestyle), contact email.
- **Privacy policy URL** from A1.

### B5. Required Play compliance forms
- **Data safety** form: declare Location (used, not shared, not stored off-device) and
  that data is processed on-device; no data collection/sharing otherwise.
- **Content rating** questionnaire (IARC) — straightforward for a religious-content app.
- **Target audience & content**, **Ads: No**, **Government app: No**.

### B6. ⚠️ Restricted-permission declarations (review risk — flag at submit)
- **`USE_EXACT_ALARM`** — Play restricts this to alarm/clock/calendar-class apps. A
  prayer-time adhan app is a legitimate use, but be ready to justify it in the
  permissions declaration (it powers exact closed-app adhan). If rejected, the fallback
  is `SCHEDULE_EXACT_ALARM` + runtime user grant.
- **`REQUEST_IGNORE_BATTERY_OPTIMIZATIONS`** — also Play-restricted; justify as required
  for reliable timed adhan, or drop to the no-permission battery-settings list screen
  (`lib/battery-optimization.ts` already has that fallback path).
- These were always tagged "revisit at publish" in APP_CONTEXT — this is that moment.

---

## Part C — Build & submit sequence (after 2026-07-01 quota reset)

```bash
cd apps/mobile
# 1. Confirm prod API var (A2) and that commits are pushed (A4).
eas env:list --environment production

# 2. Build the production AAB (generates/uses the EAS keystore on first run).
eas build --profile production --platform android

# 3. Submit to the Play internal track (uses google-play-key.json from B3).
eas submit --profile production --platform android
```

- **Personal account:** the build first goes to a **closed test** (≥20 testers, 14 days)
  before you can promote to production in the Console.
- **Org account:** promote internal → production directly after review (first review can
  take a few days).

---

## Out of scope
- iOS / App Store — now has its **own runbook below** ("Publish Nour Mobile to the Apple App
  Store (iOS)"). Android and iOS ship independently.
- Building the AAB locally via Android Studio/Gradle (separate path; needs Android
  SDK + NDK install — not pursued here).
- The rebuild-gated native features (22-part adhan, exact-alarm) are **already coded and
  in `app.json`** — the production build delivers them automatically; no new code needed.

## Verification
- `apps/web`: `/privacy` renders in AR + EN, links resolve, Lighthouse a11y/perf > 95
  (DoD §3); confirm the public URL is reachable (Play validates it).
- `cd apps/mobile && pnpm typecheck && pnpm lint && pnpm test && npx expo export --platform android`.
- `eas env:list --environment production` shows `EXPO_PUBLIC_API_BASE_URL` = prod origin.
- After build: download the AAB/APK from EAS, sideload, confirm it loads live data (not
  localhost) and the adhan fires closed-app on the A72.
- After submit: app appears on the Play **internal/closed** track; install via the opt-in
  link end-to-end before promoting.

---
---

# Publish Nour Mobile to the Apple App Store (iOS)

> Release runbook for shipping `apps/mobile` to the Apple App Store via TestFlight.
> Companion to the Android runbook above. **Status: NOT started — read the blockers first.**

## Status (2026-07-03 exploration)
iOS is **NOT production-ready**, unlike Android (which is GO). The app is cross-platform and
iOS-*aware*, but it has **never been built, never run on a simulator or device, and there is
no Apple Developer account**. This is a separate mini-project gated on account + build +
device verification — **none of the gap is missing *code***; it's account/build/QA work.

## Already in place (verified this session)
- `app.json` `ios`: `bundleIdentifier: com.nour.mobile`, `supportsTablet: true`,
  `UIBackgroundModes: ["audio"]` (background + lock-screen playback), and the
  `com.apple.developer.usernotifications.critical-alerts` entitlement. `version: 1.0.0`.
- **Icon is App-Store-safe**: `assets/icon.png` was flattened to **opaque RGB** — Apple
  rejects icons with an alpha channel. (Re-flatten if you ever regenerate it — see APP_CONTEXT
  "App icons".)
- `eas.json`: `build.production.ios.distribution: "store"`, `build.preview.ios.simulator: true`
  (quick local smoke build), and a `submit.production.ios` block reading `APPLE_ID` /
  `APPLE_TEAM_ID` from env.
- **Critical Alerts code degrades gracefully** — `interruptionLevel:"critical"` +
  `allowCriticalAlerts` fall back to a normal notification until Apple grants the entitlement
  (no crash). See APP_CONTEXT "iOS adhan — Critical Alerts".

## Config gaps to close before a build
- **`ios.buildNumber` is unset** in `app.json` (the iOS analog of `versionCode`). Add
  `"buildNumber": "1"` — App Store Connect requires it, incremented per upload.
- **`APPLE_ID` / `APPLE_TEAM_ID` env vars** don't exist yet (referenced by `submit`). Also add
  **`ascAppId`** (App Store Connect numeric app id) to `submit.production.ios` once the app
  record exists, so `eas submit` targets it.
- **Export compliance**: add `ios.infoPlist.ITSAppUsesNonExemptEncryption: false` to `app.json`
  (the app uses only standard HTTPS) — else every TestFlight build stalls on the encryption
  question.
- **`EXPO_PUBLIC_API_BASE_URL`** must exist in the EAS **production** env (same footgun as
  Android — else the IPA bakes `localhost` → blank app).

## iOS functional reality (accepted limitations, not bugs)
- **Closed-app adhan is weaker on iOS by design.** No `AlarmManager`/foreground-service
  equivalent — Android's native `modules/nour-adhan/` (Kotlin) is **Android-only**. iOS is
  limited to a scheduled local notification with a bundled sound **≤30s** (`adhan_notify.wav`,
  29s). The **full** adhan plays only **foreground** via `use-foreground-adhan.ts` (an
  iOS-only path). Critical Alerts (once granted) let the ≤30s clip pierce Silent/Focus/DND —
  the closest analog to Android's `USAGE_ALARM`.
- **Nothing on iOS is device-verified** — RNTP audio, notifications, location, and the
  Critical-Alerts path have never run on an iPhone. Budget for iOS-native surprises: Android
  had THREE New-Arch RNTP crashes that only appeared on-device, not in the green jest suite.

## Step-by-step

### iOS-1. Enroll in the Apple Developer Program
- **$99 / year** (vs Google's one-time $25). developer.apple.com. An **Organization**
  enrollment (needs a D-U-N-S number) is preferable for a published app. Hard prerequisite —
  nothing below works without it. No Mac needed to *build* (EAS builds iOS in Apple-hosted
  macOS CI), but a physical iPhone (or a Mac + simulator) is needed to *verify*.

### iOS-2. Create the App Store Connect record
- appstoreconnect.apple.com → My Apps → **+** → New App. iOS, name "Nour", primary language
  Arabic, bundle id `com.nour.mobile` (register it first under Certificates, Identifiers &
  Profiles), SKU e.g. `nour-mobile`. Note the assigned **Apple ID (numeric app id)** → that's
  `ascAppId` for `eas.json`.

### iOS-3. Credentials & env
- `cd apps/mobile && eas credentials` (iOS) — let **EAS manage** the distribution certificate
  + provisioning profile. For Critical Alerts the profile MUST include that entitlement (iOS-6).
- `eas env:create` `APPLE_ID`, `APPLE_TEAM_ID`, and (if absent) `EXPO_PUBLIC_API_BASE_URL` in
  the **production** environment.

### iOS-4. First simulator build + smoke test (BEFORE any paid review)
```bash
cd apps/mobile
eas build --profile preview --platform ios   # simulator:true → a .app to run on a Mac sim
```
- Run on the iOS simulator (or a `--profile development` dev-client build on a real iPhone) and
  walk the app: data loads (not localhost), audio + lock-screen transport, prayer-times +
  location permission, a foreground adhan fires, Quran/adhkar render RTL. **This is where
  iOS-only native issues surface.**

### iOS-5. Add export-compliance + buildNumber, rebuild
- `app.json`: `ios.buildNumber: "1"` and `ios.infoPlist.ITSAppUsesNonExemptEncryption: false`
  (see gaps). Then rebuild.

### iOS-6. Request the Critical Alerts entitlement (optional, recommended)
- **Not self-service**: submit Apple's request form (developer.apple.com/contact → "Critical
  Alerts") justifying the adhan/prayer-alarm use case. After Apple grants it on the App ID,
  regenerate the provisioning profile (`eas credentials`) so the production build carries it.
  Until granted, ship without it — the code already degrades to a normal notification.

### iOS-7. Production build + TestFlight
```bash
cd apps/mobile
eas build  --profile production --platform ios   # store distribution, Apple-hosted build → IPA
eas submit --profile production --platform ios   # uploads to App Store Connect / TestFlight
```
- The build lands in **TestFlight**; add testers and verify end-to-end on a real iPhone (esp.
  the adhan with the Silent switch ON, if Critical Alerts was granted).

### iOS-8. App Store review submission
- In App Store Connect fill: **App Privacy** nutrition labels (Location → App Functionality,
  *not* tracked / *not* linked to identity; no other collection), **age rating** questionnaire,
  screenshots (the current required device sizes), description AR+EN, keywords, support URL,
  **privacy policy URL** (`…/privacy`), and **review notes** explaining why the app uses
  location (prayer-time computation) and Critical Alerts (adhan). Export compliance is answered
  by iOS-5.
- Submit. Apple review is typically **1–3 days**; location + Critical Alerts + background audio
  are the fields most likely to draw a reviewer question — the review notes pre-empt them.

## iOS — Out of scope / not done
- Any actual build (never run). Apple account not created. Critical Alerts entitlement not
  granted. `ascAppId` / `APPLE_ID` / `APPLE_TEAM_ID` / `buildNumber` / export-compliance not set.
- On-device verification of every iOS flow — must happen at iOS-4 and iOS-7.

---
---

# Publish Nour Extension to the Chrome Web Store (+ Firefox AMO)

> Release runbook for shipping `apps/extension` (Chrome MV3 + Firefox) to the public
> stores. No EAS / native build is involved — the artifacts are plain zipped `dist/`
> folders produced by Vite. Read APP_CONTEXT.md first.

## Context
The extension (`apps/extension`, CRXJS + Vite, MV3) is feature-complete: a 9-route SPA
(new-tab, popup, options), AR/EN bilingual, 42 tests green. `pnpm --filter extension build`
emits **two** unpacked builds — `dist/chrome/` and `dist/firefox/` — from a single source
via the `--mode` define (`vite.config.ts`). The Chrome manifest derives its `version` and
`name` from `package.json` (`src/manifest.config.ts`).

Two facts shape the listing:
- **`package.json` version is `0.0.0`** → the Web Store rejects `0.0.0` and requires a
  strictly increasing version on every upload. **Bump to `1.0.0` before the first package**
  (this flows into both manifests automatically).
- **`host_permissions: ["https://nour-platform-web.vercel.app/*"]`** (plus `notifications`,
  `alarms`, `offscreen`, `storage`) → triggers Web Store **permission-justification review**
  and a mandatory privacy disclosure. Reuse the same hosted `/privacy` page added for mobile
  (Part A1 above) as the privacy-policy URL.

---

## Part D — Code/config changes (in-repo, can do now)

### D1. Bump the package version
- Set `apps/extension/package.json` `"version"` to `"1.0.0"` (was `0.0.0`). Both
  `manifest.config.ts` and `manifest.firefox.config.ts` read `pkg.version`, so Chrome and
  Firefox stay in lockstep. Re-bump (`1.0.1`, …) for every subsequent store upload.

### D2. Confirm the production API origin is baked in
- The build inlines `EXT_API_BASE_URL` (falls back to
  `https://nour-platform-web.vercel.app` in `vite.config.ts`). The default already targets
  prod, so a plain `pnpm --filter extension build` is correct. Only set `EXT_API_BASE_URL`
  if the final domain changes — and then update `host_permissions` in **both** manifests to
  match, or live fetches are blocked.

### D3. Store icon / listing art
- Packaged icons exist (`public/icons/icon-{32,192,512}.png`). The Web Store listing also
  needs a **128×128** store icon and screenshots — see D5/E4. These live with the listing,
  not in the repo.

### D4. Build the upload packages
```bash
# from repo root — runs the dual-target build
pnpm --filter extension build      # → apps/extension/dist/chrome + dist/firefox

cd apps/extension
# Chrome Web Store wants a zip of the dist CONTENTS (manifest.json at the zip root):
cd dist/chrome && zip -r ../../nour-chrome-1.0.0.zip . && cd ../..
# Firefox AMO package:
cd dist/firefox && zip -r ../../nour-firefox-1.0.0.zip . && cd ../..
```
- Verify each zip has `manifest.json` at its **root** (not nested under `chrome/`).

---

## Part E — Chrome Web Store setup (manual, interactive)

> Browser logins + a one-time payment. Use the `! <command>` prompt prefix for any CLI auth.

### E1. Developer account
- Register at **chrome.google.com/webstore/devconsole** (**$5 one-time** registration fee,
  separate from the Google Play $25). A Google account is enough; an organization publisher
  display name can be set later in account settings.

### E2. Create the item & upload
- "Add new item" → upload `nour-chrome-1.0.0.zip`. The console parses the manifest and
  pre-fills name/version.

### E3. Privacy & permissions (the review-sensitive part)
- **Single purpose** field: one sentence — "Desktop azan reminders, prayer times, and
  Islamic audio playback from the Nour platform."
- **Permission justifications** (each requested permission gets a one-liner):
  - `alarms` — schedule the next prayer's azan trigger.
  - `notifications` — fire the azan/prayer notification.
  - `offscreen` — MV3 audio playback (service workers can't hold an `<audio>` element).
  - `storage` — persist settings, location, and player state on-device.
  - `host_permissions` (vercel origin) — fetch prayer times + audio content from the Nour
    API. **This is the most-scrutinized field; keep the justification specific.**
- **Data usage** disclosure: collects no personal data, no analytics, no third-party
  transfer; all state is local. Tick the "does not sell/transfer" certifications.
- **Privacy policy URL**: `https://nour-platform-web.vercel.app/privacy` (the page from
  Part A1). Required because the item requests host + notification permissions.

### E4. Store listing assets
- **Store icon 128×128 PNG** (derive from `icon-512.png`).
- **At least 1 screenshot** at **1280×800** or **640×400** (capture the new-tab dashboard,
  the popup sun-arc + prayer countdown, a playlist + player).
- Small promo tile **440×280** (optional but recommended for featuring).
- Title, summary, detailed description (AR + EN), category (**Lifestyle** or
  **Productivity**), primary language.

### E5. Distribution & submit
- Visibility **Public** (or **Unlisted** for a soft launch). Choose target regions
  (default: all).
- Submit for review. First review for an item with host + notification permissions
  typically takes a **few days**; the host-permission justification is the usual hold-up.

---

## Part F — Firefox Add-ons (AMO) — optional, parallel track

- Account + submission at **addons.mozilla.org/developers** (free, no fee).
- Upload `nour-firefox-1.0.0.zip`. AMO **signs** the package; an `id` is assigned (or set
  one via `browser_specific_settings.gecko.id` in `manifest.firefox.config.ts` if not
  already present). The Firefox build already uses `webextension-polyfill` and a player-tab
  audio strategy instead of the Chrome offscreen document, so no code change is needed.
- AMO review is largely automated but a human pass can follow for permission-heavy add-ons.

---

## Extension — Out of scope
- Edge Add-ons store (Chromium — the same `dist/chrome` zip works there if wanted later).
- Self-hosted/CRX direct distribution (enterprise side-load) — not pursued.

## Extension — Verification
- `cd apps/extension && pnpm lint && pnpm typecheck && pnpm test` all green; then
  `pnpm --filter extension build` produces `dist/chrome` + `dist/firefox`.
- Load-unpacked smoke test **before** zipping: `chrome://extensions` → Developer mode →
  "Load unpacked" → select `dist/chrome`; confirm new-tab, popup arc/countdown, prayer
  notifications, and audio playback against **live** prod data.
- Each zip has `manifest.json` at its root and a non-`0.0.0` version.
- `/privacy` is reachable (the store validates the URL).
- After submit: item shows "Pending review"; once live, install from the public listing and
  re-run the smoke test end-to-end.
