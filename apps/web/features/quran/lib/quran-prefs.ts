import { z } from "zod";

import { readDeviceStore, writeDeviceStore } from "@/lib/device-store";

export type ReaderLayout = "list" | "mushaf";

const quranPrefsSchema = z.object({
  translationSlug: z.string().default("en.sahih"),
  reciterSlug: z.string().default("qatami"),
  showTranslation: z.boolean().default(true),
  showWordByWord: z.boolean().default(false),
  fontScale: z.number().default(1), // 1 = base; clamped 0.8..1.6 by the settings UI
  layout: z.enum(["list", "mushaf"]).default("list"),
});
export type QuranPrefs = z.infer<typeof quranPrefsSchema>;

const KEY = "nour.quran.prefs";

export const DEFAULT_PREFS: QuranPrefs = quranPrefsSchema.parse({});

export function loadPrefs(): QuranPrefs {
  return readDeviceStore(KEY, quranPrefsSchema, DEFAULT_PREFS);
}

export function savePrefs(prefs: QuranPrefs): void {
  writeDeviceStore(KEY, prefs);
}
