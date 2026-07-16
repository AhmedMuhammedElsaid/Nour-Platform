// Routes an azkar-reminder notification tap to the adhkar reader. The reminders
// (use-azkar-reminders.ts) carry `data: { kind: "azkar-reminder", slug }`; this
// hook is the missing receiving end — without it a tap just opens the app.
// Covers warm/background taps (live listener) and cold starts (the launching tap
// is only delivered via getLastNotificationResponseAsync, not the listener).
// Azan taps are deliberately ignored (narrow `kind` check) — extend per-kind if
// other notifications ever need routing.

import { useEffect, useRef } from "react";
import * as Notifications from "expo-notifications";
import { router } from "expo-router";

function azkarSlugOf(
  response: Notifications.NotificationResponse,
): string | null {
  const data = response.notification.request.content.data as
    | Record<string, unknown>
    | null
    | undefined;
  if (!data || data.kind !== "azkar-reminder") return null;
  return typeof data.slug === "string" && data.slug ? data.slug : null;
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
      const slug = azkarSlugOf(response);
      if (!slug) return;
      const key = responseKey(response);
      if (handledRef.current === key) return;
      handledRef.current = key;
      router.push(`/adhkar/${encodeURIComponent(slug)}`);
    };

    const sub = Notifications.addNotificationResponseReceivedListener(handle);
    void Notifications.getLastNotificationResponseAsync().then((response) => {
      if (response) handle(response);
    });
    return () => sub.remove();
  }, []);
}
