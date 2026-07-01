"use client";

import { useCallback, useEffect, useState } from "react";

import {
  orientationNeedsGesture,
  requestOrientationPermission,
} from "../lib/orientation-permission";

// The DOM lib doesn't type iOS Safari's `webkitCompassHeading` (already
// true-north referenced, degrees clockwise). Declared here rather than via an
// `any` cast (CLAUDE.md §4).
type CompassEvent = DeviceOrientationEvent & {
  webkitCompassHeading?: number;
};

const norm360 = (deg: number): number => ((deg % 360) + 360) % 360;

export type DeviceHeading = {
  /** Live magnetic/true heading in degrees [0,360), or null when no reading. */
  heading: number | null;
  /** Device exposes an orientation API at all (hide the compass otherwise). */
  supported: boolean;
  /** iOS only: gate not yet satisfied — show the Enable-compass button. */
  needsPermission: boolean;
  /** Request iOS motion permission from a user gesture; resolves the outcome. */
  requestPermission: () => Promise<"granted" | "denied" | "unsupported">;
};

/**
 * Subscribes to device orientation and reports a compass heading. Prefers iOS's
 * true-north `webkitCompassHeading`; falls back to the absolute `alpha` (with a
 * screen-rotation adjustment) on Android/desktop sensors. `heading` stays null
 * until a real reading arrives, so callers render a static fallback meanwhile.
 *
 * Listeners are attached on mount. On iOS they start delivering only after the
 * user grants motion access via the Enable-compass button (see
 * orientation-permission.ts); on Android/desktop they fire immediately.
 */
export function useDeviceHeading(): DeviceHeading {
  const [heading, setHeading] = useState<number | null>(null);
  const [supported, setSupported] = useState(false);
  // Whether iOS's permission gate is present (only known client-side).
  const [gated, setGated] = useState(false);

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

  useEffect(() => {
    if (typeof window === "undefined" || !("DeviceOrientationEvent" in window)) {
      return;
    }
    setSupported(true);
    setGated(orientationNeedsGesture());
    // `deviceorientationabsolute` gives true/magnetic north on Chromium; iOS
    // only fires `deviceorientation` but populates webkitCompassHeading there.
    window.addEventListener("deviceorientationabsolute", handle);
    window.addEventListener("deviceorientation", handle);
    return () => {
      window.removeEventListener("deviceorientationabsolute", handle);
      window.removeEventListener("deviceorientation", handle);
    };
  }, [handle]);

  const requestPermission = useCallback(async () => {
    const res = await requestOrientationPermission();
    // Granted (or no gate at all): drop the gate so the button hides and the
    // listeners' incoming readings take over. Denied: keep the button visible.
    if (res !== "denied") setGated(false);
    return res;
  }, []);

  // Show the Enable button only where iOS gates the sensor and no reading has
  // arrived yet; once a heading streams in it hides on its own.
  const needsPermission = gated && heading == null;

  return { heading, supported, needsPermission, requestPermission };
}
