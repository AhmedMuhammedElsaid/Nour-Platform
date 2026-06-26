// Shared audio engine for Chrome (offscreen doc) and Firefox (player tab).
// Imported as a side-effect module — calling `import "../lib/audio-engine"`
// sets up all event listeners and message routing.

import browser from "webextension-polyfill";

import { ADHAN_CACHE_NAME } from "./cache-manager";
import {
  EMPTY_CORE,
  currentItem,
  reducePlayer,
  type PlayerCommand,
  type PlayerCore,
  type PlayerState,
  type QueueItem,
} from "./player-state";
import { get, set } from "./storage";
import { PLAYER_LIVE_KEY, type FromOffscreen, isToOffscreen } from "../offscreen/protocol";

// ── Adhan (priority) ────────────────────────────────────────────────────────

const adhanAudio = new Audio();
let adhanBlobUrl: string | null = null;

async function resolveAdhanSrc(url: string): Promise<{ src: string; blob: boolean }> {
  try {
    const cache = await caches.open(ADHAN_CACHE_NAME);
    const response = await cache.match(url);
    if (response) {
      const blob = await response.blob();
      return { src: URL.createObjectURL(blob), blob: true };
    }
  } catch {
    // Cache miss — fall through to the live URL.
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
let resumeAfterAdhan = false;

// ── Message handling ────────────────────────────────────────────────────────

browser.runtime.onMessage.addListener((message: unknown) => {
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
    console.error("[nour player] adhan play failed", err);
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
  void browser.runtime.sendMessage(msg).catch(() => {});
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

playerAudio.addEventListener("ended", () => {
  void applyCommand({ type: "next" });
});

playerAudio.addEventListener("timeupdate", () => {
  const now = Date.now();
  if (now - lastPersistAt > 5_000) {
    lastPersistAt = now;
    void persistPosition();
  }
  broadcast();
});

// ── Resume positions ────────────────────────────────────────────────────────

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

// ── Media Session ───────────────────────────────────────────────────────────

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
  void browser.storage.session.set({ [PLAYER_LIVE_KEY]: state }).catch(() => {});
  const now = Date.now();
  if (now - lastBroadcastAt < 250) return;
  lastBroadcastAt = now;
  const msg: FromOffscreen = { target: "ui", type: "player-state", state };
  void browser.runtime.sendMessage(msg).catch(() => {});
}
