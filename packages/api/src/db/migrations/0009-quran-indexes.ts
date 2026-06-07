import { getDb } from "../client";
import { QuranSurahModel } from "../models/quran-surah.model";
import { QuranAyahModel } from "../models/quran-ayah.model";
import { QuranEditionModel } from "../models/quran-edition.model";
import { QuranTranslationModel } from "../models/quran-translation.model";
import { QuranReciterModel } from "../models/quran-reciter.model";

/*
 * Migration 0009: register indexes for the Quran collections.
 *
 * Additive and idempotent — Mongoose skips indexes that already exist. The
 * Quran collections are isolated from existing platform data, so this does NOT
 * touch playlists/categories/tracks/azkar. `scripts/seed-quran.ts` also calls
 * this up() so the reader works after a standalone seed without running the
 * full `pnpm migrate` chain (which must never run against live embedded-locale
 * data).
 */
export const name = "0009-quran-indexes";

export async function up(): Promise<void> {
  await getDb();
  await Promise.all([
    QuranSurahModel.ensureIndexes(),
    QuranAyahModel.ensureIndexes(),
    QuranEditionModel.ensureIndexes(),
    QuranTranslationModel.ensureIndexes(),
    QuranReciterModel.ensureIndexes(),
  ]);
}
