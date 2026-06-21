// App-wide expo-notifications setup: a foreground presentation handler and the
// Android azan channel. Imported once for its side-effect (the handler) from
// app/_layout.tsx; `ensureAzanChannel()` is awaited before scheduling.

import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

// Samsung (and several OEMs) truncate a notification sound to ~7s, so a single
// long adhan clip is cut off closed-app. We instead split the FULL adhan
// (~127s, apps/web/public/audio/adhan.mp3) into PART_SEC-second pieces and fire
// one notification per piece, each on its OWN channel (the channel sound is
// fixed at creation, so each piece needs its own channel), chained one after
// another `offsetSec` apart — they play sequentially, in order, reconstructing
// the whole adhan. PART_COUNT/PART_SEC must match the wavs generated in
// assets/audio (adhan_part_1.wav … adhan_part_22.wav, 6s cuts).
const PART_SEC = 6;
const PART_COUNT = 22;
export const AZAN_PIECES = Array.from({ length: PART_COUNT }, (_, i) => ({
  channelId: `azan_part_${i + 1}`,
  sound: `adhan_part_${i + 1}.wav`,
  offsetSec: i * PART_SEC,
}));

// Part 1's channel/sound is the canonical azan channel (used by the foreground
// suppress check and the test helper); the rest only carry later parts.
export const AZAN_CHANNEL_ID = "azan_part_1";
export const AZAN_SOUND = "adhan_part_1.wav";
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
// The channel sound is fixed at creation (API 26+), so we create one channel
// per adhan piece, each bound to its own clip. Changing a clip later requires
// recreating its channel.
export async function ensureAzanChannel(): Promise<void> {
  if (Platform.OS !== "android") return;
  for (const [i, piece] of AZAN_PIECES.entries()) {
    await Notifications.setNotificationChannelAsync(piece.channelId, {
      name: `Adhan part ${i + 1}`,
      // Only part 1 heads-up; the rest still play their sound but don't peek,
      // so the adhan plays through without 22 banners popping in a row.
      importance:
        i === 0
          ? Notifications.AndroidImportance.HIGH
          : Notifications.AndroidImportance.DEFAULT,
      sound: piece.sound,
    });
  }
}
