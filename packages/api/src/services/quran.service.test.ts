import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../repositories/quran.repo", () => ({
  findAllSurahs: vi.fn(),
  findSurah: vi.fn(),
  findAyahsBySurah: vi.fn(),
  findAyahsByJuz: vi.fn(),
  findAyahsByPage: vi.fn(),
  findSurahsByNumbers: vi.fn(),
  findTranslationsForGlobalRange: vi.fn(),
  findEditions: vi.fn(),
  findEditionBySlug: vi.fn(),
  findReciters: vi.fn(),
  findReciterBySlug: vi.fn(),
  findTafsir: vi.fn(),
  findEditionsByType: vi.fn(),
}));

const repo = await import("../repositories/quran.repo");
const service = await import("./quran.service");

function surahDoc(over: Record<string, unknown> = {}): any {
  return {
    _id: { toString: () => "s1" },
    number: 1,
    name: { ar: "الفاتحة", en: "Al-Fatihah" },
    meaning: "The Opener",
    revelationPlace: "meccan",
    ayahCount: 7,
    pageStart: 1,
    pageEnd: 1,
    bismillahPre: true,
    ...over,
  };
}

function ayahDoc(over: Record<string, unknown> = {}): any {
  return {
    _id: { toString: () => "a1" },
    surah: 1,
    ayahInSurah: 1,
    numberGlobal: 1,
    juz: 1,
    hizb: 1,
    page: 1,
    sajda: false,
    textUthmani: "بِسْمِ ٱللَّهِ",
    words: [{ position: 1, arabic: "بِسْمِ", glossEn: "In (the) name" }],
    ...over,
  };
}

const editionDoc = {
  _id: { toString: () => "e1" },
  slug: "en.sahih",
  language: "en",
  name: "Sahih International",
  author: "Sahih International",
  type: "translation",
  dir: "ltr",
};

const reciterDoc = {
  _id: { toString: () => "r1" },
  slug: "alafasy",
  name: "Mishary Rashid Alafasy",
  audioBase: "https://everyayah.com/data/Alafasy_128kbps/",
};

beforeEach(() => vi.clearAllMocks());

