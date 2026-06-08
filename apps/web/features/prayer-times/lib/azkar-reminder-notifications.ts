import type { AzkarReminderSettings } from "@repo/api/schemas/prayer-times";
import type { PrayerInstant } from "@repo/api/services/prayer-times";

import {
  type AzkarReminderEvent,
  type AzkarReminderKind,
  nextAzkarReminderEvent,
} from "./azkar-reminder-schedule";

const TAG_PREFIX = "nour-azkar-";

// Reminder content for one session, resolved by the caller (locale-aware slug
// → reader URL, plus translated title/body).
export type AzkarReminderContent = { url: string; title: string; body: string };
export type AzkarReminderBuilder = (kind: AzkarReminderKind) => AzkarReminderContent;

// `showTrigger` / TimestampTrigger are experimental (Chromium-only); the
// ambient decls live in adhan-notifications.ts (same build → globally visible).
function triggersSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    "Notification" in window &&
    "showTrigger" in Notification.prototype
  );
}

function notify(reg: ServiceWorkerRegistration, kind: AzkarReminderKind, c: AzkarReminderContent, trigger?: unknown) {
  return reg.showNotification(c.title, {
    tag: `${TAG_PREFIX}${kind}`, // same tag de-dupes a foreground+trigger overlap
    body: c.body,
    icon: "/android-chrome-192x192.png",
    badge: "/favicon-32x32.png",
    data: { kind: "azkar-reminder", url: c.url },
    ...(trigger ? { showTrigger: trigger } : {}),
  });
}

// Foreground: show the reminder immediately when the scheduler fires.
export async function showAzkarReminderNotification(
  event: AzkarReminderEvent,
  build: AzkarReminderBuilder,
): Promise<void> {
  if (typeof Notification === "undefined" || Notification.permission !== "granted") return;
  const reg = await navigator.serviceWorker?.ready;
  if (!reg) return;
  await notify(reg, event.kind, build(event.kind));
}

// Background (best-effort): schedule today's remaining reminders as triggered
// notifications. No-op where triggers/permission are unavailable. Idempotent.
export async function scheduleAzkarReminders(
  instants: PrayerInstant[],
  settings: AzkarReminderSettings,
  build: AzkarReminderBuilder,
): Promise<void> {
  if (!triggersSupported()) return;
  if (typeof Notification === "undefined" || Notification.permission !== "granted") return;
  const reg = await navigator.serviceWorker?.ready;
  if (!reg) return;

  const existing = await reg.getNotifications({ includeTriggered: true });
  for (const n of existing) {
    if (n.tag?.startsWith(TAG_PREFIX)) n.close();
  }

  const now = new Date();
  let cursor = now;
  for (let i = 0; i < 2; i++) {
    const event = nextAzkarReminderEvent(instants, settings, cursor);
    if (!event) break;
    const TimestampTrigger = window.TimestampTrigger;
    if (!TimestampTrigger) break;
    await notify(reg, event.kind, build(event.kind), new TimestampTrigger(event.time.getTime()));
    cursor = new Date(event.time.getTime() + 1_000);
  }
}
