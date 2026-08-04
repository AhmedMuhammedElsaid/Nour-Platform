<!-- markdownlint-disable MD024 -- repeated section names (Blockers, Owner-manual steps, Known limitations, etc.) recur intentionally across surfaces for scannability; do not rename to satisfy this rule. -->

# Nour Platform — Pre-Publish Status (Consolidated)

> Compiled 2026-08-04. **Supersedes and replaces** `missing_points.md`, `PUBLISH_STATUS.md`,
> `review_mobile_report_fable.md`, and `extension_app_points.md` (all four deleted after this
> file was verified to carry every open item forward — backups kept outside the repo, see
> session notes). This is now the single pre-publish status doc; update it in place going
> forward instead of spawning new root-level status files.
>
> **Provenance, honestly stated:**
>
> - **Live-verified 2026-08-04** (this session's spine, from `missing_points.md`): `git log
>   origin/main..main` empty (HEAD `622753b`), EAS production env var confirmed, extension
>   zips rebuilt from HEAD + spec-verified, extension gate re-run (94 tests), A72 adb
>   screenshot verification of 4 mushaf/mobile items, native-heap re-measurement with corrected
>   bucket attribution.
>   - **Web + extension baseline** verified live 2026-07-30 (Lighthouse + prod console against
>     `https://nour-platform-web.vercel.app`).
>   - **Everything else is doc-derived** (carried from `PUBLISH_STATUS.md` 2026-07-17,
>     `review_mobile_report_fable.md` 2026-07-15, `extension_app_points.md` 2026-07-30,
>     `PRODUCTION.md` undated) and NOT re-checked this session — treat as "last known", flagged
>     inline where a newer doc contradicts an older one.
>
> ✅ **RESOLVED 2026-08-04 by the owner directly: BOTH developer accounts are PAID** — Chrome Web
> Store ($5 one-time) and Google Play Console ($25 one-time). `PRODUCTION.md` §2.1 was right and the
> newer docs were the stale ones on this specific point. ⚠️ Caveat: *payment* is not the same as
> *completed registration* — Play also requires identity verification (and, for an organisation account, a
> D-U-N-S number), which can take days and gates publishing. Confirm the console shows the account
> fully verified, not just paid, before counting this closed.
>
> ⚠️ **Still-unresolved doc conflict (paths):** `PRODUCTION.md` references
> `apps/mobile/store/listing.md` + `apps/mobile/store/screenshots/`, while other docs say
> `apps/mobile/store-assets/` — and neither directory currently exists on disk (verified
> 2026-08-04). Two stale/competing conventions; **owner: pick one** before
> trusting either claim.

---

## 🌐 Web (`apps/web`)

**State: closest to done. Code-side blockers: none.**

### Blockers

- None.

### Owner-manual steps

- [ ] **Google Search Console** — add property for the prod host, submit `/sitemap.xml`.
- [ ] **Bing Webmaster Tools** — import from Search Console or add manually, submit sitemap.
- [ ] **UptimeRobot** (optional) — HTTP monitor on `/api/health`, 5-min interval, keyword `ok`.

### Open — mechanical (agent-doable)

- [ ] **PWA manifest install-sheet screenshots.** Throwaway Playwright script (scratchpad, not
  repo): narrow `1080×2340` (`/ar` + `/ar/prayer-times`), wide `1280×800` (desktop home).
  Optimize with the ffmpeg palette trick (~63% size cut). Add a `screenshots` array to
  `public/manifest.webmanifest`. Model: Haiku.

### Known limitations (decisions, not bugs)

- **LCP is hydration-bound (~3.9 s mobile), not asset-bound.** Proof: `/en`'s LCP element is
  the PWA install banner — an island that only exists after hydration. Further asset squeezing
  won't move it; the fix is shipping fewer/lazier home-page client islands. Needs a design
  pass, not a patch.
- **No CDN cache and no bf-cache.** `force-dynamic` + nonce-CSP ⇒ HTML is
  `Cache-Control: no-store`, TTFB ~700–900 ms. Lighthouse offers ~1,430 ms here, but claiming
  it means revisiting the nonce-CSP / dynamic-render trade-off. **Owner's call.**
- Best-practices score sits at **96**, not 100 — residue is `uses-long-cache-ttl` (2 resources)
  + ~14 KiB legacy-JS polyfill. Diminishing returns; not chased.
  <!-- markdownlint-disable-line MD004 -- the "+" above is a literal plus sign in prose
       ("2 resources PLUS ~14 KiB"), not a list marker. Do not convert it to "-". -->


### Deferred backlog — explicitly NOT blockers

Sentry wiring · R2 CORS for offline audio · nightly E2E vs prod · Lighthouse CI +
bundle-budget gate · analytics (needs an ADR) · custom domain.

---

## 🧩 Extension (`apps/extension`)

**State: zero code work left.** All fixes pushed. Gate green: **exit 0, 94 tests** (older docs
citing 51 or 47 tests are stale).

### Blockers

- None (code). One open **owner decision** below affects the submission.

### Owner-manual steps

- [ ] **Recapture store screenshots 1 & 3** at exactly `1280×800` — current files (all dated
  Jul 14) still show pre-fix junk cards. **No agent can do this** — driving a browser to
  screenshot a rendered extension isn't possible from here.
  - Recipe: load the built `dist/chrome` (⚠️ **never `pnpm dev` output** — causes `"SW
    registration failed: Status code 3"`), press "Clear" on the continue-listening shelf once,
    play one real playlist track, then capture. `store-assets/make-screenshot.ps1` normalizes a
    raw capture to exactly 1280×800 on the dashboard's dark canvas. Requires `ffmpeg`/`ffprobe`
    on `PATH` (lives at `%LOCALAPPDATA%\Programs\ffmpeg\bin` — agent shells have stale `PATH`,
    refresh from registry).
- [ ] **Load-unpacked smoke test**: new tab renders · continue-listening shows no live-radio
  cards · whole-row click plays · close/replay work · popup + options work · AR⇄EN + RTL +
  light/dark · no SW console errors.
- [ ] **Chrome Web Store submission** — $5 one-time registration at
  chrome.google.com/webstore/devconsole → upload zip → paste fields from
  `store-assets/LISTING.md` → privacy URL `https://nour-platform-web.vercel.app/privacy` →
  submit.
- [ ] **Firefox AMO** (optional, free) — addons.mozilla.org/developers → upload firefox zip →
  reuse `LISTING.md` copy (gecko id already set: `nour@nour-platform.com`, required
  `data_collection_permissions` block present).

### Gotchas (preserve verbatim — highest-value content in the old docs)

- **PowerShell `Compress-Archive` writes backslash-separated paths** — both Chrome Web Store
  and AMO reject these. Use `.NET ZipArchive` instead, and exclude `.vite/`:

  ```powershell
  Add-Type -AssemblyName System.IO.Compression.FileSystem
  function New-StoreZip($distDir, $zipPath) {
      if (Test-Path $zipPath) { Remove-Item $zipPath }
      $tmp = Join-Path $env:TEMP "ext-zip-src"
      if (Test-Path $tmp) { Remove-Item -Recurse -Force $tmp }
      Copy-Item $distDir $tmp -Recurse
      Remove-Item (Join-Path $tmp ".vite") -Recurse -Force -ErrorAction SilentlyContinue
      [System.IO.Compression.ZipFile]::CreateFromDirectory($tmp, $zipPath)
      Remove-Item -Recurse -Force $tmp
  }
  New-StoreZip "apps/extension/dist/chrome"  "apps/extension/nour-extension-chrome-v<version>.zip"
  New-StoreZip "apps/extension/dist/firefox" "apps/extension/nour-extension-firefox-v<version>.zip"
  ```

- **Version bump**: edit `apps/extension/package.json` `"version"` — both
  `src/manifest.config.ts` (Chrome) and `src/manifest.firefox.config.ts` (Firefox) read this
  value automatically, no other file needs editing.
- Build commands: `pnpm --filter extension build:chrome` / `build:firefox` →
  `apps/extension/dist/{chrome,firefox}/`.

### ✅ Done this session (2026-08-04)

- [x] ~~Rebuild zips from current `main`~~ — both rebuilt from HEAD `622753b` (prior Jul 26
  zips predated the `icon-32` brand crop `5fc543b`/`a9dd1bb`, the WCAG dark-text fix
  `079e521`, and `8af7845`). Verified: `backslash=0`, `manifest.json` at zip root, `.vite/`
  excluded, no `localhost`, `host_permissions` prod-only, `geolocation` present, Firefox
  `gecko.data_collection_permissions.required:["none"]` present in the emitted manifest.
  Chrome 29 entries / Firefox 28, ~727 KB each.

### Icon wordmark/watermark — ✅ FIXED 2026-08-04

- [x] ~~Icon carries baked-in text + probable generator watermarks~~ — owner decided: keep the
  Quran scene, drop the "N" logo entirely. `apps/mobile/assets/icon.png` (the canonical 1024×1024
  source) had a **"Nour Platform" wordmark** + **"N" book logo** top-right, a **second smaller "N"
  logo** bottom-left, and a **✦ sparkle** bottom-right — the last two sat exactly where image
  generators place watermarks, and text at small icon sizes is mush (*why* `icon-32.png` needed a
  tight crop, `a9dd1bb`: "collapsed into a dark smudge").
  **Fix method:** all three marks sat on a plain gradient sky/ground, no structure underneath —
  removed via `skimage.restoration.inpaint_biharmonic` (a manual mirrored-crop patch was tried
  first and rejected: the art isn't truly mirror-symmetric, so it left a visible seam).
  Verified clean at 1024/512/192/128px, no ghosting, no legible remnants.
  **Regenerated (7 files, all git-tracked, revertible via `git checkout`):**
  `apps/mobile/assets/icon.png` (canonical source) ·
  `apps/web/public/{android-chrome-512x512,android-chrome-192x192,apple-touch-icon}.png` ·
  `apps/extension/public/icons/{icon-512,icon-192}.png` ·
  `apps/extension/store-assets/icon-128.png`.
  **Untouched, verified already mark-free (no marks to remove — different compositions):**
  `apps/mobile/assets/adaptive-icon.png` (already a tighter-zoom crop) ·
  `apps/mobile/assets/android-icon-monochrome.png` (separate silhouette layer, bbox never
  overlapped the marks) · `apps/web/public/icons/maskable-512.png` (already a tighter-zoom crop) ·
  `favicon-16x16.png`/`favicon-32x32.png`/`favicon.ico`/extension `icon-32.png` (all pre-existing
  tight book-only crops that never included the marks).
  ⚠️ **Consequence: extension zips are stale again** — `icon-512`/`icon-192` changed after the
  2026-08-04 zip rebuild earlier this session. Rebuild once more before submitting (§A.3–A.4
  below). `store-assets/icon-128.png` also changed — re-verify it's the one uploaded to CWS.

### v1.0.1 backlog — non-blocking

Icon sizes 16/48/128 (currently 32/192/512 — off-convention, not broken) · `_locales` AR/EN
manifest i18n · reciter-name label clamp (mid-name ellipsis on shelf).

---

## 🤖 Android (`apps/mobile`)

**State: code ready, process not started.** A `2026-07-03` hardening pass (3 parallel audits:
perf / crash-safety / store-readiness) returned **GO, no code blockers** — re-checked
2026-08-04, nothing found since contradicts it. Current build: **versionCode 10 / v1.1.1**
(runbook below is dated versionCode 8 — stale on specifics, kept for its still-live Phase 3
roadmap structure).

### Blockers

- [ ] **Production AAB has never been built.** `eas build:list --profile production` is empty
  — every build to date (incl. versionCode 10) was the `preview` profile (APK, `preview`
  channel); what's on the A72 is not a store artifact. `google-play-key.json` and
  `apps/mobile/store-assets/` do not exist. **This — plus Play Console registration — is the
  real bottleneck**, not app code.
- [ ] **Play Console registration** — status genuinely unclear, see the conflict note at the
  top of this file. Confirm before proceeding.

### ✅ Resolved this session (2026-08-04) — was previously flagged, now closed

- [x] ~~Reconcile unpushed work~~ — `git log origin/main..main` is EMPTY, main not behind. The
  "committed not pushed" SHAs in prior docs/memory (`5ac55e0`, `0f3b5c9`, `f342981`, `29f0599`)
  were **stale claims** — all already on origin. HEAD = `622753b`.
- [x] ~~`EXPO_PUBLIC_API_BASE_URL` in EAS production~~ — CONFIRMED SET:
  `eas env:list --environment production` → `EXPO_PUBLIC_API_BASE_URL=https://nour-platform-web.vercel.app`.
  The "bakes localhost into the AAB" risk is closed.
- [x] **No new native EAS build needed for anything shipped since versionCode 10** — nothing
  touching `app.json`/`android/`/`ios/`/native deps has changed since the last build
  (`10c1f9e7`, versionCode 10, runtime 1.1.1, built 2026-07-21). Perf pass #3, mushaf row-gap
  fix, `setupPlayer` race fix are all JS-only, delivered via `eas update` OTA, verified on A72.

### Native heap — recommend CLOSE, not a ship blocker

Re-measured 2026-08-04 (A72, 3 cold launches). **Corrected numbers:**

- **The widely-quoted "~265 MB" figure was Native Heap ONLY. Total PSS is ~497 MB.** Not a
  regression — a narrower metric than prior docs implied. Expect the larger number in Play
  Console vitals.
- Native Heap ~236–291 MB (alloc ~248–266 MB, free only ~5–14 MB ⇒ genuinely live, not
  fragmentation) · Graphics ~72–76 MB · Code ~71–72 MB · Dalvik ~10–12 MB.
- **Ruled OUT:** bitmap/image decode · offline prefetch + query-cache hydration (heap already
  ~253 MB at t≈1s, before the 3s-delayed `runOfflinePrefetch` fires, then flat) · fragmentation
  · static library footprint (20.5 MB `.so` finding) · the `setupPlayer` race (already fixed).
- **What's left:** C++/JNI allocation during TurboModule/bridgeless init (~20 native modules) +
  dual Hermes/Reanimated-worklets runtimes, all before `Running "main"`. `MainApplication.kt` is
  stock Expo boilerplate — nothing custom to blame.
- **Only way to attribute further:** `eas build --profile development` + a real profiler for
  allocation stacks. Costs EAS quota — owner's call, better spent post-launch on real low-RAM
  crash data.
- ⛔ **Do NOT** "fix" via R8/`minifyEnabled`: `apps/mobile/android/` is gitignored and
  regenerated by prebuild (editing gradle directly is a no-op); the real lever is
  `expo-build-properties`, not currently a dependency, needs an ADR. Tiny Dalvik/`.art` numbers
  argue minification wouldn't move Native Heap anyway.

### Device-verify status (A72)

✅ **Verified 2026-08-04 by adb screenshot** (device on versionCode 10 / v1.1.1 + current OTA;
deep-linked `nour://quran/2`, cold launch):

- [x] Mushaf row-gap fix (`3bdccfd`) — GOOD. Lines evenly spaced, no drift, page fills.
- [x] Amiri Quran font DID ship in the OTA — text renders in Amiri, ornate ayah-end rosette
  markers present (font-dependent `U+06DD` prefix, proves the asset loaded).
- [x] No bottom-dock overlap — page footer (`صفحة ٢ · الجزء ١`) clears the tab bar.
- [x] Bismillah renders with correct diacritics.
- ℹ️ Ragged right-edge justification still visible — **known + accepted** (no RN
  `text-align-last`, per-word fix declined). Not a regression.

Still pending device-verify:

- [ ] Perf pass #3 items
- [ ] Adhkar reminder click-through (test button `f746417` + `9310e1f`)
- [ ] Adhan stop control
- [ ] Friday Al-Kahf reminder

### Possibly stale — unverified this session, kept for safety

Carried from `review_mobile_report_fable.md` (2026-07-15). The app has been running on
versionCode 10 since 2026-07-21 with no reported adhan failures, which suggests these are
likely already satisfied in practice — but none were re-checked this session, so keep them as
an explicit checklist rather than assume:

- [ ] Armed-alarm count via `adb shell dumpsys alarm | grep -c com.nour.mobile` → expect ~12
  (not 2, not ~200).
- [ ] Adhan fires under Doze (`adb shell dumpsys deviceidle force-idle` + lock + test-adhan
  button) — full adhan plays on time, on `USAGE_ALARM` (audible on silent).
- [ ] Alarm window rolls forward after a real prayer fires with the app closed (re-check
  `dumpsys alarm` afterward — pool should re-arm without opening the app).
- [ ] Reboot re-arm — reboot phone, do NOT open the app, confirm `BootReceiver` re-arms alarms.
- [ ] Music ducking — RNTP ducks/pauses radio when a test adhan fires, resumes after.
- [ ] Code-hygiene items from the same report, likely already done given the current clean
  `git log` but not individually re-verified: stray `[qibla-debug2]` debug log in
  `apps/mobile/features/qibla/hooks/use-compass-heading.ts:71`; `apps/mobile/eas.json` explicit
  `"environment": "production"` on `build.production`; `apps/mobile/publish_play_store.md`
  EAS project name (should read `ahmedmuhammedelsaid`, not the old `volunteering-apps/...`).
- [ ] Force-close session rehydration (`5ac55e0`+`0f3b5c9`) — code is on origin (per this
  session's `git log` check), but on-device confirmation of the actual rehydration behavior
  (audio pauses on swipe-from-recents, mini-player restores without restarting the stream on
  reopen) was still flagged "pending" in the last dedicated pass on this feature.

### Owner-manual steps — Play Console pipeline

Roadmap structure preserved from `review_mobile_report_fable.md` (2026-07-15, versionCode 8 —
**version numbers stale, sequence/steps still the live runbook**):

1. **Register Play Console** (do first — the clock is the bottleneck either way):

   | | Personal account | Organization account |
   |---|---|---|
   | Cost | $25 one-time | $25 one-time |
   | Requirement | ID verification | D-U-N-S number (free, days–weeks) |
   | Closed-test rule | **20 testers × 14 continuous days** before production access | Skipped entirely |

2. **Service account** — Play Console → Setup → API access → create/link Google Cloud service
   account → grant **Release Manager** permission → download JSON key → save as
   `apps/mobile/google-play-key.json` (gitignored, referenced by `eas.json`, does not exist yet).
3. **Pre-flight**: `git log origin/main..main` (confirm nothing unpushed) + `eas env:list
   --environment production` (confirm `EXPO_PUBLIC_API_BASE_URL` set — already confirmed above,
   re-check before the actual build since time has passed).
4. **First production AAB**: `eas build --platform android --profile production` (or `pnpm
   --filter mobile build:production`). First run creates the EAS-managed keystore — accept it.
   Treat as one-shot (quota).
5. **Version bump rule**: `runtimeVersion.policy: "appVersion"` — OTA compatibility gates on
   the `version` STRING, not `versionCode`. For any native change: bump `expo.version` AND
   `android.versionCode`. Do NOT bump `version` for a JS-only change — breaks OTA delivery to
   already-installed builds. Nothing native has changed since versionCode 10 — no bump needed
   for the current backlog.
6. **Fix store listing placeholders** (path per `PRODUCTION.md` — verify this path is current,
   see conflict note top of file): `apps/mobile/store/listing.md` — privacy policy URL
   `https://nour.example.com/privacy` → `https://nour-platform-web.vercel.app/privacy`; contact
   email `front@tech-flow.nl` → real support contact.
7. **Capture store assets**: phone screenshots (min 2), feature graphic (1024×500), hi-res icon
   (512×512). Path per `PRODUCTION.md`: `apps/mobile/store/screenshots/` currently only has
   `.gitkeep`.
8. **Permission declarations** (top review-rejection risk):
   - `USE_EXACT_ALARM` / `SCHEDULE_EXACT_ALARM` — low risk, justify as "prayer-time alarm app,
     alarms must fire at the exact minute; core functionality."
   - `REQUEST_IGNORE_BATTERY_OPTIMIZATIONS` — **medium-high risk, Play scrutinizes hard.
     Decision needed (Opus-tier per CLAUDE.md §15.1):** (1) keep + justify "adhan is
     alarm-class, OEM battery managers break it", or (2) drop and fall back to the
     no-permission `IGNORE_BATTERY_OPTIMIZATION_SETTINGS` list screen
     (`lib/battery-optimization.ts` already has the fallback chain — removal is small but is a
     **native change → new build + version bump**).
   - `mediaPlayback` foreground-service declaration (targetSdk 34+ requires it) for (1) the
     native adhan player service (`AdhanPlayerService.kt`) and (2) RNTP background audio. Have
     a short screen-recording of closed-app adhan firing ready — unblocks stalled reviews.
9. **Data safety questionnaire** — honest answers all favorable: no accounts, no analytics, no
   ads, no data leaves device; location collected, used on-device only for prayer
   times/qibla; local notifications for adhan. Privacy policy verified live, bilingual.
10. **Content rating questionnaire** — religious/educational, no UGC → expect "Everyone".
11. **Submit**: `eas submit --platform android --profile production` (needs
    `google-play-key.json`) → **internal** track first, smoke-test the actual AAB (not the
    preview APK) → promote to **closed testing** (14-day/20-tester window if personal account)
    → request **production** access → staged rollout (20%→100% sensible default).

### Deferred backlog — non-blockers

- Tafsir sparsely populated — backend **data-seeding** gap, not app code.
- Radio display order — owner should re-run `pnpm seed:radio` once so curated order shows
  in-app (data-only, no app change).
- `React.memo` coverage — only `PlaylistCard` memoized; fine at current catalog size.

---

## 🍎 iOS (`apps/mobile`, iOS track)

**State: not started. Separate project phase, not a checklist.** Never built, never run on
simulator or device, and **no Apple Developer account ($99/yr).**

### Blockers

- [ ] No Apple Developer account.
- [ ] No `ios.buildNumber`.
- [ ] `APPLE_ID` / `APPLE_TEAM_ID` / `ascAppId` all unset.
- [ ] No `ITSAppUsesNonExemptEncryption: false` (export compliance).
- [ ] `EXPO_PUBLIC_API_BASE_URL` must be set in the EAS production env (separate from the
  Android confirmation above — iOS builds read the same EAS project but this hasn't been
  independently re-checked for an iOS profile).
- [ ] **Critical Alerts entitlement ungranted** — needs a paid membership *plus* a
  non-self-service Apple support request. Until granted, iOS adhan degrades to a ≤30s
  notification clip when the app is closed (full adhan is foreground-only). By-design platform
  limitation, not a bug.

### Known limitations

Config *is* scaffolded (`eas.json` iOS profiles, `app.json` bundle id / `UIBackgroundModes` /
critical-alerts entitlement / opaque icon) but nothing has been exercised.

### Runbook

Full step-by-step already exists: `apps/mobile/publish_play_store.md` → steps **iOS-1 →
iOS-8** (enroll → ASC record → credentials → simulator smoke → export compliance → Critical
Alerts request → prod build/TestFlight → review). Readiness summary in
`apps/mobile/APP_CONTEXT.md` → "iOS release readiness".

---

## ⚙️ Cross-cutting / infra

### Owner-manual steps

- [ ] Confirm Atlas cluster + R2 bucket are the **production** tier, not dev leftovers.
- [ ] Cloudflare DNS + SSL — only if moving off the `.vercel.app` host.
- [ ] `pnpm seed:adhkar` against prod. ⚠️ **Arabic adhkar text should be reviewed for accuracy
  first** — flagged as unreviewed.
- [ ] `pnpm seed:radio` re-run needed for station reorder to take effect.

### Standing rule

- ⛔ **Never run the full `pnpm migrate` chain on embedded-locale data** — use `pnpm migrate
  --only <name>`.

### Worth carrying forward — process finding

This session's two most valuable findings were both **security headers that silently disabled
a shipped feature** — `connect-src` missing `api.aladhan.com` (all prayer-timetable fetches
blocked) and `Permissions-Policy: geolocation=()` (the "use my location" button dead). Neither
was caught by lint, typecheck, tests, or the build; **both were only visible in a real browser
console against production.** Do a console check after any header change — this is the one bug
class this project's gate structurally cannot see.

---

## 📌 Summary

| Surface | State | What's actually left |
|---|---|---|
| **Web** | ✅ Closest to done | 1 mechanical task (manifest screenshots) + 3 owner-manual submissions (GSC/Bing/UptimeRobot); 2 architectural decisions deliberately deferred (LCP hydration cost, no-cache CSP trade-off) |
| **Extension** | ✅ Code ready, ⚠️ zips stale again | Icon fixed 2026-08-04 (N logo removed) → **zips need one more rebuild** (§A.3–A.4) + screenshots 1&3 recapture (owner-manual) + Chrome/Firefox devconsole submission (owner-manual) |
| **Android** | ✅ Code ready, ⚠️ process not started | No code blockers, nothing unpushed, EAS env correct, heap re-measured → recommend CLOSE. ✅ Play Console **paid** 2026-08-04 (verify identity-verification completed). Real bottleneck now: first production AAB (never built) + `google-play-key.json` + store assets, none of which exist yet |
| **iOS** | ❌ Not started | No Apple account; whole separate project phase; runbook already written (`publish_play_store.md` iOS-1→iOS-8) |

---

## 🚀 Release runbook (merged from `PRODUCTION.md`)

Everything above is **status** — what's left. This section is **procedure** — how to actually ship.
Steps marked **(owner-manual)** happen in a browser/console, not in this repo.

### A. Browser extension (Chrome + Firefox)

#### A.1 Pre-flight

```bash
git log origin/main..main                  # confirm nothing unpushed
pnpm turbo run lint typecheck test build   # FULL gate, no --filter
```

⛔ Never pipe the gate into `tail` — it masks the exit code and has reported a false green before.

**A.2 Bump version (new release only).** Edit `apps/extension/package.json` `"version"`. Both
`src/manifest.config.ts` and `src/manifest.firefox.config.ts` read it automatically — no other file
needs editing. The store rejects `0.0.0`. Re-bump on every upload.

#### A.3 Build

```bash
pnpm --filter extension build:chrome     # → apps/extension/dist/chrome/
pnpm --filter extension build:firefox    # → apps/extension/dist/firefox/
```

**A.4 Package into store zips.** ⛔ **Do NOT use PowerShell `Compress-Archive`** — it writes
backslash-separated entry names that both CWS and AMO reject.
⚠️ **`PRODUCTION.md`'s original recipe used `[ZipFile]::CreateFromDirectory` — that is ALSO suspect**:
on PowerShell 5.1 (.NET Framework) it has the same backslash-entry behaviour, and it was never
verified. It is replaced here by the recipe **actually used and verified on 2026-08-04**
(`backslash=0` asserted after packing): explicit `CreateEntry` with `$rel.Replace('\','/')`, loading
**BOTH** `System.IO.Compression` (for `ZipArchiveMode`) and `System.IO.Compression.FileSystem` —
loading only the latter fails with "Unable to find type [ZipArchiveMode]". Exclude `.vite/`; put
`manifest.json` at the zip ROOT. A working copy of the script lives in this session's scratchpad
(`pack-ext.ps1`). **Always assert `backslash=0` after packing.**
⚠️ Delete old zips via Bash `rm -f`, not `Remove-Item -Force` (sandbox-blocked on some paths here).

**A.5 Recapture screenshots.** `apps/extension/store-assets/make-screenshot.ps1` only **normalizes**
a raw capture to exactly 1280×800 — **capture itself is owner-manual**; no agent can drive a browser
to screenshot a rendered extension. Needs `ffmpeg`/`ffprobe` on PATH
(`%LOCALAPPDATA%\Programs\ffmpeg\bin`; agent shells have a stale PATH — refresh from registry).

**A.6 Smoke test (load-unpacked).** Load `apps/extension/dist/chrome` — ⛔ **never `pnpm dev` output**,
that causes `SW registration failed: Status code 3`. Verify: new tab renders · continue-listening has
no live-radio cards · whole-row click plays · close/replay work · popup + options · AR⇄EN + RTL +
light/dark · no SW console errors.

**A.7 Chrome Web Store submission (owner-manual).** ✅ $5 registration PAID 2026-08-04. Upload the
chrome zip → paste copy/permission-justifications/privacy URL
(`https://nour-platform-web.vercel.app/privacy`) from `apps/extension/store-assets/LISTING.md` →
submit. Note routing is `localePrefix:'always'` so there is no bare `/privacy`; it redirects, which
is fine.

**A.8 Firefox AMO (owner-manual, optional, free).** Upload the firefox zip at
addons.mozilla.org/developers. `gecko.id` (`nour@nour-platform.com`) and the required
`data_collection_permissions` block are already set.

**A.9 After submitting.** CWS review: hours → a few days. AMO: hours → ~1 day (longer for new
accounts). If rejected, read the cited policy, fix, rebuild from A.3 — never resubmit unchanged.

### B. Android (Google Play via EAS)

#### B.1 Owner-manual prerequisites

- [x] Play Console account **paid** ($25) — 2026-08-04. ⚠️ Confirm identity verification is also
  complete; payment alone does not finish registration.
- [ ] Service account: Play Console → Setup → API access → create/link GCP service account → grant
  **Release Manager** on this app → download JSON → save as `apps/mobile/google-play-key.json`
  (gitignored; referenced by `eas.json`; **does not exist yet**).
- [ ] Decide personal vs. organization (D-U-N-S) account. **Personal requires a mandatory 14-day /
  20-tester closed test before production opens** — this gates the timeline independent of code.

#### B.2 Pre-flight

```bash
git log origin/main..main                # confirm nothing unpushed
eas env:list --environment production    # confirm EXPO_PUBLIC_API_BASE_URL is set
```

Missing `EXPO_PUBLIC_API_BASE_URL` in the production environment is the **#1 release footgun** — it
bakes `localhost` into the AAB and the app opens blank. ✅ Verified present 2026-08-04.

**B.3 Version bump rules.** `app.json` uses `runtimeVersion.policy: "appVersion"` — OTA runtime
version equals the `version` string, not `versionCode`. For **any native change** (native module,
permission, notification channel, font asset): bump BOTH `expo.version` (currently `1.1.1`) and
`android.versionCode` (currently `10`). ⛔ Do NOT bump `version` just to force a cache refresh on a
JS-only change — that breaks OTA delivery to installed builds. If nothing native changed, ship
JS-only via `eas update` instead. ⚠️ `eas update` publishes the **WORKING TREE** but captions it with
the **LAST COMMIT** — the caption lies; verify which bundle a device actually runs.

**B.4 Store listing + assets.** ⚠️ **Path conflict, owner must pick one:** `PRODUCTION.md` used
`apps/mobile/store/listing.md` + `apps/mobile/store/screenshots/`; other docs used
`apps/mobile/store-assets/`. **Neither exists on disk** (verified 2026-08-04). Placeholders to fix
once the path is chosen: privacy URL `https://nour.example.com/privacy` →
`https://nour-platform-web.vercel.app/privacy`; contact email `front@tech-flow.nl` → real support
address. Assets needed: phone screenshots (min 2), feature graphic 1024×500, hi-res icon 512×512
(✅ icon wordmark/watermark FIXED 2026-08-04, see §Extension "Icon wordmark/watermark" above —
generate the hi-res icon from the current `apps/mobile/assets/icon.png`).

#### B.5 Permission decisions

- `REQUEST_IGNORE_BATTERY_OPTIMIZATIONS` — **top Play-review rejection risk.** Keep (needed for
  reliable azan alarms) vs. drop; if kept, prepare a clear justification for the declaration form.
- `mediaPlayback` foreground-service type — required declaration for targetSdk 34+ (radio / Quran
  recitation). Prepare justification text in Play Console's "Foreground service permissions".

#### B.6 Build production AAB

```bash
pnpm --filter mobile build:production     # eas build --profile production
```

First run mints the EAS-managed keystore. **No production build has ever been produced** — confirm
with `eas build:list --profile production` before assuming one exists.

#### B.7 Submit

```bash
eas submit --platform android --profile production
```

Uses `google-play-key.json` (B.1), targets the `internal` track per `eas.json`.

**B.8 Play Console manual forms (owner-manual).** Data-safety questionnaire (no accounts, no
analytics, no ads, on-device location only) · content rating · target audience.

**B.9 Track progression.** Internal (immediate; sanity-check the real AAB, not the preview APK on
your test device) → Closed (14 days / 20 testers if personal account) → Production. At each stage
confirm: installs and launches · azan/notifications work · `EXPO_PUBLIC_API_BASE_URL` resolved to the
real API, not localhost.
⚠️ **EAS channel-mismatch trap:** the A72 tracks the `preview` channel, not `production` — an OTA
pushed to one will not appear on a device tracking the other. This has cost a debugging session before.

---

## Superseded files (deleted, backed up before deletion)

- `missing_points.md` (2026-07-30, updated 2026-08-04 — was the spine of this file)
- `PUBLISH_STATUS.md` (2026-07-17)
- `review_mobile_report_fable.md` (2026-07-15, versionCode 8 — roadmap structure preserved
  above under Android § Owner-manual steps)
- `extension_app_points.md` (2026-07-30, misnamed — was mobile-readiness content, folded into
  Android § above)
- `PRODUCTION.md` (undated release runbook — merged into § Release runbook above, with its
  unverified `CreateFromDirectory` zip recipe replaced by the verified one and its "Play Console
  registration done" claim confirmed correct)
