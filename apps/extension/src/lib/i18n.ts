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
  "home.reciters": "القرّاء",
  "home.dhikrOfDay": "ذكر اليوم",
  "home.clearHistory": "مسح السجل",
  "home.sortNewest": "الأحدث",
  "home.sortAZ": "أبجدي",
  "home.sortTracks": "عدد المقاطع",
  "home.radio": "الإذاعة",
  "radio.live": "مباشر",
  "theme.toggleToLight": "الوضع الفاتح",
  "theme.toggleToDark": "الوضع الداكن",
  "search.placeholder": "ابحث في المحاضرات والمقاطع…",
  "search.playlists": "قوائم التشغيل",
  "search.tracks": "المقاطع",
  "search.noResults": "لا توجد نتائج",
  "search.error": "تعذّر البحث.",
  "adhkar.title": "الأذكار",
  "adhkar.subtitle": "أذكار الصباح والمساء وأدعية مأثورة",
  "adhkar.items": "أذكار",
  "adhkar.reset": "إعادة",
  "adhkar.completed": "تمّ",
  "adhkar.countLabel": "عدّ الذكر",
  "adhkar.scrollTop": "العودة للأعلى",
  "adhkar.error": "تعذّر تحميل الأذكار.",
  "quran.title": "القرآن الكريم",
  "quran.searchSurah": "ابحث عن سورة…",
  "quran.ayahs": "آية",
  "quran.settings": "إعدادات القراءة",
  "quran.showTranslation": "إظهار الترجمة",
  "quran.wordByWord": "كلمة بكلمة",
  "quran.fontSize": "حجم الخط",
  "quran.translation": "الترجمة",
  "quran.reciter": "القارئ",
  "quran.repeatAyah": "تكرار الآية",
  "quran.error": "تعذّر تحميل السورة.",
  "quran.continueReading": "متابعة القراءة",
  "quran.bookmarks": "الآيات المحفوظة",
  "quran.noBookmarks": "لا توجد آيات محفوظة بعد",
  "quran.tafsir": "التفسير",
  "quran.tafsirUnavailable": "التفسير غير متوفر لهذه الآية.",
  "prayer.title": "مواقيت الصلاة",
  "prayer.next": "التالية",
  "prayer.fajr": "الفجر",
  "prayer.sunrise": "الشروق",
  "prayer.dhuhr": "الظهر",
  "prayer.asr": "العصر",
  "prayer.maghrib": "المغرب",
  "prayer.isha": "العشاء",
  "prayer.changeCity": "تغيير المدينة",
  "prayer.myLocation": "موقعي الحالي",
  "prayer.calculation": "طريقة الحساب",
  "prayer.method": "المنهج",
  "prayer.madhab": "المذهب",
  "prayer.madhabStandard": "الجمهور",
  "prayer.madhabHanafi": "الحنفي",
  "prayer.adhan.title": "الأذان",
  "prayer.adhan.enable": "تفعيل الأذان",
  "prayer.adhan.perPrayer": "الأذان لكل صلاة",
  "prayer.adhan.volume": "مستوى الصوت",
  "prayer.azkar.title": "تذكير الأذكار",
  "prayer.azkar.enable": "تفعيل التذكير",
  "ui.close": "إغلاق",
  "home.location": "موقعك",
  "home.nextPrayer": "الصلاة القادمة",
  "home.clearListening": "مسح",
  "category.all": "الكل",
  "category.filterLabel": "تصفية التصنيفات",
  "category.sortLabel": "الترتيب",
  "category.sortAZ": "أ–ي",
  "playlist.playAll": "تشغيل الكل",
  "playlist.error": "تعذّر تحميل القائمة.",
  "playlist.back": "الرئيسية",
  "playlist.tracks": "مقطع",
  "player.play": "تشغيل",
  "player.pause": "إيقاف مؤقت",
  "player.next": "التالي",
  "player.prev": "السابق",
  "player.shuffle": "تشغيل عشوائي",
  "player.repeat": "تكرار",
  "player.mute": "كتم الصوت",
  "player.unmute": "إلغاء الكتم",
  "player.volume": "مستوى الصوت",
  "player.speed": "السرعة",
  "player.sleep": "مؤقت النوم",
  "player.sleepAtEnd": "نهاية المقطع",
  "player.sleepOff": "إيقاف",
  "player.settings": "إعدادات التشغيل",
  "player.queue": "قائمة التشغيل",
  "player.retry": "إعادة المحاولة",
  "player.close": "إغلاق المشغّل",
  "player.replay": "إعادة التشغيل من البداية",
  "player.position": "الموضع",
  "player.trackOf": "مقطع {index} / {total}",
  "ayah.play": "تشغيل الآية",
  "ayah.pause": "إيقاف الآية",
  "ayah.bookmark": "حفظ الآية",
  "ayah.unbookmark": "إزالة الإشارة",
  "ayah.tafsir": "التفسير",
  "footer.builtBy": "تطوير",
  "footer.linkedin": "الملف الشخصي على لينكدإن",
  "footer.github": "الملف الشخصي على جيت​هب",
  "footer.portfolio": "الموقع الشخصي",
  "footer.email": "البريد الإلكتروني",
  "footer.phone": "الهاتف",
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
  "home.reciters": "Readers",
  "home.dhikrOfDay": "Dhikr of the day",
  "home.clearHistory": "Clear history",
  "home.sortNewest": "Newest",
  "home.sortAZ": "A–Z",
  "home.sortTracks": "Track count",
  "home.radio": "Radio",
  "radio.live": "LIVE",
  "theme.toggleToLight": "Light mode",
  "theme.toggleToDark": "Dark mode",
  "search.placeholder": "Search lectures and tracks…",
  "search.playlists": "Playlists",
  "search.tracks": "Tracks",
  "search.noResults": "No results",
  "search.error": "Search failed.",
  "adhkar.title": "Adhkar",
  "adhkar.subtitle": "Morning & evening remembrances and supplications",
  "adhkar.items": "adhkar",
  "adhkar.reset": "Reset",
  "adhkar.completed": "Done",
  "adhkar.countLabel": "Count dhikr",
  "adhkar.scrollTop": "Back to top",
  "adhkar.error": "Could not load adhkar.",
  "quran.title": "The Holy Quran",
  "quran.searchSurah": "Search for a surah…",
  "quran.ayahs": "ayahs",
  "quran.settings": "Reading settings",
  "quran.showTranslation": "Show translation",
  "quran.wordByWord": "Word by word",
  "quran.fontSize": "Font size",
  "quran.translation": "Translation",
  "quran.reciter": "Reciter",
  "quran.repeatAyah": "Repeat ayah",
  "quran.error": "Could not load the surah.",
  "quran.continueReading": "Continue reading",
  "quran.bookmarks": "Saved ayahs",
  "quran.noBookmarks": "No saved ayahs yet",
  "quran.tafsir": "Tafsir",
  "quran.tafsirUnavailable": "Tafsir unavailable for this ayah.",
  "prayer.title": "Prayer Times",
  "prayer.next": "Next",
  "prayer.fajr": "Fajr",
  "prayer.sunrise": "Sunrise",
  "prayer.dhuhr": "Dhuhr",
  "prayer.asr": "Asr",
  "prayer.maghrib": "Maghrib",
  "prayer.isha": "Isha",
  "prayer.changeCity": "Change city",
  "prayer.myLocation": "My location",
  "prayer.calculation": "Calculation method",
  "prayer.method": "Method",
  "prayer.madhab": "Madhab",
  "prayer.madhabStandard": "Standard",
  "prayer.madhabHanafi": "Hanafi",
  "prayer.adhan.title": "Adhan",
  "prayer.adhan.enable": "Enable adhan",
  "prayer.adhan.perPrayer": "Per prayer",
  "prayer.adhan.volume": "Volume",
  "prayer.azkar.title": "Adhkar reminder",
  "prayer.azkar.enable": "Enable reminder",
  "ui.close": "Close",
  "home.location": "Your location",
  "home.nextPrayer": "Coming prayer",
  "home.clearListening": "Clear",
  "category.all": "All",
  "category.filterLabel": "Filter categories",
  "category.sortLabel": "Sort",
  "category.sortAZ": "A–Z",
  "playlist.playAll": "Play all",
  "playlist.error": "Could not load playlist.",
  "playlist.back": "Home",
  "playlist.tracks": "track",
  "player.play": "Play",
  "player.pause": "Pause",
  "player.next": "Next",
  "player.prev": "Previous",
  "player.shuffle": "Shuffle",
  "player.repeat": "Repeat",
  "player.mute": "Mute",
  "player.unmute": "Unmute",
  "player.volume": "Volume",
  "player.speed": "Speed",
  "player.sleep": "Sleep timer",
  "player.sleepAtEnd": "End of track",
  "player.sleepOff": "Off",
  "player.settings": "Playback settings",
  "player.queue": "Queue",
  "player.retry": "Retry",
  "player.close": "Close player",
  "player.replay": "Replay from start",
  "player.position": "Position",
  "player.trackOf": "Track {index} / {total}",
  "ayah.play": "Play ayah",
  "ayah.pause": "Pause ayah",
  "ayah.bookmark": "Bookmark ayah",
  "ayah.unbookmark": "Remove bookmark",
  "ayah.tafsir": "Tafsir",
  "footer.builtBy": "Built by",
  "footer.linkedin": "LinkedIn profile",
  "footer.github": "GitHub profile",
  "footer.portfolio": "Portfolio website",
  "footer.email": "Email",
  "footer.phone": "Phone",
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
