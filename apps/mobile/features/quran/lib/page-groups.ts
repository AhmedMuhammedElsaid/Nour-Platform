// Digit/marker helpers for the Mushaf (Safha) page-reading mode. Page grouping
// itself is now server-side (GET /api/v1/quran/page/:n returns a PageReader
// with segments already split by surah/page) — see
// features/quran/lib/ayah-queue.ts (buildPageQueue) and
// features/quran/components/mushaf-page.tsx for the consumers.

const ARABIC_INDIC_DIGITS = ["٠", "١", "٢", "٣", "٤", "٥", "٦", "٧", "٨", "٩"];

// 107 -> "١٠٧"
export function toArabicIndicDigits(n: number): string {
  return String(n)
    .split("")
    .map((c) => ARABIC_INDIC_DIGITS[Number(c)] ?? c)
    .join("");
}

// Locale-aware numeral formatting for the Mushaf page/juz strip: Arabic-Indic
// digits in Arabic, plain Western digits otherwise (i18next `{{number}}`
// interpolates a string fine either way).
export function localizeDigits(n: number, locale: string): string {
  return locale.startsWith("ar") ? toArabicIndicDigits(n) : String(n);
}

// Inline ayah-end marker for Mushaf mode: U+06DD (ARABIC END OF AYAH) followed
// by the ayah's in-surah number in Arabic-Indic digits, e.g. "۝٧".
//
// HISTORY — this flipped twice, so read before changing it. While mobile
// bundled KFGQPC Uthmanic Script HAFS, the prefix had to be OMITTED (665897f):
// that font already draws Arabic-Indic digits inside their enclosed ornament,
// so U+06DD produced a SECOND, empty ornament (device-confirmed on the A72 by
// magnifying a screenshot). Mobile now bundles Amiri Quran instead, to match
// web — and Amiri composes U+06DD WITH the following digits into one ornament,
// exactly like web does. So the prefix is correct again here.
// The rule is not "web and mobile differ"; it is "the prefix follows the FONT".
// If the bundled font ever changes again, re-check this on a device.
export function ayahMarker(ayahInSurah: number): string {
  return `۝${toArabicIndicDigits(ayahInSurah)}`;
}
