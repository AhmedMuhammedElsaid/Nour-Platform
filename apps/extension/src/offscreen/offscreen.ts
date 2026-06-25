import { ADHAN_CACHE_NAME } from "../lib/cache-manager";
import {
  EMPTY_CORE,
  currentItem,
  reducePlayer,
  type PlayerCommand,
  type PlayerCore,
  type PlayerState,
  type QueueItem,
} from "../lib/player-state";
import { get, set } from "../lib/storage";
import {
  PLAYER_LIVE_KEY,
  type FromOffscreen,
  isToOffscreen,
} from "./protocol";

// ── Adhan (priority) audio ──────────────────────────────────────────────────
// A dedicated element so the call to prayer always takes precedence over music.

const adhanAudio = new Audio();
let adhanBlobUrl: string | null = null;

// Resolve the adhan URL through the Cache API first (offline playback), falling
// back to the live URL. Only the adhan is cached; player tracks stream live.
async function resolveAdhanSrc(url: string): Promise<{ src: string; blob: boolean }> {
  try {
    const cache = await caches.open(ADHAN_CACHE_NAME);
    const response = await cache.match(url);
    if (response) {
      const blob = await response.blob();
      return { src: URL.createObjectURL(blob), blob: true };
    }
  } catch {
    // Cache miss/unavailable — fall through to the live URL.
  }
  return { src: url, blob: false };
}

function revokeAdhanBlob(): void {
  if (adhanBlobUrl) {
    URL.revokeObjectURL(adhanBlobUrl);
    adhanBlobUrl = null;
  }
}

// ── Player audio ────────────────────────────────────────────────────────────

const playerAudio = new Audio();
let core: PlayerCore = EMPTY_CORE;
let pendingSeekSec: number | null = null;
let lastPersistAt = 0;

// When the adhan interrupts active playback we pause music and remember to
// resume it once the adhan finishes.
let resumeAfterAdhan = false;

// ── Message handling ────────────────────────────────────────────────────────

chrome.runtime.onMessage.addListener((message: unknown) => {
  if (!isToOffscreen(message)) return;

  switch (message.type) {
    case "adhan-play": {
      resumeAfterAdhan = core.status === "playing";
      if (resumeAfterAdhan) playerAudio.pause();
      void playAdhan(message.url, message.volume);
      break;
    }
    case "adhan-stop": {
      adhanAudio.pause();
      revokeAdhanBlob();
      break;
    }
    case "player": {
      void applyCommand(message.command);
      break;
    }
  }
});

async function playAdhan(url: string, volume: number): Promise<void> {
  revokeAdhanBlob();
  const { src, blob } = await resolveAdhanSrc(url);
  if (blob) adhanBlobUrl = src;
  adhanAudio.src = src;
  adhanAudio.volume = Math.min(1, Math.max(0, volume));
  adhanAudio.currentTime = 0;
  try {
    await adhanAudio.play();
  } catch (err) {
    console.error("[nour offscreen] adhan play failed", err);
    revokeAdhanBlob();
    finishAdhan();
  }
}

adhanAudio.addEventListener("ended", finishAdhan);

function finishAdhan(): void {
  revokeAdhanBlob();
  const resumed = resumeAfterAdhan;
  if (resumed) {
    void playerAudio.play().catch(() => {});
    resumeAfterAdhan = false;
  }
  const msg: FromOffscreen = {
    target: "background",
    type: "adhan-ended",
    resumedPlayer: resumed,
  };
  void chrome.runtime.sendMessage(msg).catch(() => {});
}

// ── Player command application ──────────────────────────────────────────────

async function applyCommand(command: PlayerCommand): Promise<void> {
  if (command.type === "seek") {
    if (Number.isFinite(playerAudio.duration)) {
      playerAudio.currentTime = command.positionSec;
      await persistPosition();
    }
    broadcast();
    return;
  }

  const prev = core;
  core = reducePlayer(core, command);
  await syncAudio(prev, core);
  broadcast();
}

