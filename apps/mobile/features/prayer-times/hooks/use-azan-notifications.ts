// Schedules local azan notifications with expo-notifications. Called whenever
// prayer settings change (reschedules the next 5 prayers on every change).
// Device-local only — no server/auth.

import { useEffect } from "react";
import * as Notifications from "expo-notifications";
import type { PrayerLocation, PrayerPreferences } from "@repo/shared-core/schemas/prayer-times";
import { computePrayerTimes, getNextPrayer } from "@repo/shared-core/prayer-times/compute";
import type { PrayerKey } from "@repo/shared-core/prayer-times/compute";

import { AZAN_PIECES, ensureAzanChannel } from "@/lib/notifications";

// Schedule the chained piece-notifications that make up one full adhan at
// `fireAt`. Piece 0 keeps the bare `nour-azan-{off}-{key}` id (the foreground
// listener matches only that, and plays the full streamed adhan once); later
// pieces get a `-p{n}` suffix so they don't double-trigger the foreground audio
// but still sound their clip closed-app.
async function scheduleAdhanPieces(baseId: string, title: string, fireAt: Date): Promise<void> {
  for (const piece of AZAN_PIECES) {
    const id = piece.offsetSec === 0 ? baseId : `${baseId}-p${piece.offsetSec}`;
    await Notifications.scheduleNotificationAsync({
      identifier: id,
      content: {
        title,
        body: "حان وقت الصلاة · It's time for prayer.",
        sound: piece.sound,
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: new Date(fireAt.getTime() + piece.offsetSec * 1000),
        channelId: piece.channelId,
      },
    });
  }
}

// Sunrise is a marker, not a prayer — skip notifications for it.
const NOTIF_TAG_PREFIX = "nour-azan-";

async function scheduleAzanNotifications(
  location: PrayerLocation,
  prefs: PrayerPreferences,
  prayerNames: Record<Exclude<PrayerKey, "sunrise">, string>,
): Promise<void> {
  // The Android channel must exist before any azan notification is posted.
  await ensureAzanChannel();

  // Cancel all previously scheduled azan notifications.
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  for (const notif of scheduled) {
    if (notif.identifier.startsWith(NOTIF_TAG_PREFIX)) {
      await Notifications.cancelScheduledNotificationAsync(notif.identifier);
    }
  }

  const now = new Date();
  const DAY_MS = 24 * 60 * 60 * 1000;

  // Schedule for today + tomorrow (covers the next ~48h so the user always has
  // upcoming notifications even if the app isn't opened daily).
  for (let dayOffset = 0; dayOffset <= 1; dayOffset++) {
    const date = new Date(now.getTime() + dayOffset * DAY_MS);
    const day = computePrayerTimes({
      lat: location.lat,
      lng: location.lng,
      date,
      method: prefs.method,
      madhab: prefs.madhab,
    });

    for (const instant of day.instants) {
      if (instant.key === "sunrise") continue;
      if (instant.time == null) continue;
      if (instant.time.getTime() <= now.getTime()) continue; // skip past times

      const key = instant.key as Exclude<PrayerKey, "sunrise">;
      const id = `${NOTIF_TAG_PREFIX}${dayOffset}-${key}`;
      await scheduleAdhanPieces(id, prayerNames[key], instant.time);
    }
  }
}

export function useAzanNotifications(
  enabled: boolean,
  location: PrayerLocation,
  prefs: PrayerPreferences,
  prayerNames: Record<Exclude<PrayerKey, "sunrise">, string>,
  hydrated: boolean,
): void {
  useEffect(() => {
    if (!hydrated) return;
    if (!enabled) {
      // Cancel all azan notifications.
      void Notifications.getAllScheduledNotificationsAsync().then((all) => {
        return Promise.all(
          all
            .filter((n) => n.identifier.startsWith(NOTIF_TAG_PREFIX))
            .map((n) => Notifications.cancelScheduledNotificationAsync(n.identifier)),
        );
      });
      return;
    }
    void scheduleAzanNotifications(location, prefs, prayerNames);
  }, [enabled, location, prefs, prayerNames, hydrated]);
}

// Dev/verify helper: schedule a single azan notification ~60s out so the user
// can lock the phone and confirm the adhan fires on time. It goes through the
// exact same DATE-trigger + channel + bundled-sound path as the real schedule,
// so it proves the exact-alarm fix end-to-end without waiting for a real prayer.
// Uses a high dayOffset (9) so the identifier never collides with a real
// scheduled prayer; the `dhuhr` key makes the foreground adhan play too.
export async function scheduleTestAzan(title: string): Promise<Date> {
  await ensureAzanChannel();
  const fireAt = new Date(Date.now() + 60 * 1000);
  await scheduleAdhanPieces(`${NOTIF_TAG_PREFIX}9-dhuhr`, title, fireAt);
  return fireAt;
}

// Utility: request notification permissions. Returns true if granted.
export async function requestNotificationPermission(): Promise<boolean> {
  const { status } = await Notifications.requestPermissionsAsync({
    ios: { allowAlert: true, allowSound: true, allowBadge: false },
  });
  return status === "granted";
}

// Keep the getNextPrayer re-export here so screens can use it without a
// separate import.
export { getNextPrayer };
