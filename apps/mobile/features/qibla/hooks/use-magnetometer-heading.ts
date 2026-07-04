// Device compass heading for the Qibla screen — the mobile analogue of the web's
// use-device-heading (the browser's fused `deviceorientationabsolute`).
//
// Sensor source: expo-location `watchHeadingAsync` — the OS's fused,
// tilt-compensated, CALIBRATED compass (the same provider the platform gives the
// browser), returning `trueHeading` (already declination-corrected, so it matches
// the true-north Qibla bearing) with `magHeading` as a fallback. A raw magnetometer
// path covers the rare device where the heading provider is unavailable.
//
// **Why the rotation is a SharedValue, not state:** re-rendering the compass SVG on
// the JS thread on every heading sample was the real "slow" (the old <G rotation>
// re-drew ~30 SVG nodes per update). We instead drive the dial rotation with a
// reanimated shared value on the UI thread (GPU transform, like the web's CSS
// transform) — heading updates never re-render React. `heading` (state) is emitted
// only ~6×/s, purely for the cheap "facing Qibla" text.

import { useCallback, useRef, useState } from "react";
import { useFocusEffect } from "expo-router";
import * as Location from "expo-location";
import { Magnetometer, type MagnetometerMeasurement } from "expo-sensors";
import {
  Easing,
  useSharedValue,
  withTiming,
  type SharedValue,
} from "react-native-reanimated";

const RAD2DEG = 180 / Math.PI;
const norm360 = (deg: number): number => ((deg % 360) + 360) % 360;

// Smallest signed angular difference a→b, in (-180, 180].
function signedDelta(a: number, b: number): number {
  return ((b - a + 540) % 360) - 180;
}

// Throttle for the React `heading` state (the "facing Qibla" check). The smooth
// rotation is UI-thread and unthrottled; this is just to avoid needless re-renders.
const STATE_THROTTLE_MS = 150;

// Classic magnetometer reduction (fallback path): 0 = magnetic north.
function magHeading({ x, y }: MagnetometerMeasurement): number {
  const rad = Math.atan2(y, x);
  return norm360((rad >= 0 ? rad : rad + 2 * Math.PI) * RAD2DEG);
}

export type CompassHeading = {
  // Continuous (unwrapped) heading in degrees for the UI-thread dial rotation, or
  // null before the first reading. Unwrapped so the dial never spins the long way
  // around the 0/360 seam; eased with withTiming so it glides between samples.
  headingSV: SharedValue<number | null>;
  // Throttled 0–360 heading for the "facing Qibla" check (null until first read).
  heading: number | null;
  available: boolean;
};

export function useMagnetometerHeading(): CompassHeading {
  const headingSV = useSharedValue<number | null>(null);
  const [heading, setHeading] = useState<number | null>(null);
  const [available, setAvailable] = useState(false);
  const unwrappedRef = useRef<number | null>(null);
  const lastStateRef = useRef(0);

  const push = useCallback(
    (raw: number) => {
      // Drive the UI-thread rotation. Unwrap against the last continuous value so
      // withTiming eases along the short arc instead of unwinding through 0/360.
      const prev = unwrappedRef.current;
      if (prev == null) {
        unwrappedRef.current = raw;
        headingSV.value = raw; // snap the first reading
      } else {
        const next = prev + signedDelta(norm360(prev), raw);
        unwrappedRef.current = next;
        headingSV.value = withTiming(next, { duration: 150, easing: Easing.linear });
      }
      // Emit the throttled state used only by the "facing Qibla" text.
      const now = Date.now();
      if (now - lastStateRef.current >= STATE_THROTTLE_MS) {
        lastStateRef.current = now;
        setHeading(raw);
      }
    },
    [headingSV],
  );

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      let headingSub: Location.LocationSubscription | null = null;
      let magSub: ReturnType<typeof Magnetometer.addListener> | null = null;
      unwrappedRef.current = null;
      lastStateRef.current = 0;

      const startMagnetometer = () => {
        if (cancelled || magSub) return;
        void Magnetometer.isAvailableAsync().then((ok) => {
          if (cancelled || !ok || magSub) return;
          setAvailable(true);
          Magnetometer.setUpdateInterval(60);
          magSub = Magnetometer.addListener((data) => push(magHeading(data)));
        });
      };

      void (async () => {
        try {
          const sub = await Location.watchHeadingAsync((h) => {
            // Prefer trueHeading (declination-corrected); fall back to magHeading
            // when true north isn't available yet (no fix / accuracy -1).
            const raw =
              typeof h.trueHeading === "number" && h.trueHeading >= 0
                ? h.trueHeading
                : h.magHeading;
            if (typeof raw !== "number" || raw < 0) return;
            setAvailable(true);
            push(raw);
          });
          if (cancelled) {
            sub.remove();
            return;
          }
          headingSub = sub;
        } catch {
          if (!cancelled) startMagnetometer();
        }
      })();

      return () => {
        cancelled = true;
        headingSub?.remove();
        magSub?.remove();
      };
    }, [push]),
  );

  return { headingSV, heading, available };
}
