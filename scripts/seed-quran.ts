#!/usr/bin/env node

import { parseArgs } from "node:util";
import type { AnyBulkWriteOperation } from "mongoose";
import { getDb, disconnectDb } from "@repo/api/db/client";
import { QuranSurahModel } from "@repo/api/db/models/quran-surah.model";
import { QuranAyahModel } from "@repo/api/db/models/quran-ayah.model";
import { QuranEditionModel } from "@repo/api/db/models/quran-edition.model";
import { QuranTranslationModel } from "@repo/api/db/models/quran-translation.model";
import { QuranReciterModel } from "@repo/api/db/models/quran-reciter.model";
import { QuranTafsirModel } from "@repo/api/db/models/quran-tafsir.model";
import * as migration0009 from "@repo/api/db/migrations/0009-quran-indexes";
import * as migration0010 from "@repo/api/db/migrations/0010-quran-tafsir-indexes";
import { RECITERS } from "./reciter-catalogue";

/*
 * One-time Quran seed. Fetches open datasets at SEED TIME (run locally, not a
 * runtime dependency) and upserts them by natural key. Idempotent: re-running
 * overwrites. Refuses production without --force, mirroring seed-admin.ts.
 *
 * Sources (verify availability + licence before first run):
 *  - text + ayah metadata : Al-Quran Cloud  /quran/quran-uthmani
 *  - translation EN        : Al-Quran Cloud  /quran/en.sahih
 *  - translation AR        : Al-Quran Cloud  /quran/ar.muyassar
 *  - word-by-word          : quran.com v4    /verses/by_chapter/{n}?words=true
 *  - reciter (audio)       : everyayah.com   computed URLs (no rows stored)
 */

const ALQURAN = "https://api.alquran.cloud/v1/quran";
const QURANCOM = "https://api.quran.com/api/v4";

interface AqAyah {
  number: number; // global 1..6236
  text: string;
  numberInSurah: number;
  juz: number;
  page: number;
  hizbQuarter: number;
  sajda: boolean | { id: number };
}
interface AqSurah {
  number: number;
  name: string; // arabic
  englishName: string;
  englishNameTranslation: string;
  revelationType: "Meccan" | "Medinan";
  ayahs: AqAyah[];
}

interface QcWord {
  position: number;
  char_type_name: string;
  text_uthmani?: string;
  transliteration?: { text?: string | null };
  translation?: { text?: string | null };
}
interface QcVerse {
  verse_number: number;
  words: QcWord[];
}

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Fetch failed ${res.status} for ${url}`);
  const body = (await res.json()) as { data: T };
  return body.data;
}

// quran.com v4 returns the payload at the response root (e.g. { verses, pagination }),
// unlike Al-Quran Cloud's { code, status, data } envelope — do not unwrap `.data`.
async function getJsonRaw<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Fetch failed ${res.status} for ${url}`);
  return (await res.json()) as T;
}

async function seedSurahsAndAyahs(): Promise<void> {
  const quran = await getJson<{ surahs: AqSurah[] }>(`${ALQURAN}/quran-uthmani`);

  const surahOps: AnyBulkWriteOperation[] = quran.surahs.map((s) => ({
    updateOne: {
      filter: { number: s.number },
      update: {
        $set: {
          number: s.number,
          name: { ar: s.name, en: s.englishName },
          meaning: s.englishNameTranslation,
          revelationPlace: s.revelationType === "Meccan" ? "meccan" : "medinan",
          ayahCount: s.ayahs.length,
          pageStart: s.ayahs[0]?.page ?? 1,
          pageEnd: s.ayahs[s.ayahs.length - 1]?.page ?? 1,
          // Show a standalone Bismillah header before ayah 1 for every surah
          // EXCEPT Al-Fatihah (its Bismillah is ayah 1) and At-Tawbah (has none).
          bismillahPre: s.number !== 1 && s.number !== 9,
        },
      },
      upsert: true,
    },
  }));
  await QuranSurahModel.bulkWrite(surahOps);
  console.log(`[seed:quran] surahs upserted: ${surahOps.length}`);

  const ayahOps: AnyBulkWriteOperation[] = quran.surahs.flatMap((s) =>
    s.ayahs.map((a) => ({
      updateOne: {
        filter: { surah: s.number, ayahInSurah: a.numberInSurah },
        update: {
          $set: {
            surah: s.number,
            ayahInSurah: a.numberInSurah,
            numberGlobal: a.number,
            juz: a.juz,
            hizb: Math.ceil(a.hizbQuarter / 4),
            page: a.page,
            sajda: a.sajda !== false,
            textUthmani: a.text,
          },
        },
        upsert: true,
      },
    })),
  );
  await QuranAyahModel.bulkWrite(ayahOps);
  console.log(`[seed:quran] ayahs upserted: ${ayahOps.length}`);
}

