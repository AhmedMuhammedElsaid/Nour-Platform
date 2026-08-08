# ADR 0017 — Native shortcuts module (nour-shortcuts)

Status: accepted (2026-08-08).

## Context

`expo-quick-actions` (ADR 0012) already publishes the Sabah/Masaa/Kahf launcher
shortcuts as real Android `ShortcutInfo` dynamic shortcuts (`ExpoQuickActionsModule.kt`
`setShortcuts()` → `shortcutManager.dynamicShortcuts = [...]`), reachable today only
via long-press the app icon → drag onto the home screen. The user wants a one-tap
"Add to Home screen" button instead of long-press-and-drag.

Android's only mechanism for an app-initiated home-screen icon is
`ShortcutManager.requestPinShortcut()`, which shows the OS's own confirmation
dialog; once accepted the icon is **permanent** (no app API removes it — same as
a manually-dragged shortcut). `expo-quick-actions` never calls this method
anywhere in its source and exposes no JS API for it — confirmed by reading the
library's Android sources before writing any code.

## Decision

Add a local Expo native module `modules/nour-shortcuts` — Android-only (iOS has
no equivalent shortcut-pinning API; same precedent as the `NourHome` widget,
ADR 0014), the third local module after `nour-adhan` and `nour-compass`:

- `NourShortcutsModule.kt`: `isPinSupported()` (checks `ShortcutManager
  .isRequestPinShortcutSupported`, API 26+) and `requestPin(id)` (looks up the
  already-published dynamic shortcut by id and hands it straight to
  `requestPinShortcut()` — no new `ShortcutInfo` is built, since
  `expo-quick-actions` already set title/icon/intent correctly).
- JS bridge `lib/shortcuts-native.ts` (`requireOptionalNativeModule`, safe no-op
  when absent).
- Three small ghost buttons on the prayer-times screen (next to each reminder's
  existing Test button), gated on `pinSupported && notifGranted && <reminder>.enabled`.

**Not wired into onboarding** (decided with the owner): `requestPinShortcut`
isn't a checkable permission — every call pops its own dialog, so offering all 3
there would mean 3 extra confirmations stacked onto first launch. The
prayer-times buttons keep it optional and shown only when a user is already
engaging with that reminder.

## Consequences

- **Rebuild-gated** — a native module needs `eas build`, not OTA. Absent (OTA
  build / iOS), `isPinShortcutSupported()` resolves `false` and the buttons never
  render — no crash.
- The pinned icon is a one-time, permanent action once accepted — Android has no
  API for an app to later un-pin it, nor to draw a custom control on it. Removing
  it is the OS's own drag-to-remove gesture, identical to a manually-added
  shortcut.
- Follows the `build.gradle` gotcha from `nour-adhan`/`nour-compass`: plugins
  `com.android.library` + `expo-module-gradle-plugin` only — no explicit Kotlin
  plugin or pinned `androidx.core` version (both cause plugin/version conflicts).
