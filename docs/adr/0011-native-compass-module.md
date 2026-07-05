# ADR 0011 — Native compass module (nour-compass), supersedes ADR 0010

Status: accepted (2026-07-05). **Supersedes ADR 0010 (WebView compass).**

## Context

ADR 0010 hosted the compass in a WebView to reuse the browser's fused sensor. On the
device it **failed to load** (`react-native-webview@13.16.1` on React Native 0.85 /
New Architecture / bridgeless is unreliable). Reverted.

The reason the browser is smooth + accurate is the platform **fused rotation-vector**
sensor — gyroscope + accelerometer + magnetometer — which is tilt-compensated and
does not suffer the raw magnetometer's "accuracy 0". Expo's JS APIs do not expose it:
`Magnetometer` is raw, `DeviceMotion.rotation` is relative on Android,
`Location.watchHeadingAsync` is geomagnetic-only. The app already ships a local Expo
native module (`modules/nour-adhan`), so the infrastructure exists.

## Decision

Add a local Expo native module `modules/nour-compass` that reads the fused sensor and
streams heading events to JS:

- **Android** (`NourCompassModule.kt`): `SensorManager` `TYPE_ROTATION_VECTOR` →
  `getRotationMatrixFromVector` → `getOrientation` → azimuth. `GeomagneticField`
  adds declination so `trueHeading` is true north. Emits `onHeading` (~33 Hz).
- **iOS** (`NourCompassModule.swift`): `CMMotionManager` device motion with the
  `.xTrueNorthZVertical` reference frame → `motion.heading` (fused, declination-
  corrected). Falls back to magnetic north if true north is unavailable.

JS bridge `lib/compass-native.ts` (`requireOptionalNativeModule`, safe no-op when the
module is absent). Hook `use-compass-heading.ts` feeds the heading into a reanimated
SharedValue that rotates the SVG dial on the UI thread (GPU transform — the render
fix from earlier is kept). `react-native-webview` removed.

## Consequences

- **Rebuild-gated** — a native module needs `eas build`, not OTA. When absent
  (OTA/stripped build) `isNativeCompassAvailable()` is false and the dial shows the
  static north-up fallback (no crash).
- Kotlin/Swift only compile in a native build; not covered by `expo export`/jest.
  Android azimuth assumes the phone is held roughly flat (standard Qibla-compass use).
- iOS true-north needs location services (already granted for prayer times); iOS is
  currently never built, so that path is unverified (as with the iOS adhan work).
- This is the correct native path — it reads the exact fused sensor the browser uses.
