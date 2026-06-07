import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../repositories/quran.repo", () => ({
  findAllSurahs: vi.fn(),
  findSurah: vi.fn(),
  findAyahsBySurah: vi.fn(),
  findAyahsByJuz: vi.fn(),
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