describe("quran.service", () => {
  describe("listSurahs", () => {
    it("returns all surahs as DTOs", async () => {
      vi.mocked(repo.findAllSurahs).mockResolvedValueOnce([surahDoc()]);
      const result = await service.listSurahs();
      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        number: 1,
        name: { ar: "الفاتحة", en: "Al-Fatihah" },
      });
    });
  });

  describe("getSurahReader", () => {
    it("joins translation by numberGlobal and computes the audio URL", async () => {
      vi.mocked(repo.findSurah).mockResolvedValueOnce(surahDoc());
      vi.mocked(repo.findAyahsBySurah).mockResolvedValueOnce([
        ayahDoc({ ayahInSurah: 1, numberGlobal: 1 }),
        ayahDoc({ ayahInSurah: 2, numberGlobal: 2, textUthmani: "ٱلْحَمْدُ" }),
      ]);
      vi.mocked(repo.findEditionBySlug).mockResolvedValueOnce(editionDoc as any);
      vi.mocked(repo.findReciterBySlug).mockResolvedValueOnce(reciterDoc as any);
      vi.mocked(repo.findTranslationsForGlobalRange).mockResolvedValueOnce([
        { editionSlug: "en.sahih", numberGlobal: 1, text: "In the name of Allah" } as any,
        { editionSlug: "en.sahih", numberGlobal: 2, text: "All praise is due to Allah" } as any,
      ]);

      const result = await service.getSurahReader(1, {
        translationSlug: "en.sahih",
        reciterSlug: "alafasy",
      });

      expect(result.ayahs[0]!.translation).toBe("In the name of Allah");
      expect(result.ayahs[0]!.audioUrl).toBe(
        "https://everyayah.com/data/Alafasy_128kbps/001001.mp3",
      );
      expect(result.ayahs[1]!.audioUrl).toBe(
        "https://everyayah.com/data/Alafasy_128kbps/001002.mp3",
      );
    });

    it("returns null translation when the edition has no row for an ayah", async () => {
      vi.mocked(repo.findSurah).mockResolvedValueOnce(surahDoc());
      vi.mocked(repo.findAyahsBySurah).mockResolvedValueOnce([ayahDoc()]);
      vi.mocked(repo.findEditionBySlug).mockResolvedValueOnce(editionDoc as any);
      vi.mocked(repo.findReciterBySlug).mockResolvedValueOnce(reciterDoc as any);
      vi.mocked(repo.findTranslationsForGlobalRange).mockResolvedValueOnce([]);

      const result = await service.getSurahReader(1, { translationSlug: "en.sahih" });
      expect(result.ayahs[0]!.translation).toBeNull();
    });

    it("returns null audioUrl when no reciter resolves", async () => {
      vi.mocked(repo.findSurah).mockResolvedValueOnce(surahDoc());
      vi.mocked(repo.findAyahsBySurah).mockResolvedValueOnce([ayahDoc()]);
      vi.mocked(repo.findEditionBySlug).mockResolvedValueOnce(null);
      vi.mocked(repo.findReciterBySlug).mockResolvedValueOnce(null);
      vi.mocked(repo.findTranslationsForGlobalRange).mockResolvedValueOnce([]);

      const result = await service.getSurahReader(1, {});
      expect(result.ayahs[0]!.audioUrl).toBeNull();
      expect(result.translationEdition).toBeNull();
      expect(result.reciter).toBeNull();
    });

    it("throws NotFound for an unknown surah", async () => {
      vi.mocked(repo.findSurah).mockResolvedValueOnce(null);
      await expect(service.getSurahReader(999, {})).rejects.toThrow();
    });
  });

  describe("getPageReader", () => {
    it("page 1 is a single Al-Fatiha segment with no bismillah flag, no prev page", async () => {
      vi.mocked(repo.findAyahsByPage).mockResolvedValueOnce([
        ayahDoc({ surah: 1, ayahInSurah: 1, numberGlobal: 1, juz: 1, page: 1 }),
        ayahDoc({
          surah: 1,
          ayahInSurah: 2,
          numberGlobal: 2,
          juz: 1,
          page: 1,
          textUthmani: "ٱلْحَمْدُ لِلَّهِ",
        }),
      ]);
      vi.mocked(repo.findEditionBySlug).mockResolvedValueOnce(null);
      vi.mocked(repo.findReciterBySlug).mockResolvedValueOnce(null);
      vi.mocked(repo.findTranslationsForGlobalRange).mockResolvedValueOnce([]);
      vi.mocked(repo.findSurahsByNumbers).mockResolvedValueOnce([surahDoc({ number: 1 })]);

      const result = await service.getPageReader(1, {});

      expect(result.page).toBe(1);
      expect(result.juz).toBe(1);
      expect(result.prevPage).toBeNull();
      expect(result.nextPage).toBe(2);
      expect(result.segments).toHaveLength(1);
      expect(result.segments[0]!.surah.number).toBe(1);
      expect(result.segments[0]!.showBismillah).toBe(false);
      expect(result.segments[0]!.ayahs).toHaveLength(2);
      expect(vi.mocked(repo.findSurahsByNumbers)).toHaveBeenCalledWith([1]);
    });

    it("splits a page spanning two surahs into two segments; the new surah's bismillah shows", async () => {
      // Al-Fil (105, 5 ayahs) ends and Quraysh (106, 4 ayahs, has a bismillah)
      // begins on the same Madani mushaf page — a realistic short-surah pair.
      vi.mocked(repo.findAyahsByPage).mockResolvedValueOnce([
        ayahDoc({ surah: 105, ayahInSurah: 5, numberGlobal: 6224, juz: 30, page: 601 }),
        ayahDoc({ surah: 106, ayahInSurah: 1, numberGlobal: 6225, juz: 30, page: 601 }),
        ayahDoc({ surah: 106, ayahInSurah: 2, numberGlobal: 6226, juz: 30, page: 601 }),
      ]);
      vi.mocked(repo.findEditionBySlug).mockResolvedValueOnce(null);
      vi.mocked(repo.findReciterBySlug).mockResolvedValueOnce(null);
      vi.mocked(repo.findTranslationsForGlobalRange).mockResolvedValueOnce([]);
      vi.mocked(repo.findSurahsByNumbers).mockResolvedValueOnce([
        surahDoc({ number: 105, meaning: "The Elephant", bismillahPre: true }),
        surahDoc({ number: 106, meaning: "Quraysh", bismillahPre: true }),
      ]);

      const result = await service.getPageReader(601, {});

      expect(result.segments).toHaveLength(2);
      expect(result.segments[0]!.surah.number).toBe(105);
      expect(result.segments[0]!.showBismillah).toBe(false);
      expect(result.segments[0]!.ayahs).toHaveLength(1);
      expect(result.segments[1]!.surah.number).toBe(106);
      expect(result.segments[1]!.showBismillah).toBe(true);
      expect(result.segments[1]!.ayahs).toHaveLength(2);
    });

    it("does not show bismillah for Al-Fatiha even though bismillahPre-like content is ayah 1", async () => {
      vi.mocked(repo.findAyahsByPage).mockResolvedValueOnce([
        ayahDoc({ surah: 1, ayahInSurah: 1, numberGlobal: 1, juz: 1, page: 1 }),
      ]);
      vi.mocked(repo.findEditionBySlug).mockResolvedValueOnce(null);
      vi.mocked(repo.findReciterBySlug).mockResolvedValueOnce(null);
      vi.mocked(repo.findTranslationsForGlobalRange).mockResolvedValueOnce([]);
      vi.mocked(repo.findSurahsByNumbers).mockResolvedValueOnce([
        surahDoc({ number: 1, bismillahPre: true }),
      ]);

      const result = await service.getPageReader(1, {});
      expect(result.segments[0]!.showBismillah).toBe(false);
    });

    it("page 604 has no next page", async () => {
      vi.mocked(repo.findAyahsByPage).mockResolvedValueOnce([
        ayahDoc({ surah: 114, ayahInSurah: 1, numberGlobal: 6236, juz: 30, page: 604 }),
      ]);
      vi.mocked(repo.findEditionBySlug).mockResolvedValueOnce(null);
      vi.mocked(repo.findReciterBySlug).mockResolvedValueOnce(null);
      vi.mocked(repo.findTranslationsForGlobalRange).mockResolvedValueOnce([]);
      vi.mocked(repo.findSurahsByNumbers).mockResolvedValueOnce([
        surahDoc({ number: 114, bismillahPre: true }),
      ]);

      const result = await service.getPageReader(604, {});
      expect(result.nextPage).toBeNull();
      expect(result.prevPage).toBe(603);
    });

    it.each([0, 605, 1.5])("throws AppError for invalid page %s", async (page) => {
      await expect(service.getPageReader(page, {})).rejects.toThrow();
      expect(vi.mocked(repo.findAyahsByPage)).not.toHaveBeenCalled();
    });

    it("throws NotFound when the page has no ayahs", async () => {
      vi.mocked(repo.findAyahsByPage).mockResolvedValueOnce([]);
      await expect(service.getPageReader(1, {})).rejects.toThrow();
    });
  });
});

