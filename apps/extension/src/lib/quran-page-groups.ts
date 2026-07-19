// Pure Mushaf (Safha) display helpers. `groupAyahsByPage` (client-side,
// single-surah page grouping) was removed 2026-07 once the reader switched to
// GET /api/v1/quran/page/:n, which returns segments already split server-side
// across surah boundaries — see fetchPageReader in ./content.ts.

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
// (ayah-row.tsx renders "۝{ayahInSurah}" with plain digits).
export function ayahMarker(ayahInSurah: number): string {
  return `۝${toArabicIndicDigits(ayahInSurah)}`;
}
