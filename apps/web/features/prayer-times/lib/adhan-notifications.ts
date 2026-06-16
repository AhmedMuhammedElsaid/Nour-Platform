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

// Schedule the next ~48h of enabled adhans as triggered notifications. Passing
// today + tomorrow's instants (see AdhanController) means closed-tab delivery
// keeps working past the last prayer of today, instead of stopping until the
// user next opens the tab. Clears previously scheduled Nour adhan notifications
// first (idempotent). No-op (resolves) where triggers are unsupported or
// permission missing — those browsers (iOS Safari / Firefox) fall back to the
// foreground-only Layer A scheduler.
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

  // Walk forward through the enabled events, scheduling each. Cap at 10 (≤5
  // adhan prayers × 2 days).
  let cursor = new Date();
  for (let i = 0; i < 10; i++) {
    const event = nextAdhanEvent(instants, settings, cursor);
    if (!event) break;
    const TimestampTrigger = window.TimestampTrigger;
    if (!TimestampTrigger) break;
    // Date-suffix the tag so today's and tomorrow's same-named prayers don't
    // collide (showNotification replaces a notification sharing a tag).
    const day = event.time.toISOString().slice(0, 10);
    await reg.showNotification(labelFor(event.key), {
      tag: `${TAG_PREFIX}${event.key}-${day}`,
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
