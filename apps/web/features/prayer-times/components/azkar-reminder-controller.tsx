"use client";

import { useCallback, useEffect } from "react";
import { useTranslations } from "next-intl";

import { computePrayerTimes } from "@repo/api/services/prayer-times";

import { usePrayerSettings } from "../hooks/use-prayer-settings";
import { useAzkarReminderSettings } from "../hooks/use-azkar-reminder-settings";
import { useAzkarReminderScheduler } from "../hooks/use-azkar-reminder-scheduler";
import {
  type AzkarReminderBuilder,
  scheduleAzkarReminders,
  showAzkarReminderNotification,
} from "../lib/azkar-reminder-notifications";

// Headless island: fires the Azkar al-Sabah/al-Masaa reminder `offsetMinutes`
// after Fajr/Asr. Foreground (scheduler) + background (triggers) share one tag
// so an overlap shows a single notification.
export function AzkarReminderController({ locale }: { locale: "ar" | "en" }) {
  const t = useTranslations("prayer");
  const { location, prefs, hydrated: prefsHydrated } = usePrayerSettings();
  const { settings, hydrated: azkarHydrated } = useAzkarReminderSettings();
  const ready = prefsHydrated && azkarHydrated;

  const build = useCallback<AzkarReminderBuilder>(
    (kind) => {
      const slug = kind === "sabah" ? settings.sabah[locale] : settings.masaa[locale];
      return {
        url: `/${locale}/adhkar/${encodeURIComponent(slug)}`,
        title: t(`azkar.${kind}.title`),
        body: t(`azkar.${kind}.body`),
      };
    },
    [locale, settings.sabah, settings.masaa, t],
  );

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
