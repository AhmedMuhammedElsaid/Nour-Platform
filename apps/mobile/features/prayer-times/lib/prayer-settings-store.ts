// Pure AsyncStorage readers for prayer settings + locale, extracted out of
// use-prayer-settings.ts (Wave: Android home-screen widget, home_widget_plan.md
// §5.4) so the OS launcher widget's headless task handler can read the same
// settings the in-app hook uses, with zero behaviour change to the hook.

import AsyncStorage from "@react-native-async-storage/async-storage";

import {
  type PrayerLocation,
  type PrayerPreferences,
  DEFAULT_LOCATION,
  DEFAULT_MADHAB,
  DEFAULT_METHOD,
  calculationMethodSchema,
  madhabSchema,
  prayerLocationSchema,
} from "@repo/shared-core/schemas/prayer-times";
import { DEFAULT_LOCALE, isLocale } from "@repo/shared-core/schemas/locale";

export const LOCATION_KEY = "nour.prayer.location";
export const PREFS_KEY = "nour.prayer.prefs";
const LOCALE_KEY = "nour.locale";

// Pre-onboarding fallback: an empty prayer-location store (first launch, no
// onboarding run yet) resolves to Cairo (the app-wide DEFAULT_LOCATION),
// same as every other prayer-times reader in the app.
export async function readLocation(): Promise<PrayerLocation> {
  try {
    const raw = await AsyncStorage.getItem(LOCATION_KEY);
    if (!raw) return DEFAULT_LOCATION;
    const parsed = prayerLocationSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : DEFAULT_LOCATION;
  } catch {
    return DEFAULT_LOCATION;
  }
}

export async function readPrefs(): Promise<PrayerPreferences> {
  try {
    const raw = await AsyncStorage.getItem(PREFS_KEY);
    if (!raw) return { method: DEFAULT_METHOD, madhab: DEFAULT_MADHAB };
    const obj = JSON.parse(raw) as Record<string, unknown>;
    const method = calculationMethodSchema.safeParse(obj.method);
    const madhab = madhabSchema.safeParse(obj.madhab);
    return {
      method: method.success ? method.data : DEFAULT_METHOD,
      madhab: madhab.success ? madhab.data : DEFAULT_MADHAB,
    };
  } catch {
    return { method: DEFAULT_METHOD, madhab: DEFAULT_MADHAB };
  }
}

// Mirrors lib/i18n.ts's device-locale fallback WITHOUT importing it — i18n.ts
// has a module-scope i18next init side effect that must never run inside the
// headless widget task (home_widget_plan.md §4 "Locale (all rows)").
export async function readLocale(): Promise<"ar" | "en"> {
  try {
    const raw = await AsyncStorage.getItem(LOCALE_KEY);
    return raw && isLocale(raw) ? raw : DEFAULT_LOCALE;
  } catch {
    return DEFAULT_LOCALE;
  }
}
