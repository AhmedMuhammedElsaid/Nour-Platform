import { useCallback, useEffect, useState } from "react";
import browser from "webextension-polyfill";

import type { AdhanSettings, AzkarReminderSettings, PrayerLocation, PrayerPreferences } from "@repo/shared-core/schemas/prayer-times";

import { get, set, watch } from "../lib/storage";
import { nearestCity } from "../lib/cities";

// seedDefaults() pre-writes the Cairo DEFAULT_LOCATION on install, so "unset"
// can't be detected by absence — gate the one-time geolocation attempt on this
// dedicated flag instead. In-memory guard stops concurrent mounts (newtab +
// popup) from both prompting in the same page session.
const GEOLOCATED_FLAG = "nour.prayer.geolocated";
let autoDetectStarted = false;

// First open: ask for the device location so prayer times match where the user
// actually is, not the Cairo default. Runs at most once per profile.
async function maybeAutoDetectLocation(
  setLocation: (loc: PrayerLocation) => Promise<void>,
): Promise<void> {
  if (autoDetectStarted) return;
  autoDetectStarted = true;
  try {
    const existing = await browser.storage.local.get(GEOLOCATED_FLAG);
    if (existing[GEOLOCATED_FLAG]) return;
    if (typeof navigator === "undefined" || !navigator.geolocation) return;
    await browser.storage.local.set({ [GEOLOCATED_FLAG]: true });
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const city = nearestCity(pos.coords.latitude, pos.coords.longitude);
        void setLocation({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          label: city.en,
          cityId: city.id,
        });
      },
      () => {
        // Denied / unavailable — keep the default; the picker stays available.
      },
      { enableHighAccuracy: false, timeout: 15_000, maximumAge: 300_000 },
    );
  } catch {
    /* storage/geolocation unavailable — keep the default */
  }
}

// Generic hook factory: loads a storage key on mount, stays live via watch().
function useStorageKey<K extends "nour.prayer.location" | "nour.prayer.prefs" | "nour.prayer.adhan" | "nour.azkar.reminder">(
  key: K,
) {
  type V = K extends "nour.prayer.location"
    ? PrayerLocation
    : K extends "nour.prayer.prefs"
      ? PrayerPreferences
      : K extends "nour.prayer.adhan"
        ? AdhanSettings
        : AzkarReminderSettings;

  const [value, setValue] = useState<V | null>(null);

  useEffect(() => {
    void get(key).then((v) => setValue(v as V));
    const unwatch = watch(key, (v) => setValue(v as V));
    return unwatch;
  }, [key]);

  const update = useCallback(
    async (next: V) => {
      // Write to storage; the background's storage.onChanged listener re-arms
      // the scheduler automatically — no explicit message needed.
      await set(key, next as never);
    },
    [key],
  );

  return { value, update };
}

export function useLocation() {
  const { value, update } = useStorageKey("nour.prayer.location");
  useEffect(() => {
    void maybeAutoDetectLocation(update);
  }, [update]);
  return { location: value, setLocation: update };
}

export function usePrefs() {
  const { value, update } = useStorageKey("nour.prayer.prefs");
  return { prefs: value, setPrefs: update };
}

export function useAdhanSettings() {
  const { value, update } = useStorageKey("nour.prayer.adhan");
  return { adhan: value, setAdhan: update };
}

export function useAzkarSettings() {
  const { value, update } = useStorageKey("nour.azkar.reminder");
  return { azkar: value, setAzkar: update };
}
