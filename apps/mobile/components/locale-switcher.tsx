import { useTranslation } from "react-i18next";
import { Alert, I18nManager, Pressable } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

import { Text } from "@/components/ui/text";
import { type Locale } from "@repo/shared-core/schemas/locale";
import i18n, { initialLocale } from "@/lib/i18n";

const LOCALE_KEY = "nour.locale";

// Switches i18next language immediately for text changes.
// RTL layout flip (I18nManager) requires an app restart — we save the
// preference and prompt the user. On next cold start, lib/i18n.ts picks up the
// stored locale and calls applyTextDirection(locale) before the first render.
export function LocaleSwitcher() {
  const { t } = useTranslation();
  const currentLocale: Locale = (i18n.language as Locale) ?? initialLocale;
  const next: Locale = currentLocale === "ar" ? "en" : "ar";

  const handleSwitch = () => {
    void i18n.changeLanguage(next).then(() => {
      void AsyncStorage.setItem(LOCALE_KEY, next);
    });

    // Only prompt for restart when the RTL direction actually changes.
    const needsRtlFlip = (next === "ar") !== I18nManager.isRTL;
    if (needsRtlFlip) {
      Alert.alert(
        t("settings.localeChanged"),
        t("settings.restartRequired"),
        [{ text: t("common.ok"), style: "default" }],
      );
    }
  };

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t("settings.switchLocale", { locale: next.toUpperCase() })}
      onPress={handleSwitch}
      className="rounded-md border border-border px-2.5 py-1"
    >
      <Text className="text-sm font-semibold text-text">
        {currentLocale === "ar" ? "EN" : "عر"}
      </Text>
    </Pressable>
  );
}
