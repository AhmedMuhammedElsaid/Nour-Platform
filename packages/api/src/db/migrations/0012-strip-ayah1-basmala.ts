import { stripLeadingBasmala } from "@repo/shared-core/quran/basmala";

import { getDb } from "../client";
import { QuranAyahModel } from "../models/quran-ayah.model";

/*
 * Migration 0012: remove the Basmala the source dataset prepends to ayah 1.
 *
 * `scripts/seed-quran.ts` seeds from Al-Quran Cloud's `quran-uthmani`, which
 * embeds "بسم الله الرحمن الرحيم" inside the TEXT of ayah 1 for every surah
 * except Al-Fatiha (1, where it is the ayah) and At-Tawbah (9, which has none).
 * All three surfaces also render a standalone Basmala as chrome above ayah 1,
 * so it printed twice — in Mushaf mode and in list mode.
 *
 * Idempotent: `stripLeadingBasmala` is a no-op on already-cleaned text and on
 * the two excluded surahs, and only changed documents are written. Safe to
 * re-run. Run with `--only 0012-strip-ayah1-basmala`, never the full chain.
 *
 * Cross-check after running: a cleaned ayah 1 should equal the concatenation of
 * its own `words[].arabic` — the word-level data comes from quran.com, which
 * already excludes the Basmala.
 */
export const name = "0012-strip-ayah1-basmala";

export async function up(): Promise<void> {
  await getDb();

  const ayahs = await QuranAyahModel.find(
    { ayahInSurah: 1, surah: { $nin: [1, 9] } },
    { surah: 1, ayahInSurah: 1, textUthmani: 1 },
  ).lean();

  const ops = ayahs.flatMap((ayah) => {
    const stripped = stripLeadingBasmala(ayah.textUthmani, ayah.surah, ayah.ayahInSurah);
    if (stripped === ayah.textUthmani) return [];
    return [
      {
        updateOne: {
          filter: { _id: ayah._id },
          update: { $set: { textUthmani: stripped } },
        },
      },
    ];
  });

  if (ops.length === 0) {
    console.warn(`[${name}] no ayahs needed stripping (already clean).`);
    return;
  }

  await QuranAyahModel.bulkWrite(ops);
  console.warn(`[${name}] stripped the prepended Basmala from ${ops.length} ayahs.`);
}
