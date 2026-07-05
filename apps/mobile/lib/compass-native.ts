// JS bridge to the native `nour-compass` Expo module. It streams the fused
// rotation-vector heading (Android) / CoreMotion true-north heading (iOS) — the same
// sensor the browser uses — so the Qibla compass is smooth AND accurate, unlike the
// JS expo-sensors/expo-location paths (raw magnetometer "accuracy 0"). The module is
// only present in a native build; on a stripped/OTA build every call is a safe no-op
// and `isNativeCompassAvailable()` is false (the screen shows the static fallback).

import { requireOptionalNativeModule } from "expo";

// Minimal event-subscription shape (expo-modules-core's EventSubscription) — typed
// locally so this file doesn't need a direct dependency on expo-modules-core.
export type HeadingSubscription = { remove: () => void };

export type NativeHeading = {
  // Heading to true north (declination-corrected) — matches the Qibla bearing.
  trueHeading: number;
  // Heading to magnetic north.
  magHeading: number;
  // Sensor accuracy (Android SensorManager 0–3; iOS reports 3).
  accuracy: number;
};

type NourCompassModule = {
  isAvailable(): boolean;
  setLocation(lat: number, lng: number): void;
  start(): void;
  stop(): void;
  addListener(event: "onHeading", listener: (h: NativeHeading) => void): HeadingSubscription;
};

const native = requireOptionalNativeModule<NourCompassModule>("NourCompass");

export function isNativeCompassAvailable(): boolean {
  if (native == null) return false;
  try {
    return native.isAvailable();
  } catch {
    return false;
  }
}

export function setCompassLocation(lat: number, lng: number): void {
  try {
    native?.setLocation(lat, lng);
  } catch {
    // Ignore — declination just stays 0 (magnetic north).
  }
}

export function startCompass(): void {
  native?.start();
}

export function stopCompass(): void {
  native?.stop();
}

export function addHeadingListener(
  cb: (h: NativeHeading) => void,
): HeadingSubscription | null {
  return native ? native.addListener("onHeading", cb) : null;
}
