export const ADHAN_CACHE_NAME = "nour:cache-adhan";
const SITE = __API_BASE_URL__;

// The two adhan assets served from the deployed site. Fajr has its own softer
// recording; every other prayer uses the shared clip.
export const ADHAN_ASSET_URLS = [
  `${SITE}/audio/adhan.mp3`,
  `${SITE}/audio/adhan-fajr.mp3`,
] as const;

// Fetches both audio files into the Cache API so playback works offline.
// Idempotent — skips files already present. Called on install and when the user
// enables adhan for the first time. Non-fatal: a failure here only means the
// offline fallback is unavailable; the live URL still plays if the device is online.
export async function warmAdhanCache(): Promise<void> {
  try {
    const cache = await caches.open(ADHAN_CACHE_NAME);
    await Promise.all(
      ADHAN_ASSET_URLS.map(async (url) => {
        const hit = await cache.match(url);
        if (!hit) await cache.add(url);
      }),
    );
  } catch (err) {
    console.warn("[nour] adhan cache warm failed", err);
  }
}
