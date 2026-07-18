// Routes reminder-notification taps to their reader screens, per `data.kind`:
// `azkar-reminder` (use-azkar-reminders.ts, carries a `slug`) → adhkar reader;
// `kahf-reminder` (use-kahf-reminder.ts) → Quran reader at Surah Al-Kahf.
// Covers warm/background taps (live listener) and cold starts (the launching tap
// is only delivered via getLastNotificationResponseAsync, not the listener).
// Azan taps are deliberately ignored (narrow `kind` checks) — extend per-kind if
// other notifications ever need routing.

import { useEffect, useRef } from "react";
import * as Notifications from "expo-notifications";
import { router } from "expo-router";

import { KAHF_SURAH } from "@repo/shared-core/prayer-times/schedule";

function hrefOf(
  response: Notifications.NotificationResponse,
): string | null {
  const data = response.notification.request.content.data as
    | Record<string, unknown>
    | null
    | undefined;
  if (!data) return null;
  if (data.kind === "kahf-reminder") return `/quran/${KAHF_SURAH}`;
  if (data.kind !== "azkar-reminder") return null;
  return typeof data.slug === "string" && data.slug
    ? `/adhkar/${encodeURIComponent(data.slug)}`
    : null;
}

// A response can arrive twice on cold start (listener + last-response replay).
// Key on identifier + delivery timestamp so the SAME delivery never navigates
// twice, while tomorrow's reminder (same identifier after a reschedule) does.
function responseKey(response: Notifications.NotificationResponse): string {
  return `${response.notification.request.identifier}:${response.notification.date}`;
}

export function useAzkarNotificationRouter(): void {
  const handledRef = useRef<string | null>(null);

  useEffect(() => {
    const handle = (response: Notifications.NotificationResponse) => {
      const href = hrefOf(response);
      if (!href) return;
      const key = responseKey(response);
      if (handledRef.current === key) return;
      handledRef.current = key;
      router.push(href);
    };

    const sub = Notifications.addNotificationResponseReceivedListener(handle);
    void Notifications.getLastNotificationResponseAsync().then((response) => {
      if (response) handle(response);
    });
    return () => sub.remove();
  }, []);
}
