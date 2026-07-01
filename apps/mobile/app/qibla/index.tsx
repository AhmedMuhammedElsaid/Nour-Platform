// Qibla screen — compass dial pointing to the Kaaba, using the same stored
// location as prayer times. Mirrors apps/web/features/qibla/components/qibla-page.tsx.
// Reached from the prayer-times screen (router.push("/qibla")); the app has no
// header chrome (Stack headerShown:false), so this screen draws its own back row.

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Modal, Pressable, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";

import { Text } from "@/components/ui/text";
import { QiblaCompass } from "@/features/qibla/components/qibla-compass";
import { useMagnetometerHeading } from "@/features/qibla/hooks/use-magnetometer-heading";
import { LocationPicker } from "@/features/prayer-times/components/location-picker";
import { usePrayerSettings } from "@/features/prayer-times/hooks/use-prayer-settings";
import { cityLabel } from "@/features/prayer-times/data/cities";
import { initialLocale } from "@/lib/i18n";
import { useTheme } from "@/lib/theme-context";
import { useDockSpacing } from "@/lib/use-dock-spacing";
import {
  computeQiblaBearing,
  qiblaCardinalKey,
  qiblaDistanceKm,
} from "@repo/shared-core/qibla/compute";

const groupThousands = (n: number): string =>
  String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ",");

export default function QiblaScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const dockSpacing = useDockSpacing();
  const { theme } = useTheme();
  const { location, hydrated, setLocation } = usePrayerSettings();
  const { heading, available } = useMagnetometerHeading();
  const [showLocationPicker, setShowLocationPicker] = useState(false);

  const bearing = computeQiblaBearing(location);
  const cardinal = t(`qibla.compass.${qiblaCardinalKey(bearing)}`);
  const distanceKm = groupThousands(Math.round(qiblaDistanceKm(location)));
  const aligned =
    heading != null &&
    Math.abs(((heading - bearing + 540) % 360) - 180) <= 6;

  return (
    <>
      <ScrollView
        className="flex-1 bg-bg px-4"
        contentContainerClassName="gap-6"
        contentContainerStyle={{ paddingTop: insets.top + 12, paddingBottom: dockSpacing }}
      >
        {/* Back + title */}
        <View className="flex-row items-center gap-2">
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t("common.back")}
            onPress={() => router.back()}
            className="size-9 items-center justify-center"
          >
            <Text variant="muted" className="text-2xl">‹</Text>
          </Pressable>
          <View>
            <Text variant="display" className="text-2xl">{t("qibla.title")}</Text>
            <Pressable
              accessibilityRole="button"
              onPress={() => setShowLocationPicker(true)}
            >
              <Text variant="muted" className="text-primary underline">
                {cityLabel(location, initialLocale)} · {t("qibla.changeCity")}
              </Text>
            </Pressable>
          </View>
        </View>

        {/* Compass */}
        <View className="rounded-xl border border-border bg-surface p-6">
          {hydrated && (
            <QiblaCompass bearing={bearing} heading={heading} theme={theme} />
          )}

          <View className="mt-4 items-center gap-1">
            <Text
              variant="display"
              className="text-2xl text-primary"
              style={{ fontVariant: ["tabular-nums"] }}
            >
              {t("qibla.bearing", { degrees: Math.round(bearing), direction: cardinal })}
            </Text>
            <Text variant="muted">{t("qibla.distanceKm", { km: distanceKm })}</Text>
            {aligned ? (
              <Text className="mt-1 text-sun">{t("qibla.facingQibla")}</Text>
            ) : null}
          </View>

          <View className="mt-3 items-center">
            <Text variant="muted" className="text-center text-xs">
              {available ? t("qibla.calibrateHint") : t("qibla.staticHint")}
            </Text>
          </View>
        </View>
      </ScrollView>

      {/* Location picker modal — same pattern as the prayer-times screen. */}
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
