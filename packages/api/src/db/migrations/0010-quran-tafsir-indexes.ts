import { getDb } from "../client";
import { QuranTafsirModel } from "../models/quran-tafsir.model";

/*
 * Migration 0010: register the index for the quranTafsir collection.
 * Additive + idempotent. Run standalone (`pnpm migrate --only 0010-quran-tafsir-indexes`);
 * the quran seed also calls this up(). Never run the full chain on live embedded data.
 */
export const name = "0010-quran-tafsir-indexes";

export async function up(): Promise<void> {
  await getDb();
  await QuranTafsirModel.ensureIndexes();
}
