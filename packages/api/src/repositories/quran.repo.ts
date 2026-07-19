import { getDb } from "../db/client";
import { QuranSurahModel, type QuranSurahDoc } from "../db/models/quran-surah.model";
import { QuranAyahModel, type QuranAyahDoc } from "../db/models/quran-ayah.model";
import {
  QuranEditionModel,
  type QuranEditionDoc,
} from "../db/models/quran-edition.model";
import {
  QuranTranslationModel,
  type QuranTranslationDoc,
} from "../db/models/quran-translation.model";
import {
  QuranReciterModel,
  type QuranReciterDoc,
} from "../db/models/quran-reciter.model";
import { QuranTafsirModel, type QuranTafsirDoc } from "../db/models/quran-tafsir.model";

export async function findAllSurahs(): Promise<QuranSurahDoc[]> {
  await getDb();
  return QuranSurahModel.find({}).sort({ number: 1 }).lean<QuranSurahDoc[]>();
}

export async function findSurah(number: number): Promise<QuranSurahDoc | null> {
  await getDb();
  return QuranSurahModel.findOne({ number }).lean<QuranSurahDoc>();
}

export async function findAyahsBySurah(surah: number): Promise<QuranAyahDoc[]> {
  await getDb();
  return QuranAyahModel.find({ surah }).sort({ ayahInSurah: 1 }).lean<QuranAyahDoc[]>();
}

export async function findAyahsByJuz(juz: number): Promise<QuranAyahDoc[]> {
  await getDb();
  return QuranAyahModel.find({ juz }).sort({ numberGlobal: 1 }).lean<QuranAyahDoc[]>();
}

export async function findAyahsByPage(page: number): Promise<QuranAyahDoc[]> {
  await getDb();
  return QuranAyahModel.find({ page }).sort({ numberGlobal: 1 }).lean<QuranAyahDoc[]>();
}

export async function findSurahsByNumbers(numbers: number[]): Promise<QuranSurahDoc[]> {
  await getDb();
  return QuranSurahModel.find({ number: { $in: numbers } }).lean<QuranSurahDoc[]>();
}

export async function findTranslationsForGlobalRange(
  editionSlug: string,
  numberGlobals: number[],
): Promise<QuranTranslationDoc[]> {
  await getDb();
  return QuranTranslationModel.find({
    editionSlug,
    numberGlobal: { $in: numberGlobals },
  }).lean<QuranTranslationDoc[]>();
}

export async function findEditions(): Promise<QuranEditionDoc[]> {
  await getDb();
  return QuranEditionModel.find({ type: "translation" })
    .sort({ language: 1 })
    .lean<QuranEditionDoc[]>();
}

export async function findEditionBySlug(
  slug: string,
): Promise<QuranEditionDoc | null> {
  await getDb();
  return QuranEditionModel.findOne({ slug }).lean<QuranEditionDoc>();
}

export async function findReciters(): Promise<QuranReciterDoc[]> {
  await getDb();
  // `order` is the curated shelf order (see scripts/reciter-catalogue.ts); name
  // is the tiebreaker for any reciter that predates the field / has no order.
  return QuranReciterModel.find({}).sort({ order: 1, name: 1 }).lean<QuranReciterDoc[]>();
}

export async function findReciterBySlug(
  slug: string,
): Promise<QuranReciterDoc | null> {
  await getDb();
  return QuranReciterModel.findOne({ slug }).lean<QuranReciterDoc>();
}

export async function findTafsir(
  editionSlug: string,
  numberGlobal: number,
): Promise<QuranTafsirDoc | null> {
  await getDb();
  return QuranTafsirModel.findOne({ editionSlug, numberGlobal }).lean<QuranTafsirDoc>();
}

export async function findEditionsByType(
  type: "translation" | "tafsir",
): Promise<QuranEditionDoc[]> {
  await getDb();
  return QuranEditionModel.find({ type }).sort({ language: 1 }).lean<QuranEditionDoc[]>();
}
