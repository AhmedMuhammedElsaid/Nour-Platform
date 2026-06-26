// JS bridge to the native `nour-adhan` Expo module (Android only). The module
// schedules ONE exact alarm per prayer that starts a native foreground service
// playing the full adhan — replacing the old 22-chained-notification scheme that
// exhausted Android's per-app allow-while-idle alarm quota (see
// modules/nour-adhan). On iOS the native module is absent, so every call here is a
// safe no-op and callers fall back to expo-notifications (a single ≤30s clip).

import { requireOptionalNativeModule } from "expo";

export type AdhanNativeItem = {
  key: string;
  fireAtMillis: number;
  fajr: boolean;
  volume: number;
};

type NourAdhanNativeModule = {
  scheduleAll(items: AdhanNativeItem[]): Promise<void>;
  cancelAll(): Promise<void>;
  playTest(delayMs: number): Promise<void>;
  stop(): Promise<void>;
};

const native = requireOptionalNativeModule<NourAdhanNativeModule>("NourAdhan");

// True only on a build that bundles the native module (Android dev-client / APK).
export function isNativeAdhanAvailable(): boolean {
  return native != null;
}

export async function scheduleAll(items: AdhanNativeItem[]): Promise<void> {
  await native?.scheduleAll(items);
}

export async function cancelAll(): Promise<void> {
  await native?.cancelAll();
}

export async function playTest(delayMs: number): Promise<void> {
  await native?.playTest(delayMs);
}

export async function stop(): Promise<void> {
  await native?.stop();
}
