import { routePlayerCommand } from "../lib/audio-router";
import { warmAdhanCache } from "../lib/cache-manager";
import { handleNotificationClick } from "../lib/notify";
import { seedDefaults } from "../lib/storage";
import { isAdhanEnded, isPlayerCommandMessage } from "../offscreen/protocol";
import { ALARM_ADHAN, ALARM_AZKAR, ALARM_TICK, tick } from "./scheduler";

// Keys whose change must re-arm the scheduler (options-page writes). The
// fired-claim keys (nour.*.fired) are deliberately excluded so claiming an
// event doesn't loop back into a re-arm.
const REARM_KEYS = [
  "nour.prayer.adhan",
  "nour.azkar.reminder",
  "nour.prayer.location",
  "nour.prayer.prefs",
];

chrome.runtime.onInstalled.addListener((details) => {
  console.warn(`[nour] extension ${details.reason}`);
  void seedDefaults().then(() => tick());
  // Warm the audio cache immediately — adhan is enabled by default, so this
  // covers the common case. Non-fatal if the device is offline at install time.
  void warmAdhanCache();
});

// Browser launch — the periodic alarm persists across restarts, but tick here
// re-arms immediately rather than waiting up to a minute for the first heartbeat.
chrome.runtime.onStartup.addListener(() => {
  void tick();
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (
    alarm.name === ALARM_TICK ||
    alarm.name === ALARM_ADHAN ||
    alarm.name === ALARM_AZKAR
  ) {
    void tick();
  }
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== "local") return;
  if (REARM_KEYS.some((key) => key in changes)) void tick();
});

chrome.notifications.onClicked.addListener((id) => {
  void handleNotificationClick(id);
});

chrome.runtime.onMessage.addListener((message) => {
  // Player commands from the popup / new-tab — route to the offscreen document,
  // creating it on demand for the initial load.
  if (isPlayerCommandMessage(message)) {
    void routePlayerCommand(message.command);
    return;
  }

  // The adhan finished. Close the offscreen document only if it didn't resume
  // music — an idle document shouldn't linger, but an active player keeps it
  // alive so audio survives across navigation.
  if (isAdhanEnded(message) && !message.resumedPlayer) {
    void chrome.offscreen.closeDocument().catch(() => {
      // Already closed / never opened — nothing to tear down.
    });
  }
});
