# ADR 0009: `expo-sensors` (magnetometer) for the mobile Qibla compass

- Status: Accepted
- Date: 2026-07-01

## Context
The Qibla feature shows the compass bearing to the Kaaba. The bearing itself is
a pure great-circle calculation (`@repo/shared-core/qibla/compute`) from the
device location already stored for prayer times — no dependency needed. But the
"live compass" experience (a needle that points at the Kaaba as you physically
turn) requires the device's **heading**, which comes from the magnetometer.

On the web this is `DeviceOrientationEvent` (already available, no dependency).
On React Native there is no core magnetometer API; Expo exposes it through
`expo-sensors`, which was bundled transitively but not declared in
`apps/mobile/package.json`.

## Decision
Add **`expo-sensors`** (`~56.0.6`, the Expo-SDK-56-pinned version via
`npx expo install`). `apps/mobile/features/qibla/hooks/use-magnetometer-heading.ts`
subscribes to `Magnetometer` (100 ms interval, unsubscribed on screen blur via
`useFocusEffect`) and reduces `{x, y}` to a 0–360° heading. When the sensor is
unavailable the hook reports `available: false` and the screen falls back to a
static bearing dial.

The heading is treated as **magnetic** north. Geomagnetic **declination**
correction (WMM) is intentionally deferred: it adds a model/data dependency for a
small offset, and common Qibla apps ship magnetic headings. The UI notes the
device-calibration step ("move in a figure-8"), and the accuracy caveat is
recorded here.

## Alternatives considered
- **Static bearing only, no sensor** — no dependency, works everywhere, but loses
  the point-and-turn compass most users expect from a Qibla feature.
- **A custom native magnetometer module** — more native code to maintain versus a
  first-party Expo package that already normalizes the sensor across platforms.
- **Declination-corrected true north now** — better accuracy, but needs a WMM
  table/library and only matters at the margin; deferred as a follow-up.

## Consequences
- One first-party Expo native module added; it ships in the next EAS build (native
  sensor behaviour is only verifiable on a physical device, per the repo's
  standing caveat).
- The live compass reports magnetic north; a future release may add WMM
  declination correction and switch the readout to true north.
- No new Android/iOS permission is required for the magnetometer.
