import { useTranslation } from "react-i18next";
import { Alert, I18nManager, Pressable } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Updates from "expo-updates";

import { Text } from "@/components/ui/text";
import { type Locale } from "@repo/shared-core/schemas/locale";
import i18n, { applyTextDirection, initialLocale, LOCALE_KEY } from "@/lib/i18n";

// Switches the app language. A full reload (Updates.reloadAsync) is the only way
// to flip RTL layout and re-run all data queries in the new language, so we
// persist the choice, set the text direction, then reload. In dev / Expo Go,
// where updates are disabled, reloadAsync is unavailable — fall back to a live
// text swap and prompt the user to restart for the direction change.
export function LocaleSwitcher() {
  const { t } = useTranslation();
  const currentLocale: Locale = (i18n.language as Locale) ?? initialLocale;
  const next: Locale = currentLocale === "ar" ? "en" : "ar";

  const handleSwitch = () => {
    void (async () => {
      await AsyncStorage.setItem(LOCALE_KEY, next);
      applyTextDirection(next);

      // Try a full reload (the only way to flip RTL + re-run queries). This
      // throws in dev builds / Expo Go and when updates are disabled — caught
      // below to fall back to a live text swap. On success the app restarts and
      // boots in `next` via hydrateLocale(), so nothing after this runs.
      try {
        await Updates.reloadAsync();
        return;
      } catch {
        // Fall through to the live swap.
      }

      await i18n.changeLanguage(next);
      const needsRtlFlip = (next === "ar") !== I18nManager.isRTL;
      if (needsRtlFlip) {
        Alert.alert(t("settings.localeChanged"), t("settings.restartRequired"), [
          { text: t("common.ok"), style: "default" },
        ]);
      }
    })();
  };

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t("settings.switchLocale", { locale: next.toUpperCase() })}
      onPress={handleSwitch}
      className="rounded-md border border-border px-2.5 py-1"
    >
      <Text className="text-sm font-semibold text-text">
        {currentLocale === "ar" ? "EN" : "ع"}
      </Text>
    </Pressable>
  );
}
