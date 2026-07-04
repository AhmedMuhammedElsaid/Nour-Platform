# ADR 0010 — WebView-hosted Qibla compass (react-native-webview)

Status: accepted (2026-07-04)

## Context

The mobile Qibla compass went through three native sensor implementations, all of
which the user reported as a bad experience on-device:

1. Raw `expo-sensors` Magnetometer (`atan2`) — jittery, not tilt-compensated.
2. `DeviceMotion.rotation.alpha` — **not north-referenced on Android** (relative to
   app-start orientation) → the needle drifted ("disaster").
3. `expo-location` `watchHeadingAsync` — smooth after the render fix, but reported
   **`accuracy: 0`** (uncalibrated magnetometer). It uses a geomagnetic-only heading
   (no gyroscope fusion), so it is fragile to calibration/interference.

The rendering was also fixed along the way (rotating an rn-svg `<G>` re-drew ~30
nodes on the JS thread per sample; moved to a UI-thread transform).

Crucially: the **web `/qibla` page is smooth and accurate on the same device.** The
browser gets that from `deviceorientationabsolute`, backed by Android's fused
**rotation-vector** sensor (gyro + accelerometer + magnetometer). Expo does not
expose that fused absolute heading without a custom native module.

## Decision

Render the compass dial inside a **WebView** (`react-native-webview`) that runs the
same browser compass pipeline as the web page: `deviceorientationabsolute` /
`webkitCompassHeading` + a GPU `transform: rotate()`. Android System WebView is
Chromium, so it uses the identical DeviceOrientation implementation as the browser —
i.e. the compass that already works on the user's device.

- Self-contained inline HTML (`features/qibla/lib/compass-html.ts`) — no network, no
  site chrome; styled to match the app card (opaque background = `--color-surface`,
  so no Android transparency → no forced software layer).
- The great-circle bearing (true north) is computed natively and baked into the HTML.
- Heading/alignment are `postMessage`-d back to native (throttled) for the "facing
  Qibla" text and calibration nudge.

## Consequences

- **New dependency** `react-native-webview` (Expo-managed version) → requires **one
  native rebuild** (not OTA-able).
- iOS needs a user gesture to grant `DeviceOrientationEvent.requestPermission()` — the
  HTML calls it on first tap; Android needs no permission.
- The native `use-magnetometer-heading` hook is removed (superseded).
- This is the deterministic path to web parity: it reuses the exact engine the user
  confirmed works, instead of approximating it with native sensors.
