import browser from "webextension-polyfill";

import type { AdhanPrayerKey } from "@repo/shared-core/schemas/prayer-times";

import { OFFSCREEN_URL, type ToOffscreen } from "../offscreen/protocol";
import type { PlayerCommand } from "./player-state";

const SITE = __API_BASE_URL__;

export function adhanUrl(key: AdhanPrayerKey): string {
  return `${SITE}/audio/${key === "fajr" ? "adhan-fajr.mp3" : "adhan.mp3"}`;
}

// ── Chrome: offscreen document ───────────────────────────────────────────────
// Only one offscreen document may exist per extension. Guard with hasDocument()
// and a single in-flight promise so concurrent callers don't race.

let creating: Promise<void> | null = null;

export async function ensureOffscreen(): Promise<void> {
  if (await chrome.offscreen.hasDocument()) return;
  if (creating) {
    await creating;
    return;
  }
  creating = chrome.offscreen.createDocument({
    url: OFFSCREEN_URL,
    reasons: [chrome.offscreen.Reason.AUDIO_PLAYBACK],
    justification: "Play the adhan and Nour audio with no visible window.",
  });
  try {
    await creating;
  } finally {
    creating = null;
  }
}

// ── Firefox: managed player tab ──────────────────────────────────────────────
// Firefox has no offscreen API. Audio plays in a real tab opened with
// active:false (visible but in background). The tab ID is stored in session
// storage so it survives background-script restarts between alarms.

const PLAYER_TAB_KEY = "nour.player.tabId";
// Path resolved via browser.runtime.getURL at runtime.
export const PLAYER_TAB_URL = "src/player/index.html";

async function getPlayerTabId(): Promise<number | null> {
  const r = await browser.storage.session.get(PLAYER_TAB_KEY);
  const v = r[PLAYER_TAB_KEY];
  return typeof v === "number" ? v : null;
}

async function setPlayerTabId(id: number | null): Promise<void> {
  if (id === null) {
    await browser.storage.session.remove(PLAYER_TAB_KEY);
  } else {
    await browser.storage.session.set({ [PLAYER_TAB_KEY]: id });
  }
}

async function ensurePlayerTab(): Promise<void> {
  const stored = await getPlayerTabId();
  if (stored !== null) {
    try {
      await browser.tabs.get(stored);
      return; // tab still alive
    } catch {
      await setPlayerTabId(null);
    }
  }
  const tab = await browser.tabs.create({
    url: browser.runtime.getURL(PLAYER_TAB_URL),
    active: false,
  });
  if (tab.id != null) await setPlayerTabId(tab.id);
}

// Close the player tab and clear the stored ID. Called by background/index.ts
// after an adhan ends with no active player (mirrors closeDocument on Chrome).
export async function closePlayerTab(): Promise<void> {
  const id = await getPlayerTabId();
  if (id !== null) {
    await browser.tabs.remove(id).catch(() => {});
    await setPlayerTabId(null);
  }
}

// ── Shared audio context bootstrap ──────────────────────────────────────────

async function ensureAudioContext(): Promise<void> {
  if (__BROWSER__ === "firefox") {
    await ensurePlayerTab();
  } else {
    await ensureOffscreen();
  }
}

async function post(message: ToOffscreen): Promise<void> {
  await browser.runtime.sendMessage(message);
}

// ── Public API ───────────────────────────────────────────────────────────────

export async function playAdhan(key: AdhanPrayerKey, volume: number): Promise<void> {
  await ensureAudioContext();
  await post({ target: "offscreen", type: "adhan-play", url: adhanUrl(key), volume });
}

export async function stop(): Promise<void> {
  await post({ target: "offscreen", type: "adhan-stop" });
}

export async function routePlayerCommand(command: PlayerCommand): Promise<void> {
  await ensureAudioContext();
  await post({ target: "offscreen", type: "player", command });
}
