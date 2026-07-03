// Device compass heading for the Qibla screen. Mirrors the web use-device-heading
// hook, reading expo-sensors instead of DeviceOrientation.
//
// Sensor choice (in order of preference):
//   1. DeviceMotion.rotation.alpha — the OS sensor-fused, **tilt-compensated**
//      azimuth (Android rotation-vector / iOS attitude), so the heading stays
//      correct even when the phone isn't held flat. This is the mobile analogue of
//      the web's `deviceorientationabsolute`.
//   2. Magnetometer atan2(y,x) — raw horizontal-field fallback when DeviceMotion is
//      unavailable or yields no rotation (no gyro / rotation-vector). Only accurate
//      held level.
//
// Both feed a **circular EMA** (smoothing sin/cos, wrap-safe at the 0/360 seam) so
// the needle glides instead of snapping, with a small dead-band so a still phone
// doesn't re-render every frame. Heading is **magnetic** north (declination is not
// corrected — see docs/adr/0009-expo-sensors-qibla.md); native sensors only verify
// on hardware, matching the repo's standing on-device caveat.

import { useCallback, useRef, useState } from "react";
import { useFocusEffect } from "expo-router";
import {
  DeviceMotion,
  Magnetometer,
  type MagnetometerMeasurement,
} from "expo-sensors";

const RAD2DEG = 180 / Math.PI;
const norm360 = (deg: number): number => ((deg % 360) + 360) % 360;

// Smallest signed angular difference a→b, in (-180, 180].
function signedDelta(a: number, b: number): number {
  return ((b - a + 540) % 360) - 180;
}

// EMA weight per sample: higher tracks turns faster, lower is smoother. At ~60ms
// sampling, 0.3 removes jitter while still following a real turn within a few 100ms.
const SMOOTHING = 0.3;
// Re-render only when the smoothed heading has moved at least this many degrees —
// keeps the dial fluid without a render storm when the phone is still.
const MIN_DELTA = 0.5;
// If DeviceMotion is "available" but delivers no usable rotation this soon, fall
// back to the magnetometer (some devices lack the rotation-vector/gyro).
const MOTION_FALLBACK_MS = 700;

// DeviceMotion.rotation.alpha → compass heading. W3C convention (which Expo
// follows): alpha grows counter-clockwise from north, so the clockwise compass
// heading is 360 − alpha. If an on-device test shows the needle MIRRORED, flip this
// to `norm360(alphaDeg)` (the only likely platform discrepancy).
function motionHeading(alphaRad: number): number {
  return norm360(360 - alphaRad * RAD2DEG);
}

// Classic magnetometer reduction: atan2 of the horizontal field, 0 = magnetic north.
function magHeading({ x, y }: MagnetometerMeasurement): number {
  const rad = Math.atan2(y, x);
  return norm360((rad >= 0 ? rad : rad + 2 * Math.PI) * RAD2DEG);
}

export type MagnetometerHeading = {
  heading: number | null;
  available: boolean;
};

export function useMagnetometerHeading(): MagnetometerHeading {
  const [heading, setHeading] = useState<number | null>(null);
  const [available, setAvailable] = useState(false);
  // Circular EMA accumulators + the last value pushed to state.
  const emaRef = useRef<{ sin: number; cos: number } | null>(null);
  const emittedRef = useRef<number | null>(null);

  // Feed one raw heading into the smoother and emit the smoothed result.
  const push = useCallback((raw: number) => {
    const rad = raw / RAD2DEG;
    const s = Math.sin(rad);
    const c = Math.cos(rad);
    const prev = emaRef.current;
    const ema =
      prev == null
        ? { sin: s, cos: c }
        : {
            sin: prev.sin + SMOOTHING * (s - prev.sin),
            cos: prev.cos + SMOOTHING * (c - prev.cos),
          };
    emaRef.current = ema;
    const next = norm360(Math.atan2(ema.sin, ema.cos) * RAD2DEG);
    const last = emittedRef.current;
    if (last == null || Math.abs(signedDelta(last, next)) >= MIN_DELTA) {
      emittedRef.current = next;
      setHeading(next);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      let motionSub: ReturnType<typeof DeviceMotion.addListener> | null = null;
      let magSub: ReturnType<typeof Magnetometer.addListener> | null = null;
      let fallbackTimer: ReturnType<typeof setTimeout> | null = null;
      let switched = false;
      // Reset the smoother on (re)focus so a stale reading doesn't slew the needle.
      emaRef.current = null;
      emittedRef.current = null;

      const startMagnetometer = () => {
        if (cancelled || magSub) return;
        void Magnetometer.isAvailableAsync().then((ok) => {
          if (cancelled || !ok || magSub) return;
          setAvailable(true);
          Magnetometer.setUpdateInterval(60);
          magSub = Magnetometer.addListener((data) => push(magHeading(data)));
        });
      };

      const fallToMagnetometer = () => {
        if (switched) return;
        switched = true;
        motionSub?.remove();
        motionSub = null;
        // Reset the smoother so the two sensors' scales don't blend on handover.
        emaRef.current = null;
        emittedRef.current = null;
        startMagnetometer();
      };

      const start = async () => {
        const motionOk = await DeviceMotion.isAvailableAsync().catch(() => false);
        if (cancelled) return;
        if (!motionOk) {
          startMagnetometer();
          return;
        }
        // Give DeviceMotion a moment to produce a rotation; if it doesn't, the
        // device has no fused orientation → use the raw magnetometer instead.
        fallbackTimer = setTimeout(fallToMagnetometer, MOTION_FALLBACK_MS);
        DeviceMotion.setUpdateInterval(60);
        motionSub = DeviceMotion.addListener((data) => {
          const alpha = data.rotation?.alpha;
          if (alpha == null || Number.isNaN(alpha)) return;
          if (fallbackTimer) {
            clearTimeout(fallbackTimer);
            fallbackTimer = null;
          }
          setAvailable(true);
          push(motionHeading(alpha));
        });
      };
      void start();

      return () => {
        cancelled = true;
        if (fallbackTimer) clearTimeout(fallbackTimer);
        motionSub?.remove();
        magSub?.remove();
      };
    }, [push]),
  );

  return { heading, available };
}
