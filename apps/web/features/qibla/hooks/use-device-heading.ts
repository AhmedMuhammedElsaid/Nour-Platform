"use client";

import { useCallback, useEffect, useState } from "react";

// The DOM lib doesn't type iOS Safari's `webkitCompassHeading` (already
// true-north referenced, degrees clockwise). Declared here rather than via an
// `any` cast (CLAUDE.md §4). The iOS permission itself is requested site-wide on
// the first gesture by <QiblaOrientationPrimer>, so this hook only listens.
type CompassEvent = DeviceOrientationEvent & {
  webkitCompassHeading?: number;
};

const norm360 = (deg: number): number => ((deg % 360) + 360) % 360;

export type DeviceHeading = {
  /** Live magnetic/true heading in degrees [0,360), or null when no reading. */
  heading: number | null;
  /** Device exposes an orientation API at all (hide the compass otherwise). */
  supported: boolean;
};

/**
 * Subscribes to device orientation and reports a compass heading. Prefers iOS's
 * true-north `webkitCompassHeading`; falls back to the absolute `alpha` (with a
 * screen-rotation adjustment) on Android/desktop sensors. `heading` stays null
 * until a real reading arrives, so callers render a static fallback meanwhile.
 *
 * Listeners are attached on mount. On iOS they start delivering once permission
 * has been granted (primed on the first site interaction — see
 * orientation-permission.ts); on Android/desktop they fire immediately.
 */
export function useDeviceHeading(): DeviceHeading {
  const [heading, setHeading] = useState<number | null>(null);
  const [supported, setSupported] = useState(false);

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
    // `deviceorientationabsolute` gives true/magnetic north on Chromium; iOS
    // only fires `deviceorientation` but populates webkitCompassHeading there.
    window.addEventListener("deviceorientationabsolute", handle);
    window.addEventListener("deviceorientation", handle);
    return () => {
      window.removeEventListener("deviceorientationabsolute", handle);
      window.removeEventListener("deviceorientation", handle);
    };
  }, [handle]);

  return { heading, supported };
}
