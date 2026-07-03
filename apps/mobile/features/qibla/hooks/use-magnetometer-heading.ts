// Device compass heading from the magnetometer. Mirrors the web use-device-heading
// hook, but reads expo-sensors instead of DeviceOrientation.
//
// The magnetometer reports **magnetic** north (geomagnetic declination is not
// corrected — see docs/adr/0009-expo-sensors-qibla.md); the exact axis offset is
// device-specific and only verifiable on hardware, matching the repo's standing
// "native sensors verify on-device" caveat.
//
// Raw magnetometer samples are noisy and arrive in bursts, which made the dial feel
// jittery and slow (it only updated past a coarse 2° step). We now sample faster and
// run a **circular exponential moving average** on the heading's sin/cos so the value
// glides smoothly toward the true bearing without the wrap-around artefacts a plain
// numeric average would produce at the 0/360 seam. A small dead-band on the smoothed
// output keeps a still phone from re-rendering every frame.

import { useCallback, useRef, useState } from "react";
import { useFocusEffect } from "expo-router";
import { Magnetometer, type MagnetometerMeasurement } from "expo-sensors";

const RAD2DEG = 180 / Math.PI;
const norm360 = (deg: number): number => ((deg % 360) + 360) % 360;

// Smallest signed angular difference a→b, in (-180, 180].
function signedDelta(a: number, b: number): number {
  return ((b - a + 540) % 360) - 180;
}

// EMA weight applied each sample: higher tracks turns faster, lower is smoother.
// At a 60ms sample interval, 0.3 removes jitter while still following a real turn
// within a few hundred ms.
const SMOOTHING = 0.3;
// Re-render only when the smoothed heading has moved at least this many degrees —
// enough to keep the dial fluid without a render storm when the phone is still.
const MIN_DELTA = 0.5;

// Classic expo-sensors compass reduction: atan2 of the horizontal field, normalized
// to a 0–360 heading where 0 = magnetic north.
function toHeading({ x, y }: MagnetometerMeasurement): number {
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
  // Circular EMA accumulators + the last value we pushed to state.
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
      let sub: ReturnType<typeof Magnetometer.addListener> | null = null;
      // Reset the smoother each time the screen regains focus so a stale reading
      // from a previous visit doesn't slew the needle on re-entry.
      emaRef.current = null;
      emittedRef.current = null;

      void Magnetometer.isAvailableAsync().then((ok) => {
        if (cancelled || !ok) return;
        setAvailable(true);
        // 60ms (~16Hz): responsive enough that the smoothed dial reads as a live
        // glide, cheap enough for the handful of SVG nodes on the compass.
        Magnetometer.setUpdateInterval(60);
        sub = Magnetometer.addListener((data) => push(toHeading(data)));
      });

      return () => {
        cancelled = true;
        sub?.remove();
      };
    }, [push]),
  );

  return { heading, available };
}
