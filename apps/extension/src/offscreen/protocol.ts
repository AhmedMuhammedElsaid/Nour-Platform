// Message contract between the background service worker, the offscreen audio
// document, and the UI pages (popup / new-tab). chrome.runtime messaging
// broadcasts to every extension context, so each message carries a `target` the
// receiver filters on.

import type { PlayerCommand, PlayerState } from "../lib/player-state";

// Built path of the offscreen page. CRXJS keeps an input HTML file's source path
// in dist (the options page builds to dist/src/options/index.html), so this same
// string resolves via chrome.runtime.getURL for createDocument.
export const OFFSCREEN_URL = "src/offscreen/index.html";

// Transient live-playback snapshot, mirrored to chrome.storage.session so a
// freshly-opened popup/new-tab can render now-playing before the first broadcast.
export const PLAYER_LIVE_KEY = "nour.player.live";

// background/UI → offscreen
export type ToOffscreen =
  | { target: "offscreen"; type: "adhan-play"; url: string; volume: number }
  | { target: "offscreen"; type: "adhan-stop" }
  | { target: "offscreen"; type: "player"; command: PlayerCommand };

// UI → background (player commands are routed so the offscreen doc can be created
// on demand before the command reaches it)
export type ToBackground = {
  target: "background";
  type: "player-command";
  command: PlayerCommand;
};

// Offscreen → background storage bridge. chrome.storage is NOT exposed to
// offscreen documents (only chrome.runtime), so the audio engine proxies every
// read/write to the background service worker, which has full storage access.
export type StorageGet = { target: "background"; type: "storage-get"; key: string };
export type StorageSet = {
  target: "background";
  type: "storage-set";
  key: string;
  value: unknown;
};

// offscreen → background / UI
export type FromOffscreen =
  | { target: "background"; type: "adhan-ended"; resumedPlayer: boolean }
  | { target: "ui"; type: "player-state"; state: PlayerState };

function isObject(msg: unknown): msg is Record<string, unknown> {
  return typeof msg === "object" && msg !== null;
}

export function isToOffscreen(msg: unknown): msg is ToOffscreen {
  return isObject(msg) && msg.target === "offscreen";
}

export function isPlayerCommandMessage(msg: unknown): msg is ToBackground {
  return isObject(msg) && msg.target === "background" && msg.type === "player-command";
}

export function isStorageGet(msg: unknown): msg is StorageGet {
  return (
    isObject(msg) &&
    msg.target === "background" &&
    msg.type === "storage-get" &&
    typeof msg.key === "string"
  );
}

export function isStorageSet(msg: unknown): msg is StorageSet {
  return (
    isObject(msg) &&
    msg.target === "background" &&
    msg.type === "storage-set" &&
    typeof msg.key === "string"
  );
}

export function isAdhanEnded(
  msg: unknown,
): msg is Extract<FromOffscreen, { type: "adhan-ended" }> {
  return isObject(msg) && msg.target === "background" && msg.type === "adhan-ended";
}

export function isPlayerState(
  msg: unknown,
): msg is Extract<FromOffscreen, { type: "player-state" }> {
  return isObject(msg) && msg.target === "ui" && msg.type === "player-state";
}
