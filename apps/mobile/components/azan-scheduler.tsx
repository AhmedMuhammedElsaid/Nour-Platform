// Root-mounted azan + adhkar scheduler. Mounted once in _layout so local
// notifications are (re)scheduled regardless of which screen the user opens —
// previously this lived only on the prayer-times screen, so the azan never
// scheduled for users who didn't visit it. Mirrors the web's site-wide
// <AdhanController>. Renders null.

import { useEffect, useMemo, useState } from "react";
import { AppState } from "react-native";
import { useTranslation } from "react-i18next";
import * as Notifications from "expo-notifications";
import { requestWidgetUpdate } from "react-native-android-widget";

import { renderNourHomeWidget } from "@/features/home/widget/render-nour-home-widget";
import { useAdhanSettings } from "@/features/prayer-times/hooks/use-adhan-settings";
import { useAzanNotifications } from "@/features/prayer-times/hooks/use-azan-notifications";
import {
  type AzkarReminderContent,
  useAzkarReminders,
} from "@/features/prayer-times/hooks/use-azkar-reminders";
import { useAzkarReminderSettings } from "@/features/prayer-times/hooks/use-azkar-reminder-settings";
import { useKahfReminder } from "@/features/quran/hooks/use-kahf-reminder";
import { useKahfReminderSettings } from "@/features/quran/hooks/use-kahf-reminder-settings";
import { usePrayerSettings } from "@/features/prayer-times/hooks/use-prayer-settings";
import { onSettingsChanged } from "@/lib/settings-bus";
import type { PrayerKey } from "@repo/shared-core/prayer-times/compute";

export function AzanScheduler() {
  const { t } = useTranslation();
  const { location, prefs, hydrated } = usePrayerSettings();
  const { settings: adhan, hydrated: adhanHydrated } = useAdhanSettings();
  const { settings: azkar, hydrated: azkarHydrated } = useAzkarReminderSettings();

  const [notifGranted, setNotifGranted] = useState(false);

  // Re-check notification permission on mount, on any settings write (onboarding
  // gate or the prayer-screen toggle), and when the app returns to foreground
  // (the user may have flipped the OS permission in Settings).
  useEffect(() => {
    const check = () =>
      Notifications.getPermissionsAsync().then(({ status }) =>
        setNotifGranted(status === "granted"),
      );
    void check();
    const unsub = onSettingsChanged(() => void check());
    const sub = AppState.addEventListener("change", (s) => {
      if (s === "active") void check();
    });
    return () => {
      unsub();
      sub.remove();
    };
  }, []);

  const prayerNames = useMemo<Record<Exclude<PrayerKey, "sunrise">, string>>(
    () => ({
      fajr: t("prayer.fajr"),
      dhuhr: t("prayer.dhuhr"),
      asr: t("prayer.asr"),
      maghrib: t("prayer.maghrib"),
      isha: t("prayer.isha"),
    }),
    [t],
  );

  useAzanNotifications(
    adhan.enabled && notifGranted,
    location,
    prefs,
    prayerNames,
    adhan.perPrayer,
    adhan.volume,
    hydrated && adhanHydrated,
  );

  // Instant "NourHome" launcher-widget refresh on a city/method/madhab change
  // (home_widget_plan.md §5.10), so the prayer row doesn't wait for the
  // 30-min updatePeriodMillis cycle. Radio/adhkar rows have no equivalent
  // "settings changed" trigger — they still refresh only on the 30-min cycle.
  // Android-only (this hook already only mounts what the Android widget
  // config plugin scaffolds — see ADR 0014, "Android only").
  useEffect(() => {
    if (!hydrated) return;
    void requestWidgetUpdate({
      widgetName: "NourHome",
      renderWidget: (widgetInfo) => renderNourHomeWidget(widgetInfo),
      widgetNotFound: () => {},
    });
  }, [location, prefs, hydrated]);

  // Reminders are always delivered in Arabic (Arabic dhikr) regardless of UI
  // language — matches the prayer-times screen / web makeAzkarReminderBuilder.
  const azkarContent = useMemo<AzkarReminderContent>(
    () => ({
      sabah: {
        title: t("prayer.azkar.sabah.title", { lng: "ar" }),
        body: t("prayer.azkar.sabah.body", { lng: "ar" }),
        slug: azkar.sabah.ar,
      },
      masaa: {
        title: t("prayer.azkar.masaa.title", { lng: "ar" }),
        body: t("prayer.azkar.masaa.body", { lng: "ar" }),
        slug: azkar.masaa.ar,
      },
    }),
    [t, azkar.sabah, azkar.masaa],
  );

  useAzkarReminders(
    azkar.enabled && notifGranted,
    location,
    prefs,
    azkar,
    azkarContent,
    hydrated && azkarHydrated,
  );

  // Friday Surah Al-Kahf — Arabic delivery, same convention as the azkar
  // reminders above.
  const { settings: kahf, hydrated: kahfHydrated } = useKahfReminderSettings();
  const kahfContent = useMemo(
    () => ({
      title: t("prayer.kahf.notifTitle", { lng: "ar" }),
      body: t("prayer.kahf.notifBody", { lng: "ar" }),
    }),
    [t],
  );
  useKahfReminder(kahf.enabled && notifGranted, kahfContent, kahfHydrated);

  return null;
}
