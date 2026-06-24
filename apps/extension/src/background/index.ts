import { seedDefaults } from "../lib/storage";

chrome.runtime.onInstalled.addListener((details) => {
  console.warn(`[nour] extension ${details.reason}`);
  void seedDefaults();
});
