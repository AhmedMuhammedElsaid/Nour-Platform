// Background service worker entry.
//
// This scaffold confirms the worker registers and reserves the install hook
// that a later step uses to seed default prayer/adhan settings. The azan
// scheduler (chrome.alarms + the stale-fire/dedup pipeline from
// @repo/shared-core/prayer-times/schedule) lands in the next step.
chrome.runtime.onInstalled.addListener((details) => {
  console.warn(`[nour] extension ${details.reason}`);
});
