import {
  findAllSurahs,
  findSurah,
  findAyahsBySurah,
  findAyahsByJuz,
  findAyahsByPage,
  findSurahsByNumbers,
  findTranslationsForGlobalRange,
  findEditions,
  findEditionBySlug,
  findReciters,
  findReciterBySlug,
  findTafsir,
} from "../repositories/quran.repo";
import { AppError } from "../errors";
import { QURAN } from "../cache/tags";
import { IMMUTABLE_TTL_SECONDS, cachedRead } from "../cache/cached";
import type {
  QuranSurah,
  QuranEdition,
  QuranReciter,
  ReaderAyah,
  SurahReader,
  TafsirResult,
  PageReader,
  PageSegment,
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
 *
 * Every read here is wrapped in unstable_cache under the QURAN tag with a
 * 24 h TTL (../cache/cached). Content only changes via `pnpm seed:quran`,
 * which runs outside Next and cannot revalidateTag — after a reseed the TTL is
 * what eventually clears these entries, so allow a day (or redeploy).
 *
 * No DTO in this service carries a Date, so none of these need reviveDates.
 */

/*
 * Cache-key note for the reader functions: the translation edition and reciter
 * are resolved from `opts` INSIDE the read, and both fall back to a
 * locale-derived default (DEFAULT_TRANSLATION_BY_LOCALE / DEFAULT_RECITER_SLUG).
 * All three of `translationSlug`, `reciterSlug` and `locale` therefore change
 * the payload and all three must be key parts. The empty string marks "not
 * supplied" and cannot collide with a real slug, which is never empty.
 */
function readerOptsKey(opts: SurahReaderOptions): string[] {
  return [opts.translationSlug ?? "", opts.reciterSlug ?? "", opts.locale ?? ""];
}

const DEFAULT_TRANSLATION_BY_LOCALE: Record<Locale, string> = {
  ar: "ar.muyassar",
  en: "en.sahih",
};
const DEFAULT_RECITER_SLUG = "qatami";
const MIN_PAGE = 1;
const MAX_PAGE = 604;
const DEFAULT_TAFSIR_BY_LOCALE: Record<Locale, string> = {
  ar: "ar.saadi",
  en: "en.ibnkathir",
};

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
    ...(doc.arabicName ? { arabicName: doc.arabicName } : {}),
    ...(doc.image ? { image: doc.image } : {}),
    ...(doc.style ? { style: doc.style } : {}),
    ...(typeof doc.order === "number" ? { order: doc.order } : {}),
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

// Key completeness (all three): no arguments, unfiltered repo reads.
export async function listSurahs(): Promise<QuranSurah[]> {
  return cachedRead(["quran", "surahs"], [QURAN], IMMUTABLE_TTL_SECONDS, async () => {
    const docs = await findAllSurahs();
    return docs.map(surahToDto);
  });
}

export async function listEditions(): Promise<QuranEdition[]> {
  return cachedRead(["quran", "editions"], [QURAN], IMMUTABLE_TTL_SECONDS, async () => {
    const docs = await findEditions();
    return docs.map(editionToDto);
  });
}

export async function listReciters(): Promise<QuranReciter[]> {
  return cachedRead(["quran", "reciters"], [QURAN], IMMUTABLE_TTL_SECONDS, async () => {
    const docs = await findReciters();
    return docs.map(reciterToDto);
  });
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

// Key completeness: surahNumber + every readerOptsKey part. The NotFound throw
// stays inside the cached body; unstable_cache only writes an entry after the
// callback resolves, so the error path is never cached.
export async function getSurahReader(
  surahNumber: number,
  opts: SurahReaderOptions,
): Promise<SurahReader> {
  return cachedRead(
    ["quran", "surah", String(surahNumber), ...readerOptsKey(opts)],
    [QURAN],
    IMMUTABLE_TTL_SECONDS,
    async () => {
      const surah = await findSurah(surahNumber);
      if (!surah) throw AppError.NotFound("Surah");

      const ayahDocs = await findAyahsBySurah(surahNumber);
      const { edition, reciter, translationByGlobal } =
        await resolveEditionAndReciter(ayahDocs, opts);

      return {
        surah: surahToDto(surah),
        ayahs: ayahDocs.map((a) => ayahToReaderDto(a, translationByGlobal, reciter)),
        translationEdition: edition ? editionToDto(edition) : null,
        reciter: reciter ? reciterToDto(reciter) : null,
      };
    },
  );
}

// Key completeness: numberGlobal picks the row; editionSlug and locale between
// them pick the edition (locale only via DEFAULT_TAFSIR_BY_LOCALE when
// editionSlug is absent). Both are key parts.
export async function getTafsir(
  numberGlobal: number,
  opts: { locale?: Locale; editionSlug?: string },
): Promise<TafsirResult | null> {
  return cachedRead(
    [
      "quran",
      "tafsir",
      String(numberGlobal),
      opts.editionSlug ?? "",
      opts.locale ?? "",
    ],
    [QURAN],
    IMMUTABLE_TTL_SECONDS,
    async () => {
      const slug = opts.editionSlug ?? DEFAULT_TAFSIR_BY_LOCALE[opts.locale ?? "ar"];
      const edition = await findEditionBySlug(slug);
      if (!edition) return null;
      const row = await findTafsir(edition.slug, numberGlobal);
      if (!row) return null;
      return { edition: editionToDto(edition), html: row.text };
    },
  );
}

// Key completeness: juz + every readerOptsKey part.
export async function getJuzReader(
  juz: number,
  opts: SurahReaderOptions,
): Promise<ReaderAyah[]> {
  return cachedRead(
    ["quran", "juz", String(juz), ...readerOptsKey(opts)],
    [QURAN],
    IMMUTABLE_TTL_SECONDS,
    async () => {
      const ayahDocs = await findAyahsByJuz(juz);
      if (ayahDocs.length === 0) throw AppError.NotFound("Juz");

      const { reciter, translationByGlobal } = await resolveEditionAndReciter(
        ayahDocs,
        opts,
      );

      return ayahDocs.map((a) => ayahToReaderDto(a, translationByGlobal, reciter));
    },
  );
}

// Cross-surah Madani mushaf page reader: a page's ayahs are pre-filtered by
// `page` (unlike getSurahReader/getJuzReader, which filter by surah/juz), then
// split into per-surah PageSegments in a single pass — same consecutive-run
// grouping idea as the client-side groupAyahsByPage helpers, but keyed on
// `surah` change instead of `page` change (the input here is already one page).
export async function getPageReader(
  page: number,
  opts: SurahReaderOptions,
): Promise<PageReader> {
  // Input validation stays OUTSIDE the cache: it is a pure guard on the
  // argument, so there is nothing to memoise and no reason to spin up a cache
  // lookup for a request that is already invalid.
  if (!Number.isInteger(page) || page < MIN_PAGE || page > MAX_PAGE) {
    throw AppError.Validation([], "Invalid page number.");
  }

  // Key completeness: page + every readerOptsKey part.
  return cachedRead(
    ["quran", "page", String(page), ...readerOptsKey(opts)],
    [QURAN],
    IMMUTABLE_TTL_SECONDS,
    async () => {
      const ayahDocs = await findAyahsByPage(page);
      if (ayahDocs.length === 0) throw AppError.NotFound("Page");

      const { edition, reciter, translationByGlobal } =
        await resolveEditionAndReciter(ayahDocs, opts);

      const surahNumbers = Array.from(new Set(ayahDocs.map((a) => a.surah)));
      const surahDocs = await findSurahsByNumbers(surahNumbers);
      const surahByNumber = new Map(surahDocs.map((s) => [s.number, s]));

      const segments: PageSegment[] = [];
      for (const ayahDoc of ayahDocs) {
        const readerAyah = ayahToReaderDto(ayahDoc, translationByGlobal, reciter);
        const last = segments[segments.length - 1];
        if (last && last.surah.number === ayahDoc.surah) {
          last.ayahs.push(readerAyah);
          continue;
        }

        const surahDoc = surahByNumber.get(ayahDoc.surah);
        if (!surahDoc) {
          // Data-integrity gap (ayah references a surah row that doesn't exist) —
          // not a caller input error, so this is a 500, not a 400/404.
          throw AppError.Internal(`Surah ${ayahDoc.surah} not found for page ${page}.`);
        }

        segments.push({
          surah: {
            number: surahDoc.number,
            name: {
              ar: (surahDoc.name as { ar: string }).ar,
              en: (surahDoc.name as { en: string }).en,
            },
            meaning: surahDoc.meaning,
            bismillahPre: surahDoc.bismillahPre,
            ayahCount: surahDoc.ayahCount,
          },
          showBismillah:
            ayahDoc.ayahInSurah === 1 && surahDoc.bismillahPre && surahDoc.number !== 1,
          ayahs: [readerAyah],
        });
      }

      return {
        page,
        juz: ayahDocs[0]!.juz,
        prevPage: page > MIN_PAGE ? page - 1 : null,
        nextPage: page < MAX_PAGE ? page + 1 : null,
        segments,
        translationEdition: edition ? editionToDto(edition) : null,
        reciter: reciter ? reciterToDto(reciter) : null,
      };
    },
  );
}
