import { getLocales } from "expo-localization";
import i18n from "i18next";
import { I18nManager } from "react-native";
import { initReactI18next } from "react-i18next";

import { isLocale, type Locale, DEFAULT_LOCALE } from "@repo/shared-core/schemas/locale";

import ar from "@/locales/ar.json";
import en from "@/locales/en.json";

// AR is the product default; fall back to it for any unsupported device locale.
const deviceLocale = getLocales()[0]?.languageCode ?? DEFAULT_LOCALE;
export const initialLocale: Locale = isLocale(deviceLocale) ? deviceLocale : DEFAULT_LOCALE;

// RTL must be set before the first render — expo-router calls this module at
// app boot. Changing locale after launch requires `Updates.reloadAsync()`
// (RN can't flip writing direction live); that's wired in the locale switcher
// in a later phase.
export function applyTextDirection(locale: Locale): void {
  const isRtl = locale === "ar";
  if (I18nManager.isRTL !== isRtl) {
    I18nManager.allowRTL(isRtl);
    I18nManager.forceRTL(isRtl);
  }
}
applyTextDirection(initialLocale);

void i18n.use(initReactI18next).init({
  lng: initialLocale,
  fallbackLng: DEFAULT_LOCALE,
  resources: { ar: { translation: ar }, en: { translation: en } },
  interpolation: { escapeValue: false },
});

export default i18n;
