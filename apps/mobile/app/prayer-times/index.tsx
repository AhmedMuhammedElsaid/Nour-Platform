// Prayer times screen — sun arc + countdown + timetable + settings.
// Mirrors apps/web/features/prayer-times/components/prayer-page.tsx.

import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Alert, Modal, Pressable, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect } from "expo-router";
import * as Notifications from "expo-notifications";

import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { SunArc } from "@/features/prayer-times/components/sun-arc";
import { buildArcDots } from "@/features/prayer-times/lib/arc-dots";
import { PrayerTimetable } from "@/features/prayer-times/components/prayer-timetable";
import { LocationPicker } from "@/features/prayer-times/components/location-picker";
import { MethodSettings } from "@/features/prayer-times/components/method-settings";
import { useAdhanSettings } from "@/features/prayer-times/hooks/use-adhan-settings";
import {
  requestNotificationPermission,
  scheduleTestAzan,
} from "@/features/prayer-times/hooks/use-azan-notifications";
import { useAzkarReminderSettings } from "@/features/prayer-times/hooks/use-azkar-reminder-settings";
import { usePrayerSettings } from "@/features/prayer-times/hooks/use-prayer-settings";
import { cityLabel } from "@/features/prayer-times/data/cities";
import { initialLocale } from "@/lib/i18n";
import { useTheme } from "@/lib/theme-context";
import { useDockSpacing } from "@/lib/use-dock-spacing";
import {
  computePrayerTimes,
  getArcPosition,
  getUpcomingPrayer,
  type PrayerDay,
  type PrayerKey,
} from "@repo/shared-core/prayer-times/compute";
import { formatClock, formatCountdown } from "@repo/shared-core/prayer-times/format";

