// App-wide expo-notifications setup: a foreground presentation handler and the
// Android azan channel. Imported once for its side-effect (the handler) from
// app/_layout.tsx; `ensureAzanChannel()` is awaited before scheduling.

import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

export const AZAN_CHANNEL_ID = "azan";
const AZAN_PREFIX = "nour-azan-";

// Decide how a notification presents while the app is foregrounded. Azan
// notifications are handled by the in-app audio engine (the full adhan plays
// via useForegroundAdhan), so we suppress the short notification sound for them
// to avoid doubling up; everything else (azkar reminders) plays its sound.
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

// Android needs an explicit high-importance channel for the azan to heads-up.
// Sound is the system default for now; swap to the bundled short adhan clip
// once that asset is registered via the app.json expo-notifications plugin.
export async function ensureAzanChannel(): Promise<void> {
  if (Platform.OS !== "android") return;
  await Notifications.setNotificationChannelAsync(AZAN_CHANNEL_ID, {
    name: "Adhan",
    importance: Notifications.AndroidImportance.HIGH,
    sound: "default",
  });
}
