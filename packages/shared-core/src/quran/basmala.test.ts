import { describe, expect, it } from "vitest";

import { stripLeadingBasmala } from "./basmala";

// Every Arabic fixture here is spelled as explicit codepoints, never pasted.
// Uthmani combining marks are invisible to review and a retyped copy silently
// differs — the exact failure mode of `e246d7f`, where a swapped shadda/fatha
// pair shipped. Escapes make the mark order auditable in a diff.
const SHADDA = "ّ";
const FATHA = "َ";
const KASRA = "ِ";
const SUKUN = "ْ";
const DAMMA = "ُ";
const SUPERSCRIPT_ALEF = "ٰ";
const ALEF_WASLA = "ٱ";

// بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ
const BISMILLAH_UTHMANI = [
  `ب${KASRA}س${SUKUN}م${KASRA}`,
  `${ALEF_WASLA}لل${SHADDA}${FATHA}ه${KASRA}`,
  `${ALEF_WASLA}لر${SHADDA}${FATHA}ح${SUKUN}م${FATHA}${SUPERSCRIPT_ALEF}ن${KASRA}`,
  `${ALEF_WASLA}لر${SHADDA}${FATHA}ح${KASRA}يم${KASRA}`,
].join(" ");

// ٱلْحَمْدُ لِلَّهِ — Al-Kahf 18:1 without the prefix (the owner's screenshot).
const KAHF_1 = [
  `${ALEF_WASLA}ل${SUKUN}ح${FATHA}م${SUKUN}د${DAMMA}`,
  `ل${KASRA}ل${SHADDA}${FATHA}ه${KASRA}`,
].join(" ");

describe("stripLeadingBasmala", () => {
  it("strips the dataset's prepended Basmala from ayah 1", () => {
    expect(stripLeadingBasmala(`${BISMILLAH_UTHMANI} ${KAHF_1}`, 18, 1)).toBe(KAHF_1);
  });

  it("is idempotent — re-running over cleaned text is a no-op", () => {
    const once = stripLeadingBasmala(`${BISMILLAH_UTHMANI} ${KAHF_1}`, 18, 1);
    expect(stripLeadingBasmala(once, 18, 1)).toBe(once);
  });

  it("matches regardless of combining-mark ORDER (the e246d7f bug class)", () => {
    // Visually identical to the canonical form, byte-different. A matcher that
    // compared against a literal would miss this entirely.
    const swapped = BISMILLAH_UTHMANI.replaceAll(SHADDA + FATHA, FATHA + SHADDA);

    expect(swapped).not.toBe(BISMILLAH_UTHMANI);
    expect(stripLeadingBasmala(`${swapped} ${KAHF_1}`, 18, 1)).toBe(KAHF_1);
  });

  it("matches an undecorated plain-alef spelling", () => {
    // بسم الله الرحمن الرحيم — no marks, plain alef instead of alef wasla.
    const plain = "بسم الله الرحمن الرحيم";
    expect(stripLeadingBasmala(`${plain} ${KAHF_1}`, 2, 1)).toBe(KAHF_1);
  });

  it("leaves Al-Fatiha 1:1 alone — there the Basmala IS the ayah", () => {
    expect(stripLeadingBasmala(BISMILLAH_UTHMANI, 1, 1)).toBe(BISMILLAH_UTHMANI);
  });

  it("leaves At-Tawbah 9:1 alone — that surah has no Basmala", () => {
    const text = `${BISMILLAH_UTHMANI} ${KAHF_1}`;
    expect(stripLeadingBasmala(text, 9, 1)).toBe(text);
  });

  it("leaves An-Naml 27:30 alone — a genuine mid-surah Basmala", () => {
    const text = `${BISMILLAH_UTHMANI} ${KAHF_1}`;
    expect(stripLeadingBasmala(text, 27, 30)).toBe(text);
  });

  it("leaves an ayah that never had the prefix untouched", () => {
    expect(stripLeadingBasmala(KAHF_1, 18, 1)).toBe(KAHF_1);
  });

  it("never blanks an ayah whose whole text is the Basmala", () => {
    expect(stripLeadingBasmala(BISMILLAH_UTHMANI, 18, 1)).toBe(BISMILLAH_UTHMANI);
  });
});
