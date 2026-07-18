import type { ReaderAyah } from "@repo/api/schemas/quran";

export type AyahPageGroup = { page: number; juz: number; ayahs: ReaderAyah[] };

// Groups a surah's ayahs (already ordered by numberGlobal) into per-mushaf-page
// blocks using each ayah's `page` field (1-604, already shipped on every
// ReaderAyah) — no new API call. Single pass, split whenever `page` changes;
// a group's `juz` is its first ayah's juz (mirrors the physical Madani
// mushaf, where a page's header juz is the juz its first line belongs to).
// Ported verbatim from apps/mobile/features/quran/lib/page-groups.ts.
export function groupAyahsByPage(ayahs: ReaderAyah[]): AyahPageGroup[] {
  const groups: AyahPageGroup[] = [];
  for (const ayah of ayahs) {
    const last = groups[groups.length - 1];
    if (last && last.page === ayah.page) {
      last.ayahs.push(ayah);
    } else {
      groups.push({ page: ayah.page, juz: ayah.juz, ayahs: [ayah] });
    }
  }
  return groups;
}

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
