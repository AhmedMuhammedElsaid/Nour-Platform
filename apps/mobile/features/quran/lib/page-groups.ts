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

// Inline ayah-end marker for Mushaf mode: the ayah's in-surah number in
// Arabic-Indic digits, e.g. ayahMarker(7) === "٧".
//
// Deliberately NOT prefixed with U+06DD (ARABIC END OF AYAH), unlike the web
// copy of this function. The bundled Uthmani font already draws Arabic-Indic
// digits in their enclosed end-of-ayah ornament, so adding U+06DD rendered a
// SECOND, empty ornament next to the numbered one — device-confirmed on the
// A72 by magnifying a screenshot: every marker was a numbered ornament plus a
// blank one. Web's font composes U+06DD with the following digits into a
// single ornament instead, so apps/web/features/quran/lib/page-groups.ts keeps
// the prefix — don't "sync" these two without re-checking on a device.
export function ayahMarker(ayahInSurah: number): string {
  return toArabicIndicDigits(ayahInSurah);
}
