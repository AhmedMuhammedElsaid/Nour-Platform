// Schedules the Friday Surah Al-Kahf reminder as ONE repeating WEEKLY local
// notification (Friday 12:00 local). Unlike the azkar DATE-pool horizon this
// never needs re-arming and costs a single iOS pending-notification slot.
// If device-verify ever shows Android dropping the weekly repeat, fall back to
// a small DATE pool of the next few Fridays (clone use-azkar-reminders.ts).
// Device-local only — no server.

import { useEffect } from "react";
import * as Notifications from "expo-notifications";

const KAHF_NOTIF_ID = "nour-kahf-weekly";

// expo-notifications weekday convention: 1 = Sunday … 6 = Friday, 7 = Saturday
// (NOT Date#getDay, where Friday is 5).
const FRIDAY_WEEKDAY = 6;

export type KahfReminderContent = { title: string; body: string };

async function cancelKahf(): Promise<void> {
  try {
    await Notifications.cancelScheduledNotificationAsync(KAHF_NOTIF_ID);
  } catch {
    /* nothing scheduled — non-fatal */
  }
}

async function scheduleKahf(content: KahfReminderContent): Promise<void> {
  await cancelKahf();
  await Notifications.scheduleNotificationAsync({
    identifier: KAHF_NOTIF_ID,
    content: {
      title: content.title,
      body: content.body,
      sound: true,
      data: { kind: "kahf-reminder" },
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
      weekday: FRIDAY_WEEKDAY,
      hour: 12,
      minute: 0,
    },
  });
}

const KAHF_TEST_NOTIF_ID = "nour-kahf-test";

// Dev/verify helper: fires the Kahf reminder ~60s out with the identical tap
// payload as the real weekly notification, so tap-through (→ Quran surah 18)
// can be confirmed without waiting for Friday 12:00. Mirrors scheduleTestAzan.
export async function scheduleTestKahf(content: KahfReminderContent): Promise<Date> {
  const fireAt = new Date(Date.now() + 60 * 1000);
  await Notifications.scheduleNotificationAsync({
    identifier: KAHF_TEST_NOTIF_ID,
    content: {
      title: content.title,
      body: content.body,
      sound: true,
      data: { kind: "kahf-reminder" },
    },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: fireAt },
  });
  return fireAt;
}

export function useKahfReminder(
  enabled: boolean,
  content: KahfReminderContent,
  hydrated: boolean,
): void {
  useEffect(() => {
    if (!hydrated) return;
    if (!enabled) {
      void cancelKahf();
      return;
    }
    void scheduleKahf(content).catch(() => {});
  }, [enabled, content, hydrated]);
}
