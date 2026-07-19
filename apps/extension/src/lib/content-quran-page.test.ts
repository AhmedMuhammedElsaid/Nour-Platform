import { describe, expect, it, vi } from "vitest";

// content.ts imports ./api + ./storage at module load; stub them so importing
// the pure fetchPageReader mapping doesn't drag in browser/network globals
// (package has no jsdom — see vitest.config.ts `environment: "node"`), and so
// the mocked getJson response drives the assertions below.
const getJson = vi.fn();
vi.mock("./api", () => ({ getJson: (...args: unknown[]) => getJson(...args), assetUrl: (p: string) => p }));
vi.mock("./storage", () => ({ get: vi.fn(), set: vi.fn() }));

import { fetchPageReader, type ReaderAyah } from "./content";

function makeAyah(overrides: Partial<ReaderAyah> = {}): ReaderAyah {
  return {
    surah: 114,
    ayahInSurah: 1,
    numberGlobal: 6231,
    textUthmani: "قُلْ أَعُوذُ بِرَبِّ النَّاسِ",
    words: [],
    translation: null,
    audioUrl: "https://everyayah.com/114001.mp3",
    page: 604,
    juz: 30,
    ...overrides,
  };
}

describe("fetchPageReader", () => {
  it("flattens each raw segment's nested surah object into surahNumber/surahNameAr/surahNameEn", async () => {
    getJson.mockResolvedValueOnce({
      page: 604,
      juz: 30,
      prevPage: 603,
      nextPage: null,
      segments: [
        {
          surah: { number: 113, name: { ar: "الفلق", en: "Al-Falaq" }, meaning: "The Daybreak", bismillahPre: true },
          showBismillah: false,
          ayahs: [makeAyah({ surah: 113, ayahInSurah: 5, numberGlobal: 6230 })],
        },
        {
          surah: { number: 114, name: { ar: "الناس", en: "An-Nas" }, meaning: "Mankind", bismillahPre: true },
          showBismillah: true,
          ayahs: [makeAyah()],
        },
      ],
      translationEdition: { dir: "ltr" },
    });

    const page = await fetchPageReader(604);

    expect(page.page).toBe(604);
    expect(page.juz).toBe(30);
    expect(page.prevPage).toBe(603);
    expect(page.nextPage).toBeNull();
    expect(page.translationDir).toBe("ltr");
    expect(page.segments).toHaveLength(2);
    expect(page.segments[0]).toMatchObject({
      surahNumber: 113,
      surahNameAr: "الفلق",
      surahNameEn: "Al-Falaq",
      showBismillah: false,
    });
    expect(page.segments[1]).toMatchObject({
      surahNumber: 114,
      surahNameAr: "الناس",
      surahNameEn: "An-Nas",
      showBismillah: true,
    });
  });

  it("gates showBismillah per segment, independent of the surah's own bismillahPre", async () => {
    getJson.mockResolvedValueOnce({
      page: 187,
      juz: 9,
      prevPage: 186,
      nextPage: 188,
      segments: [
        {
          // At-Tawbah (9): bismillahPre is false — showBismillah must stay false
          // even though this segment opens the surah's first ayah on the page.
          surah: { number: 9, name: { ar: "التوبة", en: "At-Tawbah" }, meaning: "The Repentance", bismillahPre: false },
          showBismillah: false,
          ayahs: [makeAyah({ surah: 9, ayahInSurah: 1, numberGlobal: 1235, page: 187, juz: 9 })],
        },
      ],
      translationEdition: null,
    });

    const page = await fetchPageReader(187);
    expect(page.segments[0]?.showBismillah).toBe(false);
    expect(page.segments[0]?.bismillahPre).toBe(false);
    // No translation edition resolved (e.g. Arabic-only request) falls back to ltr.
    expect(page.translationDir).toBe("ltr");
  });

  it("passes locale/translation/reciter params through to getJson", async () => {
    getJson.mockResolvedValueOnce({
      page: 1,
      juz: 1,
      prevPage: null,
      nextPage: 2,
      segments: [],
      translationEdition: { dir: "rtl" },
    });

    await fetchPageReader(1, { translation: "en.sahih", reciter: "qatami" });

    expect(getJson).toHaveBeenCalledWith(
      "/quran/page/1",
      expect.objectContaining({ locale: "ar", translation: "en.sahih", reciter: "qatami" }),
    );
  });
});
