// Schedules the Azkar al-Sabah / al-Masaa reminders as local notifications.
// Mobile-native mirror of the web's azkar-reminder controller: sabah trails
// Fajr and masaa trails Asr by `offsetMinutes`. Uses expo-notifications (same
// engine as the azan hook) so the OS delivers them even when the app is closed
// — no separate foreground scheduler needed. Device-local only — no server.

import { useEffect } from "react";
import { Platform } from "react-native";
import * as Notifications from "expo-notifications";

import type {
  AzkarReminderSettings,
  PrayerLocation,
  PrayerPreferences,
} from "@repo/shared-core/schemas/prayer-times";
import { computePrayerTimes } from "@repo/shared-core/prayer-times/compute";

const NOTIF_TAG_PREFIX = "nour-azkar-";

// How many days ahead to schedule. The old ~48h horizon meant reminders stopped
// if the app wasn't opened for 2 days (same bug class as the adhan horizon bug).
// iOS shares a hard 64 pending-notification OS cap with the azan schedule, which
// reserves up to IOS_MAX_AZAN=40 (use-azan-notifications.ts) — 10 days × 2 kinds
// = 20 keeps the total at 60 < 64. Android has no comparable cap here (28 ≪ 500).
const HORIZON_DAYS = Platform.OS === "ios" ? 10 : 14;

export type AzkarReminderKind = "sabah" | "masaa";

// Resolved per-session reminder content (locale-aware reader slug + title/body).
export type AzkarReminderContent = Record<
  AzkarReminderKind,
  { title: string; body: string; slug: string }
>;

// sabah trails Fajr; masaa trails Asr.
const BASE_PRAYER: Record<AzkarReminderKind, "fajr" | "asr"> = {
  sabah: "fajr",
  masaa: "asr",
};

async function cancelAll(): Promise<void> {
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  await Promise.all(
    scheduled
      .filter((n) => n.identifier.startsWith(NOTIF_TAG_PREFIX))
      .map((n) => Notifications.cancelScheduledNotificationAsync(n.identifier)),
  );
}

async function scheduleAzkarReminders(
  location: PrayerLocation,
  prefs: PrayerPreferences,
  settings: AzkarReminderSettings,
  content: AzkarReminderContent,
): Promise<void> {
  await cancelAll();

  const now = new Date();
  const DAY_MS = 24 * 60 * 60 * 1000;
  const offsetMs = settings.offsetMinutes * 60_000;

  for (let dayOffset = 0; dayOffset < HORIZON_DAYS; dayOffset++) {
    const date = new Date(now.getTime() + dayOffset * DAY_MS);
    const day = computePrayerTimes({
      lat: location.lat,
      lng: location.lng,
      date,
      method: prefs.method,
      madhab: prefs.madhab,
    });

    for (const kind of ["sabah", "masaa"] as const) {
      const base = day.instants.find((i) => i.key === BASE_PRAYER[kind]);
      if (!base?.time) continue;
      const fireAt = new Date(base.time.getTime() + offsetMs);
      if (fireAt.getTime() <= now.getTime()) continue; // skip past times

      const c = content[kind];
      await Notifications.scheduleNotificationAsync({
        identifier: `${NOTIF_TAG_PREFIX}${dayOffset}-${kind}`,
        content: {
          title: c.title,
          body: c.body,
          sound: true,
          data: { kind: "azkar-reminder", slug: c.slug },
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: fireAt,
        },
      });
    }
  }
}

export function useAzkarReminders(
  enabled: boolean,
  location: PrayerLocation,
  prefs: PrayerPreferences,
  settings: AzkarReminderSettings,
  content: AzkarReminderContent,
  hydrated: boolean,
): void {
  useEffect(() => {
    if (!hydrated) return;
    if (!enabled) {
      void cancelAll();
      return;
    }
    void scheduleAzkarReminders(location, prefs, settings, content);
  }, [enabled, location, prefs, settings, content, hydrated]);
}
