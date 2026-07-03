// Device compass heading for the Qibla screen — the mobile analogue of the web's
// use-device-heading (which reads the browser's fused `deviceorientationabsolute` /
// `webkitCompassHeading`).
//
// Sensor source (in order of preference):
//   1. expo-location `watchHeadingAsync` — the OS's **fused, tilt-compensated,
//      calibrated** compass, the same provider the platform gives the browser. It
//      returns `trueHeading` (already **declination-corrected**, so it matches the
//      true-north Qibla bearing) and `magHeading`. This is what makes the compass
//      smooth + accurate; the earlier raw-magnetometer / DeviceMotion attempts were
//      not north-referenced on Android (DeviceMotion.rotation is relative there),
//      which is what made the needle drift.
//   2. Raw magnetometer atan2(y,x) — fallback only if the heading provider is
//      unavailable. Magnetic north, not tilt-compensated.
//
// A light circular EMA (smoothing sin/cos, wrap-safe at the 0/360 seam) trims any
// residual jitter, with a small dead-band so a still phone doesn't re-render every
// frame. Native sensors only verify on hardware (repo's standing on-device caveat).

import { useCallback, useRef, useState } from "react";
import { useFocusEffect } from "expo-router";
import * as Location from "expo-location";
import { Magnetometer, type MagnetometerMeasurement } from "expo-sensors";

const RAD2DEG = 180 / Math.PI;
const norm360 = (deg: number): number => ((deg % 360) + 360) % 360;

// Smallest signed angular difference a→b, in (-180, 180].
function signedDelta(a: number, b: number): number {
  return ((b - a + 540) % 360) - 180;
}

// Light EMA — the OS heading is already smoothed, so this only trims residual
// jitter without adding noticeable lag.
const SMOOTHING = 0.4;
// Re-render only when the smoothed heading has moved at least this many degrees.
const MIN_DELTA = 0.5;

// Classic magnetometer reduction (fallback path): 0 = magnetic north.
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
      let headingSub: Location.LocationSubscription | null = null;
      let magSub: ReturnType<typeof Magnetometer.addListener> | null = null;
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

      void (async () => {
        try {
          const sub = await Location.watchHeadingAsync((h) => {
            // Prefer trueHeading (declination-corrected → matches the true-north
            // Qibla bearing); fall back to magHeading when true north isn't
            // available yet (no location fix / accuracy -1).
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
          // Heading provider unavailable (rare) — fall back to the raw magnetometer.
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

  return { heading, available };
}