async function seedWordByWord(): Promise<void> {
  // quran.com v4: per-chapter verses with words; map onto ayahs by surah+ayah.
  for (let chapter = 1; chapter <= 114; chapter++) {
    const url = `${QURANCOM}/verses/by_chapter/${chapter}?words=true&word_fields=text_uthmani,transliteration&per_page=300`;
    const data = await getJsonRaw<{ verses: QcVerse[] }>(url);
    // Loose bulk-op typing: Mongoose's DocumentArray type for the embedded
    // words[] subdocument isn't assignable from a plain object array here.
    const ops: AnyBulkWriteOperation[] = data.verses.map((v) => ({
      updateOne: {
        filter: { surah: chapter, ayahInSurah: v.verse_number },
        update: {
          $set: {
            words: v.words
              .filter((w) => w.char_type_name === "word")
              .map((w) => ({
                position: w.position,
                arabic: w.text_uthmani ?? "",
                ...(w.transliteration?.text
                  ? { transliteration: w.transliteration.text }
                  : {}),
                ...(w.translation?.text ? { glossEn: w.translation.text } : {}),
              })),
          },
        },
      },
    }));
    if (ops.length > 0) await QuranAyahModel.bulkWrite(ops);
    if (chapter % 20 === 0) {
      console.log(`[seed:quran] word-by-word: chapter ${chapter}/114`);
    }
  }
  console.log("[seed:quran] word-by-word complete");
}

async function seedTranslation(
  slug: string,
  edition: { language: string; name: string; author: string; dir: "rtl" | "ltr" },
): Promise<void> {
  await QuranEditionModel.updateOne(
    { slug },
    { $set: { slug, type: "translation", ...edition } },
    { upsert: true },
  );
  const data = await getJson<{ surahs: AqSurah[] }>(`${ALQURAN}/${slug}`);
  const ops: AnyBulkWriteOperation[] = data.surahs.flatMap((s) =>
    s.ayahs.map((a) => ({
      updateOne: {
        filter: { editionSlug: slug, numberGlobal: a.number },
        update: { $set: { editionSlug: slug, numberGlobal: a.number, text: a.text } },
        upsert: true,
      },
    })),
  );
  await QuranTranslationModel.bulkWrite(ops);
  console.log(`[seed:quran] translation ${slug}: ${ops.length} rows`);
}

interface QcTafsirRow {
  verse_key: string;
  text: string;
}

