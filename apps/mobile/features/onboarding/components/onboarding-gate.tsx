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
import { ScrollView, View } from "react-native";
import { useTranslation } from "react-i18next";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Location from "expo-location";

import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { nearestCity } from "@/features/prayer-times/data/cities";
import { useAdhanSettings } from "@/features/prayer-times/hooks/use-adhan-settings";
import { useAzkarReminderSettings } from "@/features/prayer-times/hooks/use-azkar-reminder-settings";
import { requestNotificationPermission } from "@/features/prayer-times/hooks/use-azan-notifications";
import { usePrayerSettings } from "@/features/prayer-times/hooks/use-prayer-settings";
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
          });
        }
      } catch {
        // Keep the default location; the user can pick a city later.
      }

      const granted = await requestNotificationPermission();
      if (granted) {
        setAdhanEnabled(true);
        setAzkarEnabled(true);
      }

      emitSettingsChanged();
    } finally {
      setBusy(false);
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
