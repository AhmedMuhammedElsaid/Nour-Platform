import { useCallback, useEffect, useState } from "react";

import { get, set, watch } from "./storage";

export type Locale = "ar" | "en";
export type Dir = "rtl" | "ltr";

// Seed catalog ported from the web `messages/{ar,en}.json` namespaces. Grow it
// per phase as views adopt `t()`; the EN sweep is a later roadmap phase, so any
// missing key falls back to Arabic, then to the key itself.
type Catalog = Record<string, string>;

const ar: Catalog = {
  "common.appName": "نور",
  "common.search": "بحث",
  "common.loading": "جارٍ التحميل…",
  "common.back": "رجوع",
  "nav.home": "الرئيسية",
  "nav.library": "المكتبة",
  "nav.quran": "القرآن",
  "nav.adhkar": "الأذكار",
  "nav.prayer": "مواقيت الصلاة",
  "home.heroTitle": "نور",
  "home.heroSubtitle": "استمع إلى المحاضرات والقرآن، وتابع مواقيت الصلاة",
  "home.library": "المكتبة",
  "home.continueListening": "استمر في الاستماع",
  "home.dhikrOfDay": "ذكر اليوم",
  "home.clearHistory": "مسح السجل",
  "home.sortNewest": "الأحدث",
  "home.sortAZ": "أبجدي",
  "home.sortTracks": "عدد المقاطع",
  "theme.toggleToLight": "الوضع الفاتح",
  "theme.toggleToDark": "الوضع الداكن",
  "search.placeholder": "ابحث في المحاضرات والمقاطع…",
  "search.playlists": "قوائم التشغيل",
  "search.tracks": "المقاطع",
  "search.noResults": "لا توجد نتائج",
  "search.error": "تعذّر البحث.",
};

const en: Catalog = {
  "common.appName": "Nour",
  "common.search": "Search",
  "common.loading": "Loading…",
  "common.back": "Back",
  "nav.home": "Home",
  "nav.library": "Library",
  "nav.quran": "Quran",
  "nav.adhkar": "Adhkar",
  "nav.prayer": "Prayer times",
  "home.heroTitle": "Nour",
  "home.heroSubtitle": "Listen to lectures and the Quran, and follow prayer times",
  "home.library": "Library",
  "home.continueListening": "Continue listening",
  "home.dhikrOfDay": "Dhikr of the day",
  "home.clearHistory": "Clear history",
  "home.sortNewest": "Newest",
  "home.sortAZ": "A–Z",
  "home.sortTracks": "Track count",
  "theme.toggleToLight": "Light mode",
  "theme.toggleToDark": "Dark mode",
  "search.placeholder": "Search lectures and tracks…",
  "search.playlists": "Playlists",
  "search.tracks": "Tracks",
  "search.noResults": "No results",
  "search.error": "Search failed.",
};

const MESSAGES: Record<Locale, Catalog> = { ar, en };

export function dirFor(locale: Locale): Dir {
  return locale === "ar" ? "rtl" : "ltr";
}

// Pure lookup: requested locale → Arabic fallback → the key itself. `vars`
// interpolates `{name}` placeholders.
export function translate(
  locale: Locale,
  key: string,
  vars?: Record<string, string | number>,
): string {
  let value = MESSAGES[locale][key] ?? MESSAGES.ar[key] ?? key;
  if (vars) {
    for (const [name, v] of Object.entries(vars)) {
      value = value.replace(`{${name}}`, String(v));
    }
  }
  return value;
}

// Live locale state backed by `nour.locale`. Applies `lang`/`dir` to <html> so
// the whole document flips with the locale. Defaults to Arabic until storage loads.
export function useI18n(): {
  locale: Locale;
  dir: Dir;
  setLocale: (locale: Locale) => void;
  t: (key: string, vars?: Record<string, string | number>) => string;
} {
  const [locale, setLocaleState] = useState<Locale>("ar");

  useEffect(() => {
    void get("nour.locale").then(setLocaleState);
    return watch("nour.locale", setLocaleState);
  }, []);

  useEffect(() => {
    document.documentElement.lang = locale;
    document.documentElement.dir = dirFor(locale);
  }, [locale]);

  const setLocale = useCallback((next: Locale) => void set("nour.locale", next), []);
  const t = useCallback(
    (key: string, vars?: Record<string, string | number>) => translate(locale, key, vars),
    [locale],
  );

  return { locale, dir: dirFor(locale), setLocale, t };
}
