// First-launch primer. Shown once (see use-onboarding) as a full-screen overlay
// before the app is used. Explains why, then on "Enable" requests the two OS
// permissions in sequence and wires the results:
//   1. Location → resolve the nearest curated city and store it, so prayer times
//      are computed for the user's place instead of the Cairo default (the root
//      cause of "prayer times are wrong"). Reuses nearestCity (offline, no
//      reverse-geocode network call), matching the location picker.
//   2. Notifications (one OS prompt covers adhan + adhkar) → enable the adhan and
//      the morning/evening adhkar reminders.
// `emitSettingsChanged()` makes the root <AzanScheduler> re-read permission +
// fresh settings so it schedules immediately, without an app restart.

import { useState } from "react";
import { Alert, Platform, ScrollView, View } from "react-native";
import { useTranslation } from "react-i18next";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Location from "expo-location";
import { Magnetometer } from "expo-sensors";

import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { nearestCity } from "@/features/prayer-times/data/cities";
import { useAdhanSettings } from "@/features/prayer-times/hooks/use-adhan-settings";
import { useAzkarReminderSettings } from "@/features/prayer-times/hooks/use-azkar-reminder-settings";
import { requestNotificationPermission } from "@/features/prayer-times/hooks/use-azan-notifications";
import { usePrayerSettings } from "@/features/prayer-times/hooks/use-prayer-settings";
import { openBatteryOptimizationSettings } from "@/lib/battery-optimization";
import { emitSettingsChanged } from "@/lib/settings-bus";

type Props = { onComplete: () => void };

export function OnboardingGate({ onComplete }: Props) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const [busy, setBusy] = useState(false);
  const { setLocation } = usePrayerSettings();
  const { setEnabled: setAdhanEnabled } = useAdhanSettings();
  const { setEnabled: setAzkarEnabled } = useAzkarReminderSettings();

  const enable = async () => {
    setBusy(true);
    let notifGranted = false;
    try {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === "granted") {
          const pos = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Balanced,
          });
          const city = nearestCity(pos.coords.latitude, pos.coords.longitude);
          setLocation({
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
            label: city.en,
            cityId: city.id,
          });
        }
      } catch {
        // Keep the default location; the user can pick a city later.
      }

      notifGranted = await requestNotificationPermission();
      if (notifGranted) {
        setAdhanEnabled(true);
        setAzkarEnabled(true);
      }

      // Prime the magnetometer up front so the Qibla compass works the first
      // time it's opened, no per-screen prompt. Raw magnetometer needs no OS
      // permission on native (this resolves granted), but requesting here also
      // covers the mobile-web path and any future gating. Non-fatal.
      try {
        await Magnetometer.requestPermissionsAsync();
      } catch {
        // Sensor unavailable — the Qibla screen falls back to a static bearing.
      }

      emitSettingsChanged();
    } finally {
      setBusy(false);
    }

    // Final nudge: aggressive OEM battery managers (Samsung "Sleeping apps")
    // kill scheduled exact alarms while the app is closed, which stops the
    // adhan. Point the user to the battery-optimization screen. Complete the
    // onboarding either way (it must only ever show once).
    if (notifGranted && Platform.OS === "android") {
      Alert.alert(t("onboarding.batteryTitle"), t("onboarding.batteryBody"), [
        { text: t("onboarding.batterySkip"), style: "cancel", onPress: onComplete },
        {
          text: t("onboarding.batteryOpen"),
          onPress: () => {
            void openBatteryOptimizationSettings();
            onComplete();
          },
        },
      ]);
    } else {
      onComplete();
    }
  };

  return (
    <View
      className="absolute inset-0 bg-bg"
      style={{ paddingTop: insets.top, paddingBottom: insets.bottom }}
    >
      <ScrollView contentContainerClassName="flex-1 justify-center gap-8 px-6">
        <View className="gap-2">
          <Text variant="display" className="text-3xl">
            {t("onboarding.title")}
          </Text>
          <Text variant="muted">{t("onboarding.subtitle")}</Text>
        </View>

        <View className="gap-5">
          <View className="gap-1">
            <Text variant="label">{t("onboarding.locationTitle")}</Text>
            <Text variant="body" className="text-text-2">
              {t("onboarding.locationBody")}
            </Text>
          </View>
          <View className="gap-1">
            <Text variant="label">{t("onboarding.notifTitle")}</Text>
            <Text variant="body" className="text-text-2">
              {t("onboarding.notifBody")}
            </Text>
          </View>
        </View>

        <View className="gap-3">
          <Button
            label={busy ? t("onboarding.working") : t("onboarding.enable")}
            disabled={busy}
            onPress={() => void enable()}
          />
          <Button
            label={t("onboarding.skip")}
            variant="ghost"
            disabled={busy}
            onPress={onComplete}
          />
        </View>
      </ScrollView>
    </View>
  );
}
