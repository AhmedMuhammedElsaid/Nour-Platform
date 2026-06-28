import browser from "webextension-polyfill";

import { closePlayerTab, routePlayerCommand } from "../lib/audio-router";
import { warmAdhanCache } from "../lib/cache-manager";
import { handleNotificationClick } from "../lib/notify";
import { get, seedDefaults, setRaw, type StorageKey } from "../lib/storage";
import {
  PLAYER_LIVE_KEY,
  isAdhanEnded,
  isPlayerCommandMessage,
  isPlayerState,
  isStorageGet,
  isStorageSet,
} from "../offscreen/protocol";
import { ALARM_ADHAN, ALARM_AZKAR, ALARM_TICK, tick } from "./scheduler";

const REARM_KEYS = [
  "nour.prayer.adhan",
  "nour.azkar.reminder",
  "nour.prayer.location",
  "nour.prayer.prefs",
];

browser.runtime.onInstalled.addListener((details) => {
  console.warn(`[nour] extension ${details.reason}`);
  void seedDefaults().then(() => tick());
  void warmAdhanCache();
});

browser.runtime.onStartup.addListener(() => {
  void tick();
});

browser.alarms.onAlarm.addListener((alarm) => {
  if (
    alarm.name === ALARM_TICK ||
    alarm.name === ALARM_ADHAN ||
    alarm.name === ALARM_AZKAR
  ) {
    void tick();
  }
});

browser.storage.onChanged.addListener((changes, area) => {
  if (area !== "local") return;
  if (REARM_KEYS.some((key) => key in changes)) void tick();
});

browser.notifications.onClicked.addListener((id) => {
  void handleNotificationClick(id);
});

browser.runtime.onMessage.addListener((message) => {
  if (isPlayerCommandMessage(message)) {
    // Return the promise so the MV3 service worker is kept alive until the
    // offscreen document is created and the command is delivered. A bare
    // fire-and-forget (`void routePlayerCommand(...)`) lets Chrome terminate
    // the worker the moment this listener returns synchronously, which can
    // kill the in-flight `createDocument()`/`post()` and silently drop the
    // first play command.
    return routePlayerCommand(message.command);
  }

  // Storage bridge for the offscreen audio engine (chrome.storage is unavailable
  // there). Returning the promise sends the value/ack back to the engine.
  if (isStorageGet(message)) {
    // `key` crosses a runtime-message boundary as a plain string; it is always a
    // valid StorageKey minted by the typed engine call site.
    return get(message.key as StorageKey);
  }
  if (isStorageSet(message)) {
    return setRaw(message.key, message.value);
  }

  // Mirror live player state into session storage so a freshly-opened popup or
  // new-tab can render now-playing before the first live broadcast. The offscreen
  // can't write storage itself, so the background does it on its behalf.
  if (isPlayerState(message)) {
    void browser.storage.session.set({ [PLAYER_LIVE_KEY]: message.state }).catch(() => {});
    return;
  }

  // The adhan finished. Tear down the audio context (offscreen doc on Chrome,
  // player tab on Firefox) only if no player music resumed — an active player
  // must keep the context alive so audio survives cross-site navigation.
  if (isAdhanEnded(message) && !message.resumedPlayer) {
    if (__BROWSER__ === "firefox") {
      void closePlayerTab();
    } else {
      // chrome.offscreen is Chrome-only; this branch is tree-shaken in Firefox.
      void chrome.offscreen.closeDocument().catch(() => {});
    }
  }
});
