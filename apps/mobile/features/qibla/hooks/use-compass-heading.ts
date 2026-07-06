// Compass heading for the Qibla screen, backed by the native `nour-compass` module
// (fused rotation-vector / CoreMotion true-north heading). Exposes the heading as a
// reanimated SharedValue that drives the dial rotation on the UI thread (GPU
// transform — no JS re-render per sample, so it's smooth like the web), plus a
// throttled `heading` state used only for the cheap "facing Qibla" text.

import { useCallback, useRef, useState } from "react";
import { useFocusEffect } from "expo-router";
import {
  Easing,
  useSharedValue,
  withTiming,
  type SharedValue,
} from "react-native-reanimated";

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
  const lastStateRef = useRef(0);

  const debugLogRef = useRef(0);

  const push = useCallback(
    (raw: number, magRaw?: number, accuracy?: number) => {
      // TEMP diagnostic (2026-07-06): investigating a reported fixed-offset
      // wrong-direction bug on the native compass. Throttled to ~1/s. Remove
      // once root-caused.
      const now0 = Date.now();
      if (now0 - debugLogRef.current > 1000) {
        debugLogRef.current = now0;
        console.warn(
          `[qibla-debug] trueHeading=${raw.toFixed(1)} magHeading=${magRaw?.toFixed(1)} accuracy=${accuracy} loc=${location.lat.toFixed(4)},${location.lng.toFixed(4)}`,
        );
      }
      // Drive the UI-thread rotation, unwrapped so withTiming eases along the short
      // arc instead of unwinding through the 0/360 seam.
      const prev = unwrappedRef.current;
      if (prev == null) {
        unwrappedRef.current = raw;
        headingSV.value = raw;
      } else {
        const next = prev + signedDelta(norm360(prev), raw);
        unwrappedRef.current = next;
        headingSV.value = withTiming(next, { duration: 120, easing: Easing.linear });
      }
      const now = Date.now();
      if (now - lastStateRef.current >= STATE_THROTTLE_MS) {
        lastStateRef.current = now;
        setHeading(norm360(raw));
      }
    },
    [headingSV, location.lat, location.lng],
  );

  useFocusEffect(
    useCallback(() => {
      if (!isNativeCompassAvailable()) return;
      unwrappedRef.current = null;
      lastStateRef.current = 0;
      setCompassLocation(location.lat, location.lng);
      const sub = addHeadingListener((h) => push(h.trueHeading, h.magHeading, h.accuracy));
      startCompass();
      return () => {
        sub?.remove();
        stopCompass();
      };
    }, [push, location.lat, location.lng]),
  );

  return { headingSV, heading, available };
}
