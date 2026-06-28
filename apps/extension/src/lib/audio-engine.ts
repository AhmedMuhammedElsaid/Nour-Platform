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
import { get, set } from "./engine-storage";
import { type FromOffscreen, isToOffscreen } from "../offscreen/protocol";

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

// Engine-owned live values (not part of the structural core) — broadcast to the
// UI and (rate/volume) persisted to nour.player.prefs.
let playbackRate = 1;
let volume = 1;
let sleepTimerEndsAt: number | null = null;
let sleepAtTrackEnd = false;
let sleepTimeoutId: ReturnType<typeof setTimeout> | null = null;
let sleepFadeId: ReturnType<typeof setInterval> | null = null;
let isBuffering = false;
let errorMessage: string | null = null;

// Restore persisted prefs on startup so the first queue load honours the user's
// shuffle/repeat and the audio element starts at the saved rate/volume.
async function hydratePrefs(): Promise<void> {
  const prefs = await get("nour.player.prefs");
  playbackRate = prefs.playbackRate;
  volume = prefs.volume;
  playerAudio.playbackRate = playbackRate;
  playerAudio.volume = volume;
  core = { ...core, shuffle: prefs.shuffle, repeat: prefs.repeat };
  broadcast();
}

async function persistPrefs(): Promise<void> {
  await set("nour.player.prefs", {
    shuffle: core.shuffle,
    repeat: core.repeat,
    playbackRate,
    volume,
  });
}

void hydratePrefs();

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
  // Engine-only commands — no structural change; act on the audio element directly.
  switch (command.type) {
    case "seek": {
      if (Number.isFinite(playerAudio.duration)) {
        playerAudio.currentTime = command.positionSec;
        await persistPosition();
      }
      broadcast();
      return;
    }
    case "setRate": {
      playbackRate = command.rate > 0 ? command.rate : 1;
      playerAudio.playbackRate = playbackRate;
      await persistPrefs();
      broadcast();
      return;
    }
    case "setVolume": {
      volume = Math.min(1, Math.max(0, command.volume));
      playerAudio.volume = volume;
      await persistPrefs();
      broadcast();
      return;
    }
    case "setSleepTimer": {
      applySleepTimer(command.option);
      broadcast();
      return;
    }
    case "retry": {
      retryCurrent();
      return;
    }
  }

  const prev = core;
  core = reducePlayer(core, command);

  // `prev` at the first track restarts it (the reducer keeps the same index).
  if (command.type === "prev" && prev.index === core.index && Number.isFinite(playerAudio.duration)) {
    playerAudio.currentTime = 0;
  }
  if (command.type === "toggleShuffle" || command.type === "cycleRepeat") {
    await persistPrefs();
  }

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
    // volume persists across src changes; playbackRate can reset on a new source,
    // so re-apply both after swapping the src.
    playerAudio.volume = volume;
    playerAudio.playbackRate = playbackRate;
    errorMessage = null;
    pendingSeekSec = await loadSavedPosition(nextItem.id);
    setMediaSession(nextItem, next.status === "playing" ? "playing" : "paused");
    await recordTrackRecent(nextItem);
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
  // Some browsers reset playbackRate when a new source loads — re-assert it.
  playerAudio.playbackRate = playbackRate;
  if (pendingSeekSec != null && pendingSeekSec > 0 && pendingSeekSec < playerAudio.duration) {
    playerAudio.currentTime = pendingSeekSec;
  }
  pendingSeekSec = null;
  broadcast();
});

playerAudio.addEventListener("ended", () => {
  // Priority: end-of-track sleep timer → repeat-one replay → advance.
  if (sleepAtTrackEnd) {
    clearSleep();
    const prev = core;
    core = { ...core, status: "stopped" };
    void syncAudio(prev, core);
    broadcast();
    return;
  }
  if (core.repeat === "one" && currentItem(core)) {
    playerAudio.currentTime = 0;
    void playerAudio.play().catch(() => {});
    return;
  }
  void applyCommand({ type: "next" });
});

// ── Buffering / error state ─────────────────────────────────────────────────

playerAudio.addEventListener("waiting", () => {
  isBuffering = true;
  broadcast();
});
playerAudio.addEventListener("playing", () => {
  isBuffering = false;
  errorMessage = null;
  broadcast();
});
playerAudio.addEventListener("canplay", () => {
  isBuffering = false;
  broadcast();
});
playerAudio.addEventListener("error", () => {
  isBuffering = false;
  errorMessage = "تعذّر تشغيل هذا المقطع.";
  broadcast();
});

