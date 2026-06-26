// App-wide expo-notifications setup: the foreground presentation handler.
// Imported once for its side-effect (the handler) from app/_layout.tsx.
//
// Android adhan no longer goes through expo-notifications — it's handled natively
// by the `nour-adhan` module (exact alarm → foreground service → full adhan), so
// there is no Android azan channel here anymore. iOS still uses a single
// notification per prayer with a ≤30s bundled clip (IOS_AZAN_SOUND), the platform
// ceiling for a closed-app local-notification sound.

import * as Notifications from "expo-notifications";

// Single short adhan clip used as the iOS notification sound (≤30s — Apple's limit).
// Bundled via app.json `expo-notifications.sounds`.
export const IOS_AZAN_SOUND = "adhan_notify.wav";

// Shared identifier prefix for every azan notification/alarm.
export const AZAN_PREFIX = "nour-azan-";

// Decide how a notification presents while the app is foregrounded. Azan
// notifications (iOS) are handled by the in-app audio engine (useForegroundAdhan
// streams the full adhan), so we suppress the short notification sound for them to
// avoid doubling up; everything else (azkar reminders) plays its sound.
Notifications.setNotificationHandler({
  handleNotification: async (notification) => {
    const isAzan = notification.request.identifier.startsWith(AZAN_PREFIX);
    return {
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: !isAzan,
      shouldSetBadge: false,
    };
  },
});
