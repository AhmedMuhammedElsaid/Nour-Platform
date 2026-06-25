import { ADHAN_CACHE_NAME } from "../lib/cache-manager";
import { type FromOffscreen, isToOffscreen } from "./protocol";

// Resolve a URL through the Cache API first so the adhan plays offline.
// Returns a blob URL (must be revoked after use) when cached; otherwise returns
// the original URL and lets the <audio> element fetch it directly.
async function resolveAudioSrc(
  url: string,
): Promise<{ src: string; blob: boolean }> {
  try {
    const cache = await caches.open(ADHAN_CACHE_NAME);
    const response = await cache.match(url);
    if (response) {
      const blob = await response.blob();
      return { src: URL.createObjectURL(blob), blob: true };
    }
  } catch {
    // Cache miss or unavailable — fall through to live URL.
  }
  return { src: url, blob: false };
}

const audio = new Audio();
let currentBlobUrl: string | null = null;

function revokeCurrentBlob(): void {
  if (currentBlobUrl) {
    URL.revokeObjectURL(currentBlobUrl);
    currentBlobUrl = null;
  }
}

chrome.runtime.onMessage.addListener((message: unknown) => {
  if (!isToOffscreen(message)) return;

  if (message.type === "play") {
    const { url, volume } = message;
    revokeCurrentBlob();
    void resolveAudioSrc(url).then(({ src, blob }) => {
      if (blob) currentBlobUrl = src;
      audio.src = src;
      audio.volume = Math.min(1, Math.max(0, volume));
      audio.currentTime = 0;
      void audio.play().catch((err: unknown) => {
        console.error("[nour offscreen] adhan play failed", err);
        revokeCurrentBlob();
        notifyEnded();
      });
    });
  } else {
    audio.pause();
    revokeCurrentBlob();
  }
});

audio.addEventListener("ended", () => {
  revokeCurrentBlob();
  notifyEnded();
});

function notifyEnded(): void {
  const msg: FromOffscreen = { target: "background", type: "audio-ended" };
  void chrome.runtime.sendMessage(msg).catch(() => {});
}
