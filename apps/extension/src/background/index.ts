import { handleNotificationClick } from "../lib/notify";
import { seedDefaults } from "../lib/storage";
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
