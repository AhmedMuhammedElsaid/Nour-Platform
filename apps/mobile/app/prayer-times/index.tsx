// Prayer times screen — sun arc + countdown + timetable + settings.
// Mirrors apps/web/features/prayer-times/components/prayer-page.tsx.

import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Alert, Modal, Pressable, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect, useRouter } from "expo-router";
import * as Notifications from "expo-notifications";

import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { SunArc } from "@/features/prayer-times/components/sun-arc";
import { buildArcDots } from "@/features/prayer-times/lib/arc-dots";
import { PrayerCountdown } from "@/features/prayer-times/components/prayer-countdown";
import { PrayerTimetable } from "@/features/prayer-times/components/prayer-timetable";
import { LocationPicker } from "@/features/prayer-times/components/location-picker";
import { MethodSettings } from "@/features/prayer-times/components/method-settings";
import { useAdhanSettings } from "@/features/prayer-times/hooks/use-adhan-settings";
import {
  requestNotificationPermission,
  scheduleTestAzan,
} from "@/features/prayer-times/hooks/use-azan-notifications";
import { scheduleTestAzkar } from "@/features/prayer-times/hooks/use-azkar-reminders";
import { useAzkarReminderSettings } from "@/features/prayer-times/hooks/use-azkar-reminder-settings";
import { scheduleTestKahf } from "@/features/quran/hooks/use-kahf-reminder";
import { useKahfReminderSettings } from "@/features/quran/hooks/use-kahf-reminder-settings";
import { usePrayerSettings } from "@/features/prayer-times/hooks/use-prayer-settings";
import { cityLabel } from "@/features/prayer-times/data/cities";
import { initialLocale } from "@/lib/i18n";
import { useTheme } from "@/lib/theme-context";
import { useDockSpacing } from "@/lib/use-dock-spacing";
import {
  computePrayerTimes,
  getArcPosition,
  getNextPrayer,
  type NextPrayer,
} from "@repo/shared-core/prayer-times/compute";
import { usePrayerDay } from "@/features/prayer-times/hooks/use-prayer-day";
import { formatClock } from "@repo/shared-core/prayer-times/format";

