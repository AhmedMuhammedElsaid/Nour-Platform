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

// Inline ayah-end marker for Mushaf mode: U+06DD (Quranic end-of-ayah
// ornament) followed by the ayah's in-surah number in Arabic-Indic digits,
// e.g. ayahMarker(7) === "۝٧". Upgrades list mode's Western-digit badge
// (ayah-row.tsx renders " ۝{ayahInSurah}" with plain digits).
export function ayahMarker(ayahInSurah: number): string {
  return `۝${toArabicIndicDigits(ayahInSurah)}`;
}
