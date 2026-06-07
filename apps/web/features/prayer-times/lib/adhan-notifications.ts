import type { AdhanSettings } from "@repo/api/schemas/prayer-times";
import type { PrayerInstant } from "@repo/api/services/prayer-times";

import { nextAdhanEvent } from "./adhan-schedule";

const TAG_PREFIX = "nour-adhan-";

// `showTrigger` / TimestampTrigger are experimental (Chromium-only). Feature-
// detect so iOS/Firefox degrade silently to foreground-only (Layer A).
function triggersSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    "Notification" in window &&
    "showTrigger" in Notification.prototype
  );
}

declare global {
  // Minimal ambient decls for the experimental API (not in lib.dom yet).
  interface Window {
    TimestampTrigger?: new (timestamp: number) => unknown;
  }
  // `includeTriggered` (still-pending scheduled notifications) and `showTrigger`
  // are part of the experimental Notification Triggers proposal, absent from
  // lib.dom — declared here so we avoid unsafe casts at the call sites.
  interface GetNotificationOptions {
    includeTriggered?: boolean;
  }
  interface NotificationOptions {
    showTrigger?: unknown;
  }
}

export async function requestAdhanPermission(): Promise<boolean> {
  if (typeof Notification === "undefined") return false;
  if (Notification.permission === "granted") return true;
  const result = await Notification.requestPermission();
  return result === "granted";
}

// Schedule today's remaining enabled adhans as triggered notifications.
// Clears previously scheduled Nour adhan notifications first (idempotent).
// No-op (resolves) where triggers are unsupported or permission missing.
export async function scheduleAdhanNotifications(
  instants: PrayerInstant[],
  settings: AdhanSettings,
  labelFor: (key: string) => string,
): Promise<void> {
  if (!triggersSupported()) return;
  if (typeof Notification === "undefined" || Notification.permission !== "granted") {
    return;
  }
  const reg = await navigator.serviceWorker?.ready;
  if (!reg) return;

  // Clear stale scheduled adhan notifications.
  const existing = await reg.getNotifications({ includeTriggered: true });
  for (const n of existing) {
    if (n.tag?.startsWith(TAG_PREFIX)) n.close();
  }

  // Walk forward through today's enabled events, scheduling each.
  const now = new Date();
  let cursor = now;
  // Cap to remaining prayers in the day (max 5).
  for (let i = 0; i < 5; i++) {
    const event = nextAdhanEvent(instants, settings, cursor);
    if (!event) break;
    const TimestampTrigger = window.TimestampTrigger;
    if (!TimestampTrigger) break;
    await reg.showNotification(labelFor(event.key), {
      tag: `${TAG_PREFIX}${event.key}`,
      body: labelFor("adhan.adhanBody"),
      icon: "/android-chrome-192x192.png",
      badge: "/favicon-32x32.png",
      data: { adhanKey: event.key },
      silent: false,
      showTrigger: new TimestampTrigger(event.time.getTime()),
    });
    cursor = new Date(event.time.getTime() + 1_000);
  }
}
