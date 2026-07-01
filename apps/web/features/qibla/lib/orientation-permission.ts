// iOS Safari gates DeviceOrientation behind a permission that can only be
// granted from a user gesture (there is no way to request it on page load).
// We request it once, site-wide, on the first interaction — so by the time the
// user opens /qibla the compass is already live, with no tap needed on that page.
// On every other platform there is no gate and this is a no-op.

type DeviceOrientationEventCtor = typeof DeviceOrientationEvent & {
  requestPermission?: () => Promise<"granted" | "denied" | "default">;
};

let primed = false;

/** True only where the platform requires a user gesture to grant orientation. */
export function orientationNeedsGesture(): boolean {
  if (typeof window === "undefined" || !("DeviceOrientationEvent" in window)) {
    return false;
  }
  const ctor = window.DeviceOrientationEvent as DeviceOrientationEventCtor;
  return typeof ctor.requestPermission === "function";
}

/** Request the iOS orientation permission once. Must run inside a user gesture. */
export async function primeOrientationPermission(): Promise<void> {
  if (primed || typeof window === "undefined" || !("DeviceOrientationEvent" in window)) {
    return;
  }
  const ctor = window.DeviceOrientationEvent as DeviceOrientationEventCtor;
  if (typeof ctor.requestPermission !== "function") return;
  primed = true; // one prompt per session, regardless of the outcome
  try {
    await ctor.requestPermission();
  } catch {
    /* declined or unsupported — the compass stays in static-bearing mode */
  }
}
