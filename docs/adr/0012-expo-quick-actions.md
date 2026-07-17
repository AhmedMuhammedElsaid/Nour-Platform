# ADR 0012: expo-quick-actions for launcher adhkar shortcuts

## Status

Accepted (2026-07-17)

## Context

The owner wants home-screen icons for the Sabah/Masaa adhkar that open the
mobile app directly on the matching reader (`/adhkar/<slug>`). The deep-link
routing already exists (azkar notification tap-router); only the launcher entry
point is missing.

## Options

1. **App shortcuts via `expo-quick-actions`** — long-press the launcher icon →
   items the user can pin to the home screen. Expo-maintained (Evan Bacon),
   dual-platform (Android ShortcutManager + iOS Quick Actions), ships an
   expo-router integration (`useQuickActionRouting`) that handles warm and
   cold-start taps, and a config plugin for shortcut icons.
2. Programmatic pinned shortcuts (`requestPinShortcut`) — most literal match,
   but no maintained Expo package exists; needs a custom native module and is
   Android-only.
3. Home-screen widget (`react-native-android-widget`) — heaviest by far,
   Android-only, native widget rendering.

## Decision

Option 1: `expo-quick-actions@6.0.2` (the SDK 56 pairing). Two dynamic items
(`sabah`, `masaa`) registered at runtime with Arabic titles and
`params.href` deep links; Android icon baked by the plugin from the existing
monochrome ن asset.

## Consequences

- New native module → rebuild-gated (dev client + preview build), never
  OTA-only; `version`/`versionCode` bumped per the OTA-isolation rule.
- Static Android actions are unsupported by the library, so items are set on
  app mount — shortcuts appear after the first launch of a build.
