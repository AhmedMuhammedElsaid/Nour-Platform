"use client";

import { useEffect, useMemo } from "react";

import { computePrayerTimes } from "@repo/api/services/prayer-times";

import { usePrayerSettings } from "../hooks/use-prayer-settings";
import { useAzkarReminderSettings } from "../hooks/use-azkar-reminder-settings";
import { useAzkarReminderScheduler } from "../hooks/use-azkar-reminder-scheduler";
import { makeAzkarReminderBuilder } from "../lib/azkar-reminder-content";
import {
  scheduleAzkarReminders,
  showAzkarReminderNotification,
} from "../lib/azkar-reminder-notifications";

// Headless island: fires the Azkar al-Sabah/al-Masaa reminder `offsetMinutes`
// after Fajr/Asr. Foreground (scheduler) + background (triggers) share one tag
// so an overlap shows a single notification. Notifications are always Arabic.
export function AzkarReminderController() {
  const { location, prefs, hydrated: prefsHydrated } = usePrayerSettings();
  const { settings, hydrated: azkarHydrated } = useAzkarReminderSettings();
  const ready = prefsHydrated && azkarHydrated;

  const build = useMemo(() => makeAzkarReminderBuilder(settings), [settings]);

  useAzkarReminderScheduler({
    settings,
    location,
    prefs,
    enabled: ready,
    onFire: (event) => void showAzkarReminderNotification(event, build),
  });

  useEffect(() => {
    if (!ready || !settings.enabled) return;
    const day = computePrayerTimes({
      lat: location.lat,
      lng: location.lng,
      date: new Date(),
      method: prefs.method,
      madhab: prefs.madhab,
    });
    void scheduleAzkarReminders(day.instants, settings, build);
  }, [ready, settings, location.lat, location.lng, prefs.method, prefs.madhab, build]);

  return null;
}
