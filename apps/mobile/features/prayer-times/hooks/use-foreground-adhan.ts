// Plays the FULL adhan when an azan notification fires while the app is open
// (point 13/15, foreground half). The audio is streamed from the web origin
// via expo-audio — no bundled asset, so this needs no rebuild. The closed-app
// case is covered by the scheduled notification's own sound. RNTP is reserved
// for the playlist queue, so we duck it (pause for the adhan, resume after)
// rather than clobbering its queue.

import { useCallback, useEffect, useRef, useState } from "react";
import { Platform } from "react-native";
import * as Notifications from "expo-notifications";
import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from "expo-audio";
import type { AdhanPrayerKey } from "@repo/shared-core/schemas/prayer-times";

import { assetUrl } from "@/lib/api";
import { usePlayer } from "@/lib/player-context";
import { useAdhanSettings } from "./use-adhan-settings";

const NOTIF_TAG_PREFIX = "nour-azan-";
// Fajr has the extra "as-salatu khayrun min an-nawm" line, so it is a separate
// recording (mirrors the web AdhanPlayer's two <audio> elements).
const REGULAR_ADHAN = "/audio/adhan.mp3";
const FAJR_ADHAN = "/audio/adhan-fajr.mp3";

// Scheduled identifiers are `nour-azan-{dayOffset}-{key}` (see
// use-azan-notifications.ts). Extract the prayer key, ignoring sunrise/unknown.
function prayerKeyFromIdentifier(id: string): AdhanPrayerKey | null {
  const key = /^nour-azan-\d+-([a-z]+)$/.exec(id)?.[1];
  if (
    key === "fajr" ||
    key === "dhuhr" ||
    key === "asr" ||
    key === "maghrib" ||
    key === "isha"
  ) {
    return key;
  }
  return null;
}

// Android's AdhanPlayerService shows a native "Stop" action on its ongoing
// notification (apps/mobile/modules/nour-adhan); iOS has no notification-button
// API for a foreground listener, so the stop control here is an in-app card
// (rendered by the caller from `activeKey`/`stop`) — see adhan-stop-card.tsx.
export function useForegroundAdhan(): {
  activeKey: AdhanPrayerKey | null;
  stop: () => void;
} {
  const { settings } = useAdhanSettings();
  const player = usePlayer();
  const [activeKey, setActiveKey] = useState<AdhanPrayerKey | null>(null);

  // Keep the latest settings + RNTP handle reachable from the stable listener.
  const settingsRef = useRef(settings);
  settingsRef.current = settings;
  const playerRef = useRef(player);
  playerRef.current = player;

  // One persistent adhan player, created on first fire. `duckedRef` records
  // whether WE paused the queue, so we only resume what we ducked.
  const adhanRef = useRef<AudioPlayer | null>(null);
  const duckedRef = useRef(false);

  // Shared teardown for both a natural finish and a manual stop — resumes
  // whatever WE ducked and clears the card. `player.pause()` (used by stop())
  // does not itself raise `didJustFinish`, so callers must invoke this.
  const finish = useCallback(() => {
    if (duckedRef.current) {
      duckedRef.current = false;
      playerRef.current.play();
    }
    setActiveKey(null);
  }, []);

  const stop = useCallback(() => {
    adhanRef.current?.pause();
    finish();
  }, [finish]);

  useEffect(() => {
    // Android adhan (foreground AND closed-app) is handled natively by the
    // nour-adhan foreground service (it requests audio focus, which ducks the
    // music queue), so this expo-audio path is iOS-only to avoid double playback.
    if (Platform.OS !== "ios") return;

    // Play even when the ringer is on silent (an azan is expected to sound).
    void setAudioModeAsync({ playsInSilentMode: true }).catch(() => {});

    const sub = Notifications.addNotificationReceivedListener((notification) => {
      const id = notification.request.identifier;
      if (!id.startsWith(NOTIF_TAG_PREFIX)) return;
      const key = prayerKeyFromIdentifier(id);
      if (key == null) return;

      const s = settingsRef.current;
      if (!s.enabled || !s.perPrayer[key]) return;

      if (adhanRef.current == null) {
        const p = createAudioPlayer(null);
        p.addListener("playbackStatusUpdate", (status) => {
          if (status.didJustFinish) finish();
        });
        adhanRef.current = p;
      }
      const adhan = adhanRef.current;

      // Duck the playlist queue for the adhan's duration.
      if (playerRef.current.isPlaying) {
        duckedRef.current = true;
        playerRef.current.pause();
      }

      adhan.replace({ uri: assetUrl(key === "fajr" ? FAJR_ADHAN : REGULAR_ADHAN) });
      adhan.volume = Math.min(1, Math.max(0, s.volume));
      adhan.play();
      setActiveKey(key);
    });

    return () => {
      sub.remove();
      adhanRef.current?.remove();
      adhanRef.current = null;
    };
  }, [finish]);

  return { activeKey, stop };
}
