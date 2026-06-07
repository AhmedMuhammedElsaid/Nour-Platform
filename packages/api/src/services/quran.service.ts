import {
  findAllSurahs,
  findSurah,
  findAyahsBySurah,
  findAyahsByJuz,
  findTranslationsForGlobalRange,
  findEditions,
  findEditionBySlug,
  findReciters,
  findReciterBySlug,
} from "../repositories/quran.repo";
import { AppError } from "../errors";
import type {
  QuranSurah,
  QuranEdition,
  QuranReciter,
  ReaderAyah,
  SurahReader,
} from "../schemas/quran";
import type { Locale } from "../schemas/locale";
import type { QuranSurahDoc } from "../db/models/quran-surah.model";
import type { QuranAyahDoc } from "../db/models/quran-ayah.model";
import type { QuranEditionDoc } from "../db/models/quran-edition.model";
import type { QuranReciterDoc } from "../db/models/quran-reciter.model";

/*
 * Quran service — public, read-only. No requireSession: Quran content is public
 * and immutable. Audio URLs are COMPUTED from the reciter base, never stored.
 * Default translation edition is locale-derived but caller-overridable.
 */

const DEFAULT_TRANSLATION_BY_LOCALE: Record<Locale, string> = {
  ar: "ar.muyassar",
  en: "en.sahih",
};
const DEFAULT_RECITER_SLUG = "alafasy";

function pad3(n: number): string {
  return n.toString().padStart(3, "0");
}

// everyayah.com layout: <base><pad3(surah)><pad3(ayahInSurah)>.mp3
function audioUrlFor(base: string, surah: number, ayahInSurah: number): string {
  return `${base}${pad3(surah)}${pad3(ayahInSurah)}.mp3`;
}

function surahToDto(doc: QuranSurahDoc): QuranSurah {
  return {
    number: doc.number,
    name: {
      ar: (doc.name as { ar: string }).ar,
      en: (doc.name as { en: string }).en,
    },
    meaning: doc.meaning,
    revelationPlace: doc.revelationPlace as "meccan" | "medinan",
    ayahCount: doc.ayahCount,
    pageStart: doc.pageStart,
    pageEnd: doc.pageEnd,
    bismillahPre: doc.bismillahPre,
  };
}

function editionToDto(doc: QuranEditionDoc): QuranEdition {
  return {
    slug: doc.slug,
    language: doc.language,
    name: doc.name,
    author: doc.author,
    type: doc.type as "translation" | "tafsir",
    dir: doc.dir as "rtl" | "ltr",
  };
}

function reciterToDto(doc: QuranReciterDoc): QuranReciter {
  return {
    slug: doc.slug,
    name: doc.name,
    ...(doc.style ? { style: doc.style } : {}),
    audioBase: doc.audioBase,
  };
}

// Maps a lean ayah doc + resolved translation/reciter into the reader DTO.
function ayahToReaderDto(
  a: QuranAyahDoc,
  translationByGlobal: Map<number, string>,
  reciter: QuranReciterDoc | null,
): ReaderAyah {
  return {
    surah: a.surah,
    ayahInSurah: a.ayahInSurah,
    numberGlobal: a.numberGlobal,
    juz: a.juz,
    page: a.page,
    sajda: a.sajda,
    textUthmani: a.textUthmani,
    words: (a.words ?? []).map((w) => ({
      position: (w as { position: number }).position,
      arabic: (w as { arabic: string }).arabic,
      ...((w as { transliteration?: string }).transliteration
        ? { transliteration: (w as { transliteration: string }).transliteration }
        : {}),
      ...((w as { glossEn?: string }).glossEn
        ? { glossEn: (w as { glossEn: string }).glossEn }
        : {}),
    })),
    translation: translationByGlobal.get(a.numberGlobal) ?? null,
    audioUrl: reciter ? audioUrlFor(reciter.audioBase, a.surah, a.ayahInSurah) : null,
  };
}

export async function listSurahs(): Promise<QuranSurah[]> {
  const docs = await findAllSurahs();
  return docs.map(surahToDto);
}

export async function listEditions(): Promise<QuranEdition[]> {
  const docs = await findEditions();
  return docs.map(editionToDto);
}

export async function listReciters(): Promise<QuranReciter[]> {
  const docs = await findReciters();
  return docs.map(reciterToDto);
}

export interface SurahReaderOptions {
  translationSlug?: string;
  reciterSlug?: string;
  locale?: Locale;
}

// Resolves the translation edition + reciter and builds a numberGlobal→text map.
async function resolveEditionAndReciter(
  ayahDocs: QuranAyahDoc[],
  opts: SurahReaderOptions,
): Promise<{
  edition: QuranEditionDoc | null;
  reciter: QuranReciterDoc | null;
  translationByGlobal: Map<number, string>;
}> {
  const translationSlug =
    opts.translationSlug ?? DEFAULT_TRANSLATION_BY_LOCALE[opts.locale ?? "ar"];
  const reciterSlug = opts.reciterSlug ?? DEFAULT_RECITER_SLUG;

  const [edition, reciter] = await Promise.all([
    findEditionBySlug(translationSlug),
    findReciterBySlug(reciterSlug),
  ]);

  const numberGlobals = ayahDocs.map((a) => a.numberGlobal);
  const translationRows = edition
    ? await findTranslationsForGlobalRange(edition.slug, numberGlobals)
    : [];
  const translationByGlobal = new Map(
    translationRows.map((t) => [t.numberGlobal, t.text]),
  );

  return { edition, reciter, translationByGlobal };
}

export async function getSurahReader(
  surahNumber: number,
  opts: SurahReaderOptions,
): Promise<SurahReader> {
  const surah = await findSurah(surahNumber);
  if (!surah) throw AppError.NotFound("Surah");

  const ayahDocs = await findAyahsBySurah(surahNumber);
  const { edition, reciter, translationByGlobal } = await resolveEditionAndReciter(
    ayahDocs,
    opts,
  );

  return {
    surah: surahToDto(surah),
    ayahs: ayahDocs.map((a) => ayahToReaderDto(a, translationByGlobal, reciter)),
    translationEdition: edition ? editionToDto(edition) : null,
    reciter: reciter ? reciterToDto(reciter) : null,
  };
}

export async function getJuzReader(
  juz: number,
  opts: SurahReaderOptions,
): Promise<ReaderAyah[]> {
  const ayahDocs = await findAyahsByJuz(juz);
  if (ayahDocs.length === 0) throw AppError.NotFound("Juz");

  const { reciter, translationByGlobal } = await resolveEditionAndReciter(
    ayahDocs,
    opts,
  );

  return ayahDocs.map((a) => ayahToReaderDto(a, translationByGlobal, reciter));
}
