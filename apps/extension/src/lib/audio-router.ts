import type { AdhanPrayerKey } from "@repo/shared-core/schemas/prayer-times";

const SITE = __API_BASE_URL__;

// Fajr uses its own (gentler) adhan; every other prayer shares one clip. Served
// from the deployed site and fetched via host_permissions — see chrome-extension.md
// §4 (CORS is a non-issue for MV3 host-permission fetches). Step 9 layers a
// Cache API copy on top so playback works offline at prayer time.
export function adhanUrl(key: AdhanPrayerKey): string {
  return `${SITE}/audio/${key === "fajr" ? "adhan-fajr.mp3" : "adhan.mp3"}`;
}

// The single seam between the scheduler and the playback mechanism. Chrome plays
// with zero visible UI via an offscreen document; the Firefox branch (managed
// player tab) hooks in here in the deferred §7.4 phase.
//
// The offscreen-document implementation lands in the next step (chrome-extension.md
// §6 step 7). Until then this resolves without sound so the scheduler + the
// notification path (the reliability core) ship and verify on their own.
export async function playAdhan(key: AdhanPrayerKey, volume: number): Promise<void> {
  const url = adhanUrl(key);
  // TODO(step 7): ensure an offscreen document, post { url, volume }, and close
  // it on the playback `ended` message.
  console.warn(`[nour] adhan playback pending offscreen impl: ${url} @ vol ${volume}`);
}

export async function stop(): Promise<void> {
  // TODO(step 7): close the offscreen document to stop playback.
}
