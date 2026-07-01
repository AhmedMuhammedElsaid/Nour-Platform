// iOS Safari gates DeviceOrientation behind a permission that can only be
// granted from a user gesture — there is no way to request it on page load.
// So the /qibla page shows an explicit "Enable compass" button and calls
// `requestOrientationPermission` from that tap. On every other platform there
// is no gate and the sensor streams immediately.

type DeviceOrientationEventCtor = typeof DeviceOrientationEvent & {
  requestPermission?: () => Promise<"granted" | "denied" | "default">;
};

/** True only where the platform requires a user gesture to grant orientation. */
export function orientationNeedsGesture(): boolean {
  if (typeof window === "undefined" || !("DeviceOrientationEvent" in window)) {
    return false;
  }
  const ctor = window.DeviceOrientationEvent as DeviceOrientationEventCtor;
  return typeof ctor.requestPermission === "function";
}

/**
 * Request the iOS orientation permission. MUST be invoked synchronously from a
 * user gesture (the Enable-compass button's click). Safe to call repeatedly:
 * once granted iOS resolves "granted" without re-prompting; once denied it
 * resolves "denied" and the user must re-enable it in Settings.
 */
export async function requestOrientationPermission(): Promise<
  "granted" | "denied" | "unsupported"
> {
  if (typeof window === "undefined" || !("DeviceOrientationEvent" in window)) {
    return "unsupported";
  }
  const ctor = window.DeviceOrientationEvent as DeviceOrientationEventCtor;
  if (typeof ctor.requestPermission !== "function") return "unsupported";
  try {
    const res = await ctor.requestPermission();
    return res === "granted" ? "granted" : "denied";
  } catch {
    return "denied";
  }
}
