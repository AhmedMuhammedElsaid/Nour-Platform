import { z } from "zod";

export const revelationPlaceSchema = z.enum(["meccan", "medinan"]);
export type RevelationPlace = z.infer<typeof revelationPlaceSchema>;

// ── Surah ────────────────────────────────────────────────────────────────────
export const quranSurahSchema = z.object({
  number: z.number().int().min(1).max(114),
  name: z.object({ ar: z.string().min(1), en: z.string().min(1) }),
  meaning: z.string().min(1), // English meaning of the surah name
  revelationPlace: revelationPlaceSchema,
  ayahCount: z.number().int().min(1),
  pageStart: z.number().int().min(1).max(604),
  pageEnd: z.number().int().min(1).max(604),
  bismillahPre: z.boolean(), // false only for At-Tawbah (9)
});
export type QuranSurah = z.infer<typeof quranSurahSchema>;

// ── Word (embedded in ayah) ───────────────────────────────────────────────────
export const quranWordSchema = z.object({
  position: z.number().int().min(1),
  arabic: z.string().min(1),
  transliteration: z.string().optional(),
  glossEn: z.string().optional(),
});
export type QuranWord = z.infer<typeof quranWordSchema>;

// ── Ayah ──────────────────────────────────────────────────────────────────────
export const quranAyahSchema = z.object({
  surah: z.number().int().min(1).max(114),
  ayahInSurah: z.number().int().min(1),
  numberGlobal: z.number().int().min(1).max(6236),
  juz: z.number().int().min(1).max(30),
  hizb: z.number().int().min(1),
  page: z.number().int().min(1).max(604),
  sajda: z.boolean(),
  textUthmani: z.string().min(1),
  words: z.array(quranWordSchema),
});
export type QuranAyah = z.infer<typeof quranAyahSchema>;

// ── Edition (translation; tafsir editions land in Phase 2) ────────────────────
export const editionTypeSchema = z.enum(["translation", "tafsir"]);
export type EditionType = z.infer<typeof editionTypeSchema>;

export const quranEditionSchema = z.object({
  slug: z.string().min(1), // e.g. "en.sahih", "ar.muyassar"
  language: z.string().min(2).max(5),
  name: z.string().min(1),
  author: z.string().min(1),
  type: editionTypeSchema,
  dir: z.enum(["rtl", "ltr"]),
});
export type QuranEdition = z.infer<typeof quranEditionSchema>;

export const quranTranslationSchema = z.object({
  editionSlug: z.string().min(1),
  numberGlobal: z.number().int().min(1).max(6236),
  text: z.string(),
});
export type QuranTranslation = z.infer<typeof quranTranslationSchema>;

// ── Reciter ───────────────────────────────────────────────────────────────────
export const quranReciterSchema = z.object({
  slug: z.string().min(1), // e.g. "alafasy"
  name: z.string().min(1),
  arabicName: z.string().optional(), // Arabic display name, e.g. "مشاري العفاسي"
  image: z.string().optional(), // static /public path (e.g. "/reciters/alafasy.png") or absolute URL; falls back to a gradient+initials avatar
  style: z.string().optional(),
  order: z.number().int().optional(), // display order on the "Readers" shelf (ascending; falls back to name sort)
  audioBase: z.string().url(), // e.g. "https://everyayah.com/data/Alafasy_128kbps/"
});
export type QuranReciter = z.infer<typeof quranReciterSchema>;

// ── Reader DTOs (what the service returns to the web layer) ────────────────────
export const readerWordSchema = quranWordSchema;

export const readerAyahSchema = z.object({
  surah: z.number().int(),
  ayahInSurah: z.number().int(),
  numberGlobal: z.number().int(),
  juz: z.number().int(),
  page: z.number().int(),
  sajda: z.boolean(),
  textUthmani: z.string(),
  words: z.array(readerWordSchema),
  translation: z.string().nullable(), // null when the requested edition has no row
  audioUrl: z.string().nullable(), // null when no reciter resolved
});
export type ReaderAyah = z.infer<typeof readerAyahSchema>;

export const surahReaderSchema = z.object({
  surah: quranSurahSchema,
  ayahs: z.array(readerAyahSchema),
  translationEdition: quranEditionSchema.nullable(),
  reciter: quranReciterSchema.nullable(),
});
export type SurahReader = z.infer<typeof surahReaderSchema>;

export const quranTafsirSchema = z.object({
  editionSlug: z.string().min(1),
  numberGlobal: z.number().int().min(1).max(6236),
  text: z.string(), // tafsir HTML
});
export type QuranTafsir = z.infer<typeof quranTafsirSchema>;

export const tafsirResultSchema = z.object({
  edition: quranEditionSchema,
  html: z.string(),
});
export type TafsirResult = z.infer<typeof tafsirResultSchema>;
