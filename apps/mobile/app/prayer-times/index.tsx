// Prayer times screen — sun arc + countdown + timetable + settings.
// Mirrors apps/web/features/prayer-times/components/prayer-page.tsx.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Modal, Pressable, ScrollView, View } from "react-native";
import * as Notifications from "expo-notifications";

import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { SunArc } from "@/features/prayer-times/components/sun-arc";
import { PrayerTimetable } from "@/features/prayer-times/components/prayer-timetable";
import { LocationPicker } from "@/features/prayer-times/components/location-picker";
import { MethodSettings } from "@/features/prayer-times/components/method-settings";
import {
  requestNotificationPermission,
  useAzanNotifications,
} from "@/features/prayer-times/hooks/use-azan-notifications";
import { usePrayerSettings } from "@/features/prayer-times/hooks/use-prayer-settings";
import { initialLocale } from "@/lib/i18n";
import {
  computePrayerTimes,
  getUpcomingPrayer,
  type PrayerDay,
  type PrayerKey,
} from "@repo/shared-core/prayer-times/compute";
import { formatClock, formatCountdown } from "@repo/shared-core/prayer-times/format";

export default function PrayerTimesScreen() {
  const { t } = useTranslation();
  const locale = initialLocale;
  const { location, prefs, hydrated, setLocation, setMethod, setMadhab } =
    usePrayerSettings();

  const [now, setNow] = useState(() => new Date());
  const [showLocationPicker, setShowLocationPicker] = useState(false);
  const [notifEnabled, setNotifEnabled] = useState(false);
  const [notifGranted, setNotifGranted] = useState(false);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // 1s tick for countdown.
  useEffect(() => {
    tickRef.current = setInterval(() => setNow(new Date()), 1000);
    return () => {
      if (tickRef.current) clearInterval(tickRef.current);
    };
  }, []);

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

  const prayerLabels = useMemo<Partial<Record<PrayerKey, string>>>(
    () => ({
      fajr: t("prayer.fajr"),
      sunrise: t("prayer.sunrise"),
      dhuhr: t("prayer.dhuhr"),
      asr: t("prayer.asr"),
      maghrib: t("prayer.maghrib"),
      isha: t("prayer.isha"),
    }),
    [t],
  );

  useAzanNotifications(
    notifEnabled && notifGranted,
    location,
    prefs,
    prayerNames,
    hydrated,
  );

  const requestNotifs = useCallback(async () => {
    const granted = await requestNotificationPermission();
    setNotifGranted(granted);
    if (granted) setNotifEnabled(true);
  }, []);

  const countdown = formatCountdown(upcoming.msUntil);
  const upcomingTime = formatClock(upcoming.time, locale);

  return (
    <>
      <ScrollView className="flex-1 bg-bg px-4 pt-16" contentContainerClassName="gap-6 pb-24">
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
              {location.label} · {t("prayer.changeCity")}
            </Text>
          </Pressable>
        </View>

        {/* Sun arc */}
        {hydrated && (
          <SunArc
            day={day}
            now={now}
            nextPrayerKey={upcoming.key}
            prayerLabels={prayerLabels}
          />
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
                accessibilityState={{ checked: notifEnabled }}
                onPress={() => setNotifEnabled((v) => !v)}
                className={`h-7 w-12 rounded-full ${notifEnabled ? "bg-primary" : "bg-surface-2"}`}
              >
                <View
                  className={`size-5 rounded-full bg-white shadow m-1 ${notifEnabled ? "ms-auto" : ""}`}
                />
              </Pressable>
            </View>
          )}
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
          <View className="flex-row items-center justify-end px-4 pt-4">
            <Pressable
              accessibilityRole="button"
              onPress={() => setShowLocationPicker(false)}
            >
              <Text variant="muted">✕</Text>
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
