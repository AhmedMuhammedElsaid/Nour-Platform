import {
  groupAyahsByPage,
  toArabicIndicDigits,
  ayahMarker,
} from "@/features/quran/lib/page-groups";

const ayahs = [
  { numberGlobal: 1, ayahInSurah: 1, page: 1, juz: 1 },
  { numberGlobal: 2, ayahInSurah: 2, page: 1, juz: 1 },
  { numberGlobal: 3, ayahInSurah: 3, page: 2, juz: 1 },
  { numberGlobal: 4, ayahInSurah: 4, page: 2, juz: 1 },
  { numberGlobal: 5, ayahInSurah: 5, page: 3, juz: 2 },
] as never[];

describe("groupAyahsByPage", () => {
  it("splits into groups on page change, preserving ayah order", () => {
    const groups = groupAyahsByPage(ayahs);
    expect(groups).toHaveLength(3);
    expect(groups[0]).toMatchObject({ page: 1, juz: 1 });
    expect(groups[0]!.ayahs.map((a) => a.numberGlobal)).toEqual([1, 2]);
    expect(groups[1]).toMatchObject({ page: 2, juz: 1 });
    expect(groups[1]!.ayahs.map((a) => a.numberGlobal)).toEqual([3, 4]);
    expect(groups[2]).toMatchObject({ page: 3, juz: 2 });
    expect(groups[2]!.ayahs.map((a) => a.numberGlobal)).toEqual([5]);
  });

  it("uses the first ayah's juz for the group", () => {
    const mixedJuzOnSamePage = [
      { numberGlobal: 1, ayahInSurah: 1, page: 1, juz: 1 },
      { numberGlobal: 2, ayahInSurah: 2, page: 1, juz: 2 },
    ] as never[];
    const groups = groupAyahsByPage(mixedJuzOnSamePage);
    expect(groups).toHaveLength(1);
    expect(groups[0]!.juz).toBe(1);
  });

  it("returns [] for an empty ayah list", () => {
    expect(groupAyahsByPage([])).toEqual([]);
  });
});

describe("toArabicIndicDigits", () => {
  it("converts Western digits to Arabic-Indic", () => {
    expect(toArabicIndicDigits(107)).toBe("١٠٧");
    expect(toArabicIndicDigits(0)).toBe("٠");
    expect(toArabicIndicDigits(7)).toBe("٧");
  });
});

describe("ayahMarker", () => {
  it("prefixes the Arabic-Indic ayah number with U+06DD", () => {
    expect(ayahMarker(7)).toBe("۝٧");
    expect(ayahMarker(107)).toBe("۝١٠٧");
  });
});
