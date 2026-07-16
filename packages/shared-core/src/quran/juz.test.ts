import { describe, expect, it } from "vitest";

import { JUZ_BOUNDARIES, surahsInJuz } from "./juz";

describe("JUZ_BOUNDARIES", () => {
  it("has exactly 30 juz, numbered 1-30 in order", () => {
    expect(JUZ_BOUNDARIES).toHaveLength(30);
    JUZ_BOUNDARIES.forEach((b, i) => expect(b.juz).toBe(i + 1));
  });

  it("each juz starts where the previous one ended (no gaps/overlaps)", () => {
    for (let i = 1; i < JUZ_BOUNDARIES.length; i++) {
      const prev = JUZ_BOUNDARIES[i - 1]!;
      const cur = JUZ_BOUNDARIES[i]!;
      if (cur.startAyah === 1) {
        // New surah starts this juz — the previous juz must have ended on the
        // immediately preceding surah.
        expect(cur.startSurah).toBe(prev.endSurah + 1);
      } else {
        expect(cur.startSurah).toBe(prev.endSurah);
        expect(cur.startAyah).toBe(prev.endAyah + 1);
      }
    }
  });

  it("starts at 1:1 and ends at 114:6", () => {
    expect(JUZ_BOUNDARIES[0]).toMatchObject({ startSurah: 1, startAyah: 1 });
    expect(JUZ_BOUNDARIES[29]).toMatchObject({ endSurah: 114, endAyah: 6 });
  });
});

describe("surahsInJuz", () => {
  const surahs = [
    { number: 1, ayahCount: 7 },
    { number: 2, ayahCount: 286 },
    { number: 3, ayahCount: 200 },
  ];

  it("returns [] for an unknown juz number", () => {
    expect(surahsInJuz(0, surahs)).toEqual([]);
    expect(surahsInJuz(31, surahs)).toEqual([]);
  });

  it("juz 1: whole Al-Fatihah + partial Al-Baqarah (1-141)", () => {
    expect(surahsInJuz(1, surahs)).toEqual([
      { number: 1, ayahStart: 1, ayahEnd: 7 },
      { number: 2, ayahStart: 1, ayahEnd: 141 },
    ]);
  });

  it("juz 2: only the remainder of Al-Baqarah (142-252)", () => {
    expect(surahsInJuz(2, surahs)).toEqual([{ number: 2, ayahStart: 142, ayahEnd: 252 }]);
  });

  it("juz 3: tail of Al-Baqarah + head of Aal-e-Imran", () => {
    expect(surahsInJuz(3, surahs)).toEqual([
      { number: 2, ayahStart: 253, ayahEnd: 286 },
      { number: 3, ayahStart: 1, ayahEnd: 92 },
    ]);
  });
});