// Diff the structural state and drive the audio element to match.
async function syncAudio(prev: PlayerCore, next: PlayerCore): Promise<void> {
  const prevItem = currentItem(prev);
  const nextItem = currentItem(next);

  if (nextItem === null) {
    if (prevItem) await persistPosition(prevItem.id);
    playerAudio.pause();
    playerAudio.removeAttribute("src");
    playerAudio.load();
    setMediaSession(null, "none");
    return;
  }

  const trackChanged = prevItem?.id !== nextItem.id;
  if (trackChanged) {
    if (prevItem) await persistPosition(prevItem.id);
    playerAudio.src = nextItem.url;
    // Restore the saved resume position once metadata arrives (setting
    // currentTime before the element knows its duration is ignored).
    pendingSeekSec = await loadSavedPosition(nextItem.id);
    setMediaSession(nextItem, next.status === "playing" ? "playing" : "paused");
  }

  if (next.status === "playing") {
    void playerAudio.play().catch(() => {});
    setPlaybackState("playing");
  } else {
    playerAudio.pause();
    setPlaybackState("paused");
  }
}

playerAudio.addEventListener("loadedmetadata", () => {
  if (pendingSeekSec != null && pendingSeekSec > 0 && pendingSeekSec < playerAudio.duration) {
    playerAudio.currentTime = pendingSeekSec;
  }
  pendingSeekSec = null;
  broadcast();
});

// Auto-advance to the next track when one finishes.
playerAudio.addEventListener("ended", () => {
  void applyCommand({ type: "next" });
});

playerAudio.addEventListener("timeupdate", () => {
  const now = Date.now();
  // Persist the resume position at most every 5s; broadcast the lighter UI
  // update every tick (the listeners throttle their own renders).
  if (now - lastPersistAt > 5_000) {
    lastPersistAt = now;
    void persistPosition();
  }
  broadcast();
});

// ── Resume positions (persistent, survives browser restart) ─────────────────

async function loadSavedPosition(id: string): Promise<number> {
  const positions = await get("nour.player.positions");
  return positions[id]?.t ?? 0;
}

async function persistPosition(id?: string): Promise<void> {
  const item = id != null ? { id } : currentItem(core);
  if (!item) return;
  const t = playerAudio.currentTime;
  if (!Number.isFinite(t)) return;
  const positions = await get("nour.player.positions");
  positions[item.id] = { t };
  await set("nour.player.positions", positions);
}

// ── Media Session (lock-screen / media-key control) ─────────────────────────

function setMediaSession(item: QueueItem | null, state: MediaSessionPlaybackState): void {
  if (!("mediaSession" in navigator)) return;
  navigator.mediaSession.metadata =
    item == null
      ? null
      : new MediaMetadata({
          title: item.title,
          artist: item.artist ?? "نور",
          artwork: item.artwork ? [{ src: item.artwork, sizes: "512x512" }] : [],
        });
  navigator.mediaSession.playbackState = state;
}

function setPlaybackState(state: MediaSessionPlaybackState): void {
  if ("mediaSession" in navigator) navigator.mediaSession.playbackState = state;
}

if ("mediaSession" in navigator) {
  navigator.mediaSession.setActionHandler("play", () => void applyCommand({ type: "toggle" }));
  navigator.mediaSession.setActionHandler("pause", () => void applyCommand({ type: "toggle" }));
  navigator.mediaSession.setActionHandler("nexttrack", () => void applyCommand({ type: "next" }));
  navigator.mediaSession.setActionHandler("previoustrack", () => void applyCommand({ type: "prev" }));
  navigator.mediaSession.setActionHandler("seekto", (details) => {
    if (details.seekTime != null) void applyCommand({ type: "seek", positionSec: details.seekTime });
  });
}

// ── Broadcast live state ────────────────────────────────────────────────────

let lastBroadcastAt = 0;

function broadcast(): void {
  const state: PlayerState = {
    ...core,
    positionSec: Number.isFinite(playerAudio.currentTime) ? playerAudio.currentTime : 0,
    durationSec: Number.isFinite(playerAudio.duration) ? playerAudio.duration : 0,
  };
  // Mirror to session storage so a newly-opened UI can render immediately.
  void chrome.storage.session.set({ [PLAYER_LIVE_KEY]: state }).catch(() => {});
  // Throttle the runtime broadcast to ~4/sec — timeupdate fires faster.
  const now = Date.now();
  if (now - lastBroadcastAt < 250) return;
  lastBroadcastAt = now;
  const msg: FromOffscreen = { target: "ui", type: "player-state", state };
  void chrome.runtime.sendMessage(msg).catch(() => {});
}
