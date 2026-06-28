// Storage access for the audio engine running inside the Chrome offscreen
// document (and the Firefox player tab). chrome.storage is NOT available to
// offscreen documents — only chrome.runtime messaging — so every read/write is
// proxied to the background service worker, which performs the real storage op
// and responds. Drop-in replacement for the typed get/set in ./storage.
import browser from "webextension-polyfill";

import type { StorageGet, StorageSet } from "../offscreen/protocol";
import type { StorageKey, StorageValue } from "./storage";

export async function get<K extends StorageKey>(key: K): Promise<StorageValue<K>> {
  const message: StorageGet = { target: "background", type: "storage-get", key };
  return (await browser.runtime.sendMessage(message)) as StorageValue<K>;
}

export async function set<K extends StorageKey>(
  key: K,
  value: StorageValue<K>,
): Promise<void> {
  const message: StorageSet = { target: "background", type: "storage-set", key, value };
  await browser.runtime.sendMessage(message);
}
