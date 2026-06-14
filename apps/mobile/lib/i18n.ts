import { getLocales } from "expo-localization";
import i18n from "i18next";
import { I18nManager } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { initReactI18next } from "react-i18next";

import { isLocale, type Locale, DEFAULT_LOCALE } from "@repo/shared-core/schemas/locale";

import ar from "@/locales/ar.json";
import en from "@/locales/en.json";

// Storage key for the user's explicit language choice (set by LocaleSwitcher).
export const LOCALE_KEY = "nour.locale";

// AR is the product default; fall back to it for any unsupported device locale.
const deviceLocale = getLocales()[0]?.languageCode ?? DEFAULT_LOCALE;
const deviceResolved: Locale = isLocale(deviceLocale) ? deviceLocale : DEFAULT_LOCALE;

// The active app locale. It starts from the device locale synchronously (so the
// very first modules to import it have a sane value) and is upgraded to the
// user's persisted choice by hydrateLocale() before the app's first render
// (see app/_layout.tsx). The persisted choice always wins because changing it
// requires a full reload (Updates.reloadAsync), so it stays stable per session.
// Exported as `let` deliberately — consumers read it at render time, after
// hydration, via the module's live binding.
export let initialLocale: Locale = deviceResolved;

// RTL must be set before the first render — expo-router calls this module at
// app boot. Changing locale after launch requires `Updates.reloadAsync()`
// (RN can't flip writing direction live); that's wired in the locale switcher.
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

// Read the persisted language choice and apply it before the first render.
// Resolves to the active locale. A no-op when nothing is stored or storage
// fails (keeps the device-derived locale). Call exactly once at boot.
export async function hydrateLocale(): Promise<Locale> {
  try {
    const stored = await AsyncStorage.getItem(LOCALE_KEY);
    if (stored && isLocale(stored) && stored !== initialLocale) {
      initialLocale = stored;
      applyTextDirection(stored);
      await i18n.changeLanguage(stored);
    }
  } catch {
    // Keep the device-derived locale on any storage error.
  }
  return initialLocale;
}

export default i18n;
