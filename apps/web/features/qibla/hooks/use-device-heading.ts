"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// The DOM lib doesn't type the non-standard bits we rely on: iOS Safari exposes
// `webkitCompassHeading` (already true-north referenced, degrees clockwise) and
// gates orientation behind a `requestPermission()` that must be called from a
// user gesture. Declared here rather than via `any` casts (CLAUDE.md §4).
type CompassEvent = DeviceOrientationEvent & {
  webkitCompassHeading?: number;
};
type DeviceOrientationEventCtor = typeof DeviceOrientationEvent & {
  requestPermission?: () => Promise<"granted" | "denied" | "default">;
};

const norm360 = (deg: number): number => ((deg % 360) + 360) % 360;

export type DeviceHeading = {
  /** Live magnetic/true heading in degrees [0,360), or null when no reading. */
  heading: number | null;
  /** Device exposes an orientation API at all (hide the compass otherwise). */
  supported: boolean;
  /** iOS-style explicit permission is required before a reading can arrive. */
  needsPermission: boolean;
  /** Prompt for permission + start listening. Must be called from a gesture. */
  request: () => Promise<void>;
};

/**
 * Subscribes to device orientation and reports a compass heading. Prefers iOS's
 * true-north `webkitCompassHeading`; falls back to the absolute `alpha` (with a
 * screen-rotation adjustment) on Android/desktop sensors. `heading` stays null
 * until a real reading arrives, so callers render a static fallback meanwhile.
 */
export function useDeviceHeading(): DeviceHeading {
  const [heading, setHeading] = useState<number | null>(null);
  const [supported, setSupported] = useState(false);
  const [needsPermission, setNeedsPermission] = useState(false);
  const listeningRef = useRef(false);

  const handle = useCallback((event: DeviceOrientationEvent) => {
    const e = event as CompassEvent;
    if (typeof e.webkitCompassHeading === "number") {
      setHeading(norm360(e.webkitCompassHeading));
      return;
    }
    if (e.absolute && typeof e.alpha === "number") {
      // alpha is measured counter-clockwise from north; a compass heading is
      // clockwise, hence 360 - alpha. Add the screen angle so landscape holds
      // still point the right way.
      const screenAngle =
        typeof screen !== "undefined" && screen.orientation
          ? screen.orientation.angle
          : 0;
      setHeading(norm360(360 - e.alpha + screenAngle));
    }
  }, []);

  const startListening = useCallback(() => {
    if (listeningRef.current) return;
    listeningRef.current = true;
    // `deviceorientationabsolute` gives true/magnetic north on Chromium; iOS
    // only fires `deviceorientation` but populates webkitCompassHeading there.
    window.addEventListener("deviceorientationabsolute", handle);
    window.addEventListener("deviceorientation", handle);
  }, [handle]);

  useEffect(() => {
    if (typeof window === "undefined" || !("DeviceOrientationEvent" in window)) {
      return;
    }
    setSupported(true);
    const ctor = window.DeviceOrientationEvent as DeviceOrientationEventCtor;
    if (typeof ctor.requestPermission === "function") {
      // iOS: wait for the explicit user-gesture grant via request().
      setNeedsPermission(true);
      return;
    }
    startListening();
    return () => {
      window.removeEventListener("deviceorientationabsolute", handle);
      window.removeEventListener("deviceorientation", handle);
      listeningRef.current = false;
    };
  }, [handle, startListening]);

  const request = useCallback(async () => {
    if (typeof window === "undefined" || !("DeviceOrientationEvent" in window)) {
      return;
    }
    const ctor = window.DeviceOrientationEvent as DeviceOrientationEventCtor;
    if (typeof ctor.requestPermission === "function") {
      try {
        const result = await ctor.requestPermission();
        if (result !== "granted") return;
      } catch {
        return;
      }
    }
    setNeedsPermission(false);
    startListening();
  }, [startListening]);

  return { heading, supported, needsPermission, request };
}
