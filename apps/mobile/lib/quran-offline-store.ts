import { Directory, File, Paths } from "expo-file-system";
import type { Locale } from "@repo/shared-core/schemas/locale";
import type { SurahReader } from "@repo/shared-core/schemas/quran";

// Per-surah JSON files under documentDirectory/quran-offline/ — the
// out-of-blob half of the offline-prefetch cache-persistence fix (ADR 0013
// follow-up). createAsyncStoragePersister writes the ENTIRE dehydrated
// TanStack Query cache as ONE AsyncStorage value; with all 114 surah reader
// payloads embedded, that blob plausibly exceeds Android AsyncStorage's
// ~2MB CursorWindow per-row read limit — the write would succeed but the
// restore would throw, and PersistQueryClientProvider treats a throwing
// restore as "no cache", silently killing offline-first at full-Quran scale.
// Quran surah queries are excluded from persistence (see _layout.tsx's
// shouldDehydrateQuery) and instead round-trip through these small
// individual files, one per (surah, locale, translation, reciter) identity.

export type SurahIdentity = {
  surah: number;
  locale: Locale;
  translationSlug: string;
  reciterSlug: string;
};

function getDir(): Directory {
  return new Directory(Paths.document, "quran-offline");
}

// translationSlug can be "" (server-resolves-the-locale-default) — encode
// that explicitly so the filename never has an empty segment.
function fileName(id: SurahIdentity): string {
  const translation = id.translationSlug || "default";
  return `surah-${id.surah}-${id.locale}-${translation}-${id.reciterSlug}.json`;
}

function getFile(id: SurahIdentity): File {
  return new File(getDir(), fileName(id));
}

/** Writes a surah payload to its per-identity file. Non-fatal on failure. */
export async function writeSurah(id: SurahIdentity, data: SurahReader): Promise<void> {
  try {
    const dir = getDir();
    if (!dir.exists) dir.create({ idempotent: true, intermediates: true });
    getFile(id).write(JSON.stringify(data));
  } catch {
    // Storage unavailable — non-fatal; the in-memory session cache (and a
    // future retry) still cover this surah.
  }
}

/** Reads a surah payload for an exact identity, or null if absent/corrupt. */
export async function readSurah(id: SurahIdentity): Promise<SurahReader | null> {
  try {
    const file = getFile(id);
    if (!file.exists) return null;
    const raw = await file.text();
    return JSON.parse(raw) as SurahReader;
  } catch {
    return null;
  }
}

/**
 * Deletes every stored surah file that does NOT match the current
 * locale/translation/reciter identity, so switching translation or reciter
 * doesn't leak orphaned files. Surah number is intentionally excluded from
 * the match — every surah file for the current combo is kept.
 */
export async function pruneStaleSurahs(
  current: Omit<SurahIdentity, "surah">,
): Promise<void> {
  try {
    const dir = getDir();
    if (!dir.exists) return;
    const suffix = `-${current.locale}-${current.translationSlug || "default"}-${current.reciterSlug}.json`;
    for (const entry of dir.list()) {
      if (!(entry instanceof File)) continue;
      if (!entry.name.startsWith("surah-")) continue;
      if (!entry.name.endsWith(suffix)) entry.delete();
    }
  } catch {
    // Storage unavailable — non-fatal; orphaned files just sit unused.
  }
}
