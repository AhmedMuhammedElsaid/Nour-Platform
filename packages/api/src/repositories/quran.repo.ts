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
  return QuranReciterModel.find({}).sort({ name: 1 }).lean<QuranReciterDoc[]>();
}

export async function findReciterBySlug(
  slug: string,
): Promise<QuranReciterDoc | null> {
  await getDb();
  return QuranReciterModel.findOne({ slug }).lean<QuranReciterDoc>();
}