// quran.com v4 has no single "all ayat" tafsir endpoint — payload is at
// /tafsirs/{id}/by_chapter/{n} (root-level `tafsirs` array, not `.data`),
// paginated; per_page=300 covers even Al-Baqarah (286 ayat) in one request.
async function seedTafsir(
  slug: string,
  edition: { language: string; name: string; author: string; dir: "rtl" | "ltr" },
  tafsirId: number,
): Promise<void> {
  await QuranEditionModel.updateOne(
    { slug },
    { $set: { slug, type: "tafsir", ...edition } },
    { upsert: true },
  );
  const ayahs = await QuranAyahModel.find(
    {},
    { surah: 1, ayahInSurah: 1, numberGlobal: 1 },
  ).lean<{ surah: number; ayahInSurah: number; numberGlobal: number }[]>();
  const globalByKey = new Map(
    ayahs.map((a) => [`${a.surah}:${a.ayahInSurah}`, a.numberGlobal]),
  );

  let total = 0;
  for (let chapter = 1; chapter <= 114; chapter++) {
    const url = `${QURANCOM}/tafsirs/${tafsirId}/by_chapter/${chapter}?per_page=300`;
    const data = await getJsonRaw<{ tafsirs: QcTafsirRow[] }>(url);
    const ops: AnyBulkWriteOperation[] = data.tafsirs
      .map((t) => {
        const numberGlobal = globalByKey.get(t.verse_key);
        if (numberGlobal === undefined) return null;
        return {
          updateOne: {
            filter: { editionSlug: slug, numberGlobal },
            update: { $set: { editionSlug: slug, numberGlobal, text: t.text ?? "" } },
            upsert: true,
          },
        };
      })
      .filter((op): op is NonNullable<typeof op> => op !== null);
    if (ops.length > 0) await QuranTafsirModel.bulkWrite(ops);
    total += ops.length;
  }
  console.log(`[seed:quran] tafsir ${slug}: ${total} rows`);
}

// Reciter catalogue lives in scripts/reciter-catalogue.ts (shared with the
// lightweight `seed:reciters` upsert) so the two never drift.
async function seedReciter(): Promise<void> {
  for (const r of RECITERS) {
    await QuranReciterModel.updateOne(
      { slug: r.slug },
      {
        $set: {
          slug: r.slug,
          name: r.name,
          arabicName: r.arabicName,
          audioBase: r.audioBase,
          order: r.order,
          ...(r.image ? { image: r.image } : {}),
        },
      },
      { upsert: true },
    );
    console.log(`[seed:quran] reciter ${r.slug} upserted`);
  }
}

async function main(): Promise<void> {
  const { values } = parseArgs({
    options: { force: { type: "boolean" }, help: { type: "boolean", short: "h" } },
    strict: true,
  });
  if (values.help) {
    console.log(
      "Usage: pnpm seed:quran [--force]\n" +
        "Fetches open Quran datasets (Al-Quran Cloud + quran.com v4) and upserts them.\n" +
        "Idempotent. --force required when NODE_ENV=production.",
    );
    process.exit(0);
  }
  if (process.env.NODE_ENV === "production" && !values.force) {
    console.error("Refusing to run with NODE_ENV=production without --force.");
    process.exit(1);
  }

  await getDb();
  try {
    await seedSurahsAndAyahs();
    await seedWordByWord();
    await seedTranslation("en.sahih", {
      language: "en",
      name: "Sahih International",
      author: "Sahih International",
      dir: "ltr",
    });
    await seedTranslation("ar.muyassar", {
      language: "ar",
      name: "Tafsir al-Muyassar",
      author: "King Fahd Complex",
      dir: "rtl",
    });
    await seedReciter();
    await seedTafsir(
      "en.ibnkathir",
      { language: "en", name: "Tafsir Ibn Kathir (abridged)", author: "Ibn Kathir", dir: "ltr" },
      169,
    );
    await seedTafsir(
      "ar.saadi",
      { language: "ar", name: "Tafsir al-Saadi", author: "al-Saadi", dir: "rtl" },
      91,
    );
    await migration0009.up(); // ensure indexes (self-contained; no full migrate chain)
    await migration0010.up(); // ensure tafsir indexes (self-contained; no full migrate chain)
    console.log("[seed:quran] done.");
  } finally {
    await disconnectDb();
  }
}

main().catch((err) => {
  console.error("[seed:quran] fatal:", err);
  process.exit(1);
});