export default function PrayerTimesScreen() {
  const { t } = useTranslation();
  const locale = initialLocale;
  const dockSpacing = useDockSpacing();
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const { location, prefs, hydrated, setLocation, setMethod, setMadhab } =
    usePrayerSettings();
  const { settings: azkar, setEnabled: setAzkarEnabled } =
    useAzkarReminderSettings();
  const { settings: adhan, setEnabled: setAdhanEnabled } = useAdhanSettings();

  const [now, setNow] = useState(() => new Date());
  const [showLocationPicker, setShowLocationPicker] = useState(false);
  const [notifGranted, setNotifGranted] = useState(false);

  // 1s tick for the countdown — only while this screen is focused. It stays
  // mounted in the stack after you leave it, so an unconditional interval would
  // keep ticking (and recomputing) in the background and add to app-wide lag.
  useFocusEffect(
    useCallback(() => {
      setNow(new Date());
      const id = setInterval(() => setNow(new Date()), 1000);
      return () => clearInterval(id);
    }, []),
  );

  // Check notification permissions on mount.
  useEffect(() => {
    void Notifications.getPermissionsAsync().then(({ status }) => {
      setNotifGranted(status === "granted");
    });
  }, []);

  const day: PrayerDay = useMemo(
    () =>
      computePrayerTimes({
        lat: location.lat,
        lng: location.lng,
        date: now,
        method: prefs.method,
        madhab: prefs.madhab,
      }),
    // Re-compute only when date changes (day boundary) or settings change.
    [
      location.lat,
      location.lng,
      prefs.method,
      prefs.madhab,
      now.toDateString(),
    ],
  );

  const upcoming = useMemo(
    () =>
      getUpcomingPrayer(
        {
          lat: location.lat,
          lng: location.lng,
          method: prefs.method,
          madhab: prefs.madhab,
        },
        now,
      ),
    [location.lat, location.lng, prefs.method, prefs.madhab, now],
  );

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

  // Scheduling of azan + adhkar notifications is centralized in the root
  // <AzanScheduler> (components/azan-scheduler.tsx) so it runs regardless of
  // which screen is open. This screen only reads/toggles the persisted settings;
  // writes emit the settings bus, which makes the scheduler reschedule.

  const requestNotifs = useCallback(async () => {
    const granted = await requestNotificationPermission();
    setNotifGranted(granted);
    if (granted) setAdhanEnabled(true);
  }, [setAdhanEnabled]);

  // Toggle the azkar reminder; request notification permission on first enable
  // (mirrors the web's requestAdhanPermission on enable).
  const toggleAzkar = useCallback(
    (next: boolean) => {
      setAzkarEnabled(next);
      if (next && !notifGranted) {
        void requestNotificationPermission().then(setNotifGranted);
      }
    },
    [setAzkarEnabled, notifGranted],
  );

  // Verify the closed-app adhan without waiting for a real prayer: schedules a
  // one-off azan ~60s out, then tells the user to lock the phone. Exercises the
  // exact-alarm path the permission fix enables.
  const runTestAdhan = useCallback(async () => {
    const fireAt = await scheduleTestAzan(t("prayer.adhan.testTitle"));
    Alert.alert(
      t("prayer.adhan.testTitle"),
      t("prayer.adhan.testScheduled", { time: formatClock(fireAt, locale) }),
    );
  }, [t, locale]);

  const countdown = formatCountdown(upcoming.msUntil);
  const upcomingTime = formatClock(upcoming.time, locale);

  // Active body (sun by day, moon by night) + its progress, plus the day-arc dot
  // positions. Recomputed each tick so the body glides; both are cheap + pure.
  const arc = getArcPosition(
    { lat: location.lat, lng: location.lng, method: prefs.method, madhab: prefs.madhab },
    now,
  );
  const dots = buildArcDots(day, upcoming.key);

  return (
    <>
      <ScrollView
        className="flex-1 bg-bg px-4 pt-16"
        contentContainerClassName="gap-6"
        contentContainerStyle={{ paddingBottom: dockSpacing }}
      >
        {/* Heading */}
        <View className="gap-1">
          <Text variant="display" className="text-2xl">
            {t("prayer.title")}
          </Text>
          <Pressable
            accessibilityRole="button"
            onPress={() => setShowLocationPicker(true)}
          >
            <Text variant="muted" className="text-primary underline">
              {cityLabel(location, initialLocale)} · {t("prayer.changeCity")}
            </Text>
          </Pressable>
        </View>

        {/* Sun/moon arc */}
        {hydrated && (
          <SunArc dots={dots} fraction={arc.fraction} isNight={arc.isNight} onNightBand={arc.onNightBand} theme={theme} />
        )}

        {/* Countdown */}
        <View className="items-center gap-1">
          <Text variant="muted">{t("prayer.next")}</Text>
          <Text variant="display" className="text-3xl text-primary">
            {prayerNames[upcoming.key]}
          </Text>
          <Text variant="muted">
            {countdown.h > 0
              ? t("prayer.countdown", { h: countdown.h, m: countdown.m })
              : `${countdown.m}m`}{" "}
            · {t("prayer.at", { time: upcomingTime })}
          </Text>
        </View>

        {/* Timetable */}
        {hydrated && (
          <PrayerTimetable day={day} nextPrayerKey={upcoming.key} />
        )}

        {/* Method settings */}
        <MethodSettings
          method={prefs.method}
          madhab={prefs.madhab}
          onMethodChange={setMethod}
          onMadhabChange={setMadhab}
        />

        {/* Notification toggle */}
        <View className="gap-3 rounded-lg border border-border bg-surface p-4">
          <Text variant="label">{t("prayer.adhan.title")}</Text>
          {!notifGranted ? (
            <Button
              label={t("prayer.adhan.background")}
              variant="outline"
              onPress={() => void requestNotifs()}
            />
          ) : (
            <View className="flex-row items-center justify-between">
              <Text variant="body">{t("prayer.adhan.enable")}</Text>
              <Pressable
                accessibilityRole="switch"
                accessibilityState={{ checked: adhan.enabled }}
                onPress={() => setAdhanEnabled(!adhan.enabled)}
                className={`h-7 w-12 rounded-full ${adhan.enabled ? "bg-primary" : "bg-surface-2"}`}
              >
                <View
                  className={`size-5 rounded-full bg-white shadow m-1 ${adhan.enabled ? "ms-auto" : ""}`}
                />
              </Pressable>
            </View>
          )}
          {notifGranted && adhan.enabled ? (
            <Button
              label={t("prayer.adhan.test")}
              variant="ghost"
              onPress={() => void runTestAdhan()}
            />
          ) : null}
        </View>

        {/* Adhkar reminder toggle — sabah after Fajr, masaa after Asr */}
        <View className="gap-3 rounded-lg border border-border bg-surface p-4">
          <Text variant="label">{t("prayer.azkar.title")}</Text>
          <View className="flex-row items-center justify-between">
            <Text variant="body" className="flex-1 pe-3">
              {t("prayer.azkar.enable")}
            </Text>
            <Pressable
              accessibilityRole="switch"
              accessibilityState={{ checked: azkar.enabled }}
              accessibilityLabel={t("prayer.azkar.enable")}
              onPress={() => toggleAzkar(!azkar.enabled)}
              className={`h-7 w-12 rounded-full ${azkar.enabled ? "bg-primary" : "bg-surface-2"}`}
            >
              <View
                className={`size-5 rounded-full bg-white shadow m-1 ${azkar.enabled ? "ms-auto" : ""}`}
              />
            </Pressable>
          </View>
          {azkar.enabled ? (
            <Text variant="muted" className="text-xs">
              {notifGranted ? t("prayer.azkar.hint") : t("prayer.azkar.foregroundOnly")}
            </Text>
          ) : null}
        </View>
      </ScrollView>

      {/* Location picker modal */}
      <Modal
        visible={showLocationPicker}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowLocationPicker(false)}
      >
        <View className="flex-1 bg-bg">
          <View
            className="flex-row items-center justify-end px-4"
            style={{ paddingTop: insets.top + 16 }}
          >
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t("common.close")}
              onPress={() => setShowLocationPicker(false)}
              className="size-9 items-center justify-center"
            >
              <Text variant="muted" className="text-lg">✕</Text>
            </Pressable>
          </View>
          <LocationPicker
            onSelect={setLocation}
            onClose={() => setShowLocationPicker(false)}
          />
        </View>
      </Modal>
    </>
  );
}