function retryCurrent(): void {
  const item = currentItem(core);
  if (!item) return;
  errorMessage = null;
  isBuffering = true;
  playerAudio.src = item.url;
  playerAudio.volume = volume;
  playerAudio.playbackRate = playbackRate;
  playerAudio.load();
  void playerAudio.play().catch(() => {});
  broadcast();
}

// ── Sleep timer ─────────────────────────────────────────────────────────────

function clearSleep(): void {
  if (sleepTimeoutId != null) {
    clearTimeout(sleepTimeoutId);
    sleepTimeoutId = null;
  }
  if (sleepFadeId != null) {
    clearInterval(sleepFadeId);
    sleepFadeId = null;
  }
  sleepTimerEndsAt = null;
  sleepAtTrackEnd = false;
}

function applySleepTimer(option: number | "end-of-track" | null): void {
  clearSleep();
  if (option === null) return;
  if (option === "end-of-track") {
    sleepAtTrackEnd = true;
    return;
  }
  const ms = option * 60_000;
  sleepTimerEndsAt = Date.now() + ms;
  sleepTimeoutId = setTimeout(fadeOutAndPause, ms);
}

// 3s linear fade to silence, pause, then restore the user's volume so the next
// manual play isn't muted.
function fadeOutAndPause(): void {
  if (sleepFadeId != null) clearInterval(sleepFadeId);
  const startVol = playerAudio.volume;
  const steps = 30;
  let i = 0;
  sleepFadeId = setInterval(() => {
    i++;
    playerAudio.volume = Math.max(0, startVol * (1 - i / steps));
    if (i >= steps) {
      if (sleepFadeId != null) clearInterval(sleepFadeId);
      sleepFadeId = null;
      playerAudio.pause();
      playerAudio.volume = volume;
      if (core.status === "playing") core = { ...core, status: "paused" };
      setPlaybackState("paused");
      clearSleep();
      broadcast();
    }
  }, 100);
}

// ── Per-track recents (continue-listening source) ───────────────────────────

// Writes an MRU per-track recent (deduped by playlist slug, ≤20) so the
// continue-listening shelf can show a cover + resume bar. Guarded on `slug`:
// queue items without one (current code path) are skipped until later phases
// populate it.
async function recordTrackRecent(item: QueueItem): Promise<void> {
  if (!item.slug) return;
  const entry = {
    slug: item.slug,
    title: item.artist ?? item.title,
    type: "playlist" as const,
    trackId: item.id,
    cover: item.artwork,
    playlistTitle: item.artist,
    durationSecs: item.durationSecs,
  };
  const list = await get("nour.player.recent");
  const next = [entry, ...list.filter((r) => r.slug !== entry.slug)].slice(0, 20);
  await set("nour.player.recent", next);
}

playerAudio.addEventListener("timeupdate", () => {
  const now = Date.now();
  if (now - lastPersistAt > 5_000) {
    lastPersistAt = now;
    void persistPosition();
  }
  // High-frequency position tick — throttled. State-change broadcasts elsewhere
  // are NOT throttled so play/pause/track changes reach the UI immediately.
  broadcast(false);
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

// `force` (default) sends immediately — used for every state change (play/pause,
// track switch, seek, rate/volume, errors) so the UI updates without delay. The
// timeupdate position tick passes `force = false` to throttle to 250ms.
function broadcast(force = true): void {
  const now = Date.now();
  if (!force && now - lastBroadcastAt < 250) return;
  lastBroadcastAt = now;
  const state: PlayerState = {
    ...core,
    positionSec: Number.isFinite(playerAudio.currentTime) ? playerAudio.currentTime : 0,
    durationSec: Number.isFinite(playerAudio.duration) ? playerAudio.duration : 0,
    playbackRate,
    volume,
    sleepTimerEndsAt,
    sleepAtTrackEnd,
    isBuffering,
    errorMessage,
  };
  // The offscreen document cannot write chrome.storage; the background mirrors
  // this player-state broadcast into session storage (PLAYER_LIVE_KEY) for
  // cold-open rendering.
  const msg: FromOffscreen = { target: "ui", type: "player-state", state };
  void browser.runtime.sendMessage(msg).catch(() => {});
}
