import browser from "webextension-polyfill";

import { closePlayerTab, routePlayerCommand } from "../lib/audio-router";
import { warmAdhanCache } from "../lib/cache-manager";
import { handleNotificationClick } from "../lib/notify";
import { seedDefaults } from "../lib/storage";
import { isAdhanEnded, isPlayerCommandMessage } from "../offscreen/protocol";
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
    void routePlayerCommand(message.command);
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