describe("getTafsir", () => {
  const saadi = {
    _id: { toString: () => "t1" }, slug: "ar.saadi", language: "ar",
    name: "Tafsir al-Saadi", author: "al-Saadi", type: "tafsir", dir: "rtl",
  };

  it("resolves the locale-default edition and returns html", async () => {
    vi.mocked(repo.findEditionBySlug).mockResolvedValueOnce(saadi as any);
    vi.mocked(repo.findTafsir).mockResolvedValueOnce({
      editionSlug: "ar.saadi", numberGlobal: 1, text: "<p>تفسير</p>",
    } as any);

    const res = await service.getTafsir(1, { locale: "ar" });
    expect(res).not.toBeNull();
    expect(res!.edition.slug).toBe("ar.saadi");
    expect(res!.html).toBe("<p>تفسير</p>");
    expect(vi.mocked(repo.findEditionBySlug)).toHaveBeenCalledWith("ar.saadi");
  });

  it("honors an explicit editionSlug over the locale default", async () => {
    vi.mocked(repo.findEditionBySlug).mockResolvedValueOnce({
      ...saadi, slug: "en.ibnkathir", language: "en", dir: "ltr",
    } as any);
    vi.mocked(repo.findTafsir).mockResolvedValueOnce({
      editionSlug: "en.ibnkathir", numberGlobal: 1, text: "<p>Tafsir</p>",
    } as any);

    const res = await service.getTafsir(1, { locale: "ar", editionSlug: "en.ibnkathir" });
    expect(res!.edition.slug).toBe("en.ibnkathir");
    expect(vi.mocked(repo.findEditionBySlug)).toHaveBeenCalledWith("en.ibnkathir");
  });

  it("returns null when the edition is missing", async () => {
    vi.mocked(repo.findEditionBySlug).mockResolvedValueOnce(null);
    const res = await service.getTafsir(1, { locale: "en" });
    expect(res).toBeNull();
  });

  it("returns null when there is no tafsir row for the ayah", async () => {
    vi.mocked(repo.findEditionBySlug).mockResolvedValueOnce(saadi as any);
    vi.mocked(repo.findTafsir).mockResolvedValueOnce(null);
    const res = await service.getTafsir(1, { locale: "ar" });
    expect(res).toBeNull();
  });
});
