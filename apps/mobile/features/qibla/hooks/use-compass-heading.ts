// Compass heading for the Qibla screen, backed by the native `nour-compass` module
// (fused rotation-vector / CoreMotion true-north heading). Exposes the heading as a
// reanimated SharedValue that drives the dial rotation on the UI thread (GPU
// transform — no JS re-render per sample, so it's smooth like the web), plus a
// throttled `heading` state used only for the cheap "facing Qibla" text.

import { useCallback, useRef, useState } from "react";
import { useFocusEffect } from "expo-router";
import { useSharedValue, type SharedValue } from "react-native-reanimated";

import {
  addHeadingListener,
  isNativeCompassAvailable,
  setCompassLocation,
  startCompass,
  stopCompass,
} from "@/lib/compass-native";

const norm360 = (deg: number): number => ((deg % 360) + 360) % 360;
// Smallest signed angular difference a→b, in (-180, 180].
function signedDelta(a: number, b: number): number {
  return ((b - a + 540) % 360) - 180;
}

const STATE_THROTTLE_MS = 150;
// Exponential moving average applied to the unwrapped heading. The native
// module streams at ~33Hz with real (small) sensor noise on top of genuine
// motion; assigning each raw sample straight to the SharedValue renders that
// noise directly (looks jittery/inaccurate even at rest). A per-sample
// withTiming() tween was tried first, but re-triggering a 120ms animation
// every ~30ms just made the value chase a perpetually-moving target instead —
// worse than either raw or smoothed. A plain EMA has no "animation in flight"
// to interrupt, so it settles cleanly while still damping noise.
const EMA_ALPHA = 0.3;

export type CompassHeading = {
  headingSV: SharedValue<number | null>;
  heading: number | null;
  available: boolean;
};

export function useCompassHeading(location: { lat: number; lng: number }): CompassHeading {
  const headingSV = useSharedValue<number | null>(null);
  const [heading, setHeading] = useState<number | null>(null);
  const [available] = useState(() => isNativeCompassAvailable());
  const unwrappedRef = useRef<number | null>(null);
  const smoothedRef = useRef<number | null>(null);
  const lastStateRef = useRef(0);

  const push = useCallback(
    (raw: number) => {
      // Unwrap so the smoothing (and the dial's transform) take the short arc
      // instead of unwinding through the 0/360 seam.
      const prevUnwrapped = unwrappedRef.current;
      const next =
        prevUnwrapped == null ? raw : prevUnwrapped + signedDelta(norm360(prevUnwrapped), raw);
      unwrappedRef.current = next;

      const prevSmoothed = smoothedRef.current;
      const smoothed = prevSmoothed == null ? next : prevSmoothed + EMA_ALPHA * (next - prevSmoothed);
      smoothedRef.current = smoothed;
      headingSV.value = smoothed;

      // TEMP diagnostic (2026-07-06 round 2): owner reports a fast spin
      // specifically right at the Qibla bearing while the phone was held
      // still — checking whether raw is unstable there (real local magnetic
      // interference at that specific room-relative direction) vs. the
      // smoothed/unwrapped value diverging from a clean raw signal (a bug in
      // the unwrap/EMA above). Remove once root-caused.
      console.warn(
        `[qibla-debug2] raw=${raw.toFixed(1)} unwrapped=${next.toFixed(1)} smoothed=${smoothed.toFixed(1)} smoothedNorm=${norm360(smoothed).toFixed(1)}`,
      );

      const now = Date.now();
      if (now - lastStateRef.current >= STATE_THROTTLE_MS) {
        lastStateRef.current = now;
        setHeading(norm360(smoothed));
      }
    },
    [headingSV],
  );

  useFocusEffect(
    useCallback(() => {
      if (!isNativeCompassAvailable()) return;
      unwrappedRef.current = null;
      smoothedRef.current = null;
      lastStateRef.current = 0;
      setCompassLocation(location.lat, location.lng);
      const sub = addHeadingListener((h) => push(h.trueHeading));
      startCompass();
      return () => {
        sub?.remove();
        stopCompass();
      };
    }, [push, location.lat, location.lng]),
  );

  return { headingSV, heading, available };
}