export default function PrayerTimesScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const locale = initialLocale;
  // Owner-reported 2026-07-22: the shared useDockSpacing() base gap (8dp,
  // right for most screens) still let the last settings card sit under the
  // bottom dock here specifically. Extend locally rather than raising the
  // shared base (that would re-open the doubled-padding bug on every other
  // screen using the hook).
  const dockSpacing = useDockSpacing() + 24;
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const { location, prefs, hydrated, setLocation, setMethod, setMadhab } =
    usePrayerSettings();
  const { settings: azkar, setEnabled: setAzkarEnabled } =
    useAzkarReminderSettings();
  const { settings: kahf, setEnabled: setKahfEnabled } =
    useKahfReminderSettings();
  const { settings: adhan, setEnabled: setAdhanEnabled } = useAdhanSettings();

  const [now, setNow] = useState(() => new Date());
  const [showLocationPicker, setShowLocationPicker] = useState(false);
  const [notifGranted, setNotifGranted] = useState(false);

  // Tick once a MINUTE — only while this screen is focused (it stays mounted in
  // the stack after you leave it). The per-second countdown lives in the isolated
  // <PrayerCountdown> leaf; this tick only moves the arc body / upcoming key,
  // where a minute of drift is imperceptible. A 1s tick here re-rendered the
  // whole screen (usePrayerDay + arc math + SunArc SVG + timetable) every second.
  useFocusEffect(
    useCallback(() => {
      setNow(new Date());
      const id = setInterval(() => setNow(new Date()), 60_000);
      return () => clearInterval(id);
    }, []),
  );

  // Check notification permissions on mount.
  useEffect(() => {
    void Notifications.getPermissionsAsync().then(({ status }) => {
      setNotifGranted(status === "granted");
    });
  }, []);

  // Aladhan-sourced day; falls back to local adhan-js when offline.
  const day = usePrayerDay(location.lat, location.lng, prefs.method, prefs.madhab, now);

  const DAY_MS = 86_400_000;
  const upcoming = useMemo((): NextPrayer => {
    const next = getNextPrayer(day, now);
    if (next) return next;
    // Past Isha — count down to tomorrow's Fajr (local fallback for display only;
    // the notification scheduler fetches tomorrow from Aladhan separately).
    const tom = computePrayerTimes({
      lat: location.lat,
      lng: location.lng,
      date: new Date(now.getTime() + DAY_MS),
      method: prefs.method,
      madhab: prefs.madhab,
    });
    const fajr = tom.instants.find((i) => i.key === "fajr")?.time;
    const fallback = new Date(now.getTime() + DAY_MS);
    const t = fajr ?? fallback;
    return { key: "fajr", time: t, msUntil: t.getTime() - now.getTime() };
    // `msUntil` above is a point-in-time snapshot — only PrayerCountdown's own
    // internal tick should read a live delta from `target`, never this field.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [day, now.toDateString(), Math.floor(now.getTime() / 60_000)]);

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

  const toggleKahf = useCallback(
    (next: boolean) => {
      setKahfEnabled(next);
      if (next && !notifGranted) {
        void requestNotificationPermission().then(setNotifGranted);
      }
    },
    [setKahfEnabled, notifGranted],
  );

  // Verify the closed-app adhan without waiting for a real prayer: schedules a
  // one-off azan ~60s out, then tells the user to lock the phone. Exercises the
  // exact-alarm path the permission fix enables.
  const runTestAdhan = useCallback(async () => {
    try {
      const fireAt = await scheduleTestAzan(t("prayer.adhan.testTitle"), adhan.volume);
      Alert.alert(
        t("prayer.adhan.testTitle"),
        t("prayer.adhan.testScheduled", { time: formatClock(fireAt, locale) }),
      );
    } catch {
      // Native module absent / ReactContextLost / scheduling failure — surface it
      // instead of the promise rejecting silently (user saw "nothing happened").
      Alert.alert(t("prayer.adhan.testTitle"), t("common.error"));
    }
  }, [t, locale, adhan.volume]);

  // Same verify pattern as the adhan test above, for the Azkar + Kahf reminders.
  const runTestAzkar = useCallback(async () => {
    try {
      const fireAt = await scheduleTestAzkar("sabah", {
        title: t("prayer.azkar.sabah.title", { lng: "ar" }),
        body: t("prayer.azkar.sabah.body", { lng: "ar" }),
        slug: azkar.sabah.ar,
      });
      Alert.alert(
        t("prayer.azkar.testTitle"),
        t("prayer.azkar.testScheduled", { time: formatClock(fireAt, locale) }),
      );
    } catch {
      Alert.alert(t("prayer.azkar.testTitle"), t("common.error"));
    }
  }, [t, locale, azkar.sabah]);

  const runTestKahf = useCallback(async () => {
    try {
      const fireAt = await scheduleTestKahf({
        title: t("prayer.kahf.notifTitle", { lng: "ar" }),
        body: t("prayer.kahf.notifBody", { lng: "ar" }),
      });
      Alert.alert(
        t("prayer.kahf.testTitle"),
        t("prayer.kahf.testScheduled", { time: formatClock(fireAt, locale) }),
      );
    } catch {
      Alert.alert(t("prayer.kahf.testTitle"), t("common.error"));
    }
  }, [t, locale]);

  // Active body (sun by day, moon by night) + its progress, plus the day-arc dot
  // positions. Recomputed each tick so the body glides; both are cheap + pure.
  // Moon shares the Aladhan `day` the dots use so it hands off on the exact Fajr
  // dot the adhan fired on; adjacent days (night-band only) fall back to local calc.
  const arc = getArcPosition(
    (date) =>
      date.toDateString() === now.toDateString()
        ? day
        : computePrayerTimes({
            lat: location.lat,
            lng: location.lng,
            method: prefs.method,
            madhab: prefs.madhab,
            date,
          }),
    now,
  );
  // Pass a label resolver so the full-screen arc can name each dot (showLabels).
  const dots = buildArcDots(day, upcoming.key, (key) => t(`prayer.${key}`));

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

        {/* Qibla entry — a prominent banner (the compass shares this screen's
            stored location). Mirrors the Home Qibla/Radio cards. */}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t("qibla.title")}
          onPress={() => router.push("/qibla")}
          className="flex-row items-center gap-4 rounded-xl border border-border bg-surface p-4"
        >
          <View className="size-12 items-center justify-center rounded-lg bg-primary/10">
            <Text className="text-2xl">🕋</Text>
          </View>
          <View className="min-w-0 flex-1">
            <Text variant="body" className="font-medium">{t("qibla.title")}</Text>
            <Text variant="muted" numberOfLines={1}>{t("qibla.homeCardSubtitle")}</Text>
          </View>
          <Text variant="muted" className="text-xl">›</Text>
        </Pressable>

        {/* Sun/moon arc */}
        {hydrated && (
          <SunArc dots={dots} fraction={arc.fraction} isNight={arc.isNight} onNightBand={arc.onNightBand} theme={theme} showLabels />
        )}

        {/* Isolated ticking leaf — only this re-renders every second, not the
            whole screen (see prayer-countdown.tsx). */}
        <PrayerCountdown nextKey={upcoming.key} target={upcoming.time} locale={locale} size="lg" />

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
          {notifGranted && azkar.enabled ? (
            <Button
              label={t("prayer.azkar.test")}
              variant="ghost"
              onPress={() => void runTestAzkar()}
            />
          ) : null}
        </View>

        {/* Friday Surah Al-Kahf reminder toggle — fixed Friday 12:00 local */}
        <View className="gap-3 rounded-lg border border-border bg-surface p-4">
          <Text variant="label">{t("prayer.kahf.title")}</Text>
          <View className="flex-row items-center justify-between">
            <Text variant="body" className="flex-1 pe-3">
              {t("prayer.kahf.enable")}
            </Text>
            <Pressable
              accessibilityRole="switch"
              accessibilityState={{ checked: kahf.enabled }}
              accessibilityLabel={t("prayer.kahf.enable")}
              onPress={() => toggleKahf(!kahf.enabled)}
              className={`h-7 w-12 rounded-full ${kahf.enabled ? "bg-primary" : "bg-surface-2"}`}
            >
              <View
                className={`size-5 rounded-full bg-white shadow m-1 ${kahf.enabled ? "ms-auto" : ""}`}
              />
            </Pressable>
          </View>
          {kahf.enabled ? (
            <Text variant="muted" className="text-xs">
              {t("prayer.kahf.hint")}
            </Text>
          ) : null}
          {notifGranted && kahf.enabled ? (
            <Button
              label={t("prayer.kahf.test")}
              variant="ghost"
              onPress={() => void runTestKahf()}
            />
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
