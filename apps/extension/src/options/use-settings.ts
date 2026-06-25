"use client";

import { useCallback, useEffect, useState } from "react";

import type { AdhanSettings, AzkarReminderSettings, PrayerLocation, PrayerPreferences } from "@repo/shared-core/schemas/prayer-times";

import { get, set, watch } from "../lib/storage";

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
