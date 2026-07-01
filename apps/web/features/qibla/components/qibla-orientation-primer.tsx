"use client";

import { useEffect } from "react";

import {
  orientationNeedsGesture,
  primeOrientationPermission,
} from "../lib/orientation-permission";

// Headless island mounted site-wide (root layout, next to AdhanController). On
// iOS the DeviceOrientation permission can only be requested from a user gesture,
// so we prime it on the first interaction anywhere — the /qibla compass is then
// already granted when the user gets there and works with no tap on that page.
// No-op on platforms without the permission gate.
export function QiblaOrientationPrimer() {
  useEffect(() => {
    if (!orientationNeedsGesture()) return;
    const prime = () => void primeOrientationPermission();
    const opts = { once: true, passive: true } as const;
    window.addEventListener("pointerdown", prime, opts);
    window.addEventListener("keydown", prime, opts);
    return () => {
      window.removeEventListener("pointerdown", prime);
      window.removeEventListener("keydown", prime);
    };
  }, []);

  return null;
}
