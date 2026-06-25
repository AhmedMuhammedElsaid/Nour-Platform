import type { AdhanPrayerKey } from "@repo/shared-core/schemas/prayer-times";

import { OFFSCREEN_URL, type ToOffscreen } from "../offscreen/protocol";

const SITE = __API_BASE_URL__;

// Fajr uses its own (gentler) adhan; every other prayer shares one clip. Served
// from the deployed site and fetched via host_permissions — see chrome-extension.md
// §4 (CORS is a non-issue for MV3 host-permission fetches). Step 9 layers a
// Cache API copy on top so playback works offline at prayer time.
export function adhanUrl(key: AdhanPrayerKey): string {
  return `${SITE}/audio/${key === "fajr" ? "adhan-fajr.mp3" : "adhan.mp3"}`;
}

// Only one offscreen document may exist per extension. createDocument throws if
// one is already open or if two calls race, so guard with hasDocument() and a
// single in-flight promise. This is the single seam between the scheduler and
// the playback mechanism; the Firefox player-tab branch hooks in here (§7.4).
let creating: Promise<void> | null = null;

async function ensureOffscreen(): Promise<void> {
  if (await chrome.offscreen.hasDocument()) return;
  if (creating) {
    await creating;
    return;
  }
  creating = chrome.offscreen.createDocument({
    url: OFFSCREEN_URL,
    reasons: [chrome.offscreen.Reason.AUDIO_PLAYBACK],
    justification: "Play the adhan (call to prayer) at the scheduled prayer time.",
  });
  try {
    await creating;
  } finally {
    creating = null;
  }
}

async function post(message: ToOffscreen): Promise<void> {
  await chrome.runtime.sendMessage(message);
}

// Plays the adhan with no visible UI. The offscreen document reports back when
// playback ends so the background worker can close it (see background/index.ts).
export async function playAdhan(key: AdhanPrayerKey, volume: number): Promise<void> {
  await ensureOffscreen();
  await post({ target: "offscreen", type: "play", url: adhanUrl(key), volume });
}

export async function stop(): Promise<void> {
  if (await chrome.offscreen.hasDocument()) {
    await post({ target: "offscreen", type: "stop" });
  }
}
