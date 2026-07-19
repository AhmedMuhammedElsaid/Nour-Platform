import { queryOptions } from "@tanstack/react-query";
import type { Playlist } from "@repo/shared-core/schemas/playlist";
import type { Category } from "@repo/shared-core/schemas/category";
import type { Azkar } from "@repo/shared-core/schemas/azkar";
import type { Locale } from "@repo/shared-core/schemas/locale";
import type {
  QuranSurah,
  QuranEdition,
  QuranReciter,
  SurahReader,
  PageReader,
} from "@repo/shared-core/schemas/quran";
import type { RadioStation } from "@repo/shared-core/schemas/radio";

import { getJson } from "@/lib/api";
import { readSurah } from "@/lib/quran-offline-store";
import type { PlaylistDetailResponse } from "@/lib/types";

export const playlistsQuery = (locale: Locale) =>
  queryOptions({
    queryKey: ["playlists", locale] as const,
    queryFn: () => getJson<Playlist[]>("/playlists", { locale }),
  });

export const categoriesQuery = () =>
  queryOptions({
    queryKey: ["categories"] as const,
    queryFn: () => getJson<Category[]>("/categories"),
  });

export const adhkarListQuery = () =>
  queryOptions({
    queryKey: ["adhkar"] as const,
    queryFn: () => getJson<Azkar[]>("/adhkar"),
  });

export const adhkarDetailQuery = (slug: string, locale: Locale) =>
  queryOptions({
    queryKey: ["adhkar", slug, locale] as const,
    queryFn: () => getJson<Azkar>(`/adhkar/${encodeURIComponent(slug)}`, { locale }),
  });

export const playlistDetailQuery = (slug: string, locale: Locale) =>
  queryOptions({
    queryKey: ["playlist", slug, locale] as const,
    queryFn: () =>
      getJson<PlaylistDetailResponse>(
        `/playlists/${encodeURIComponent(slug)}`,
        { locale },
      ),
  });

// ── Radio ──────────────────────────────────────────────────────────────────

// Live radio stations. Dates arrive as ISO strings over /api/v1 (withIsoDates);
// the RadioStation type is used loosely here (the UI never reads the dates), the
// same way playlistsQuery types the wire as Playlist.
export const radioStationsQuery = () =>
  queryOptions({
    queryKey: ["radio", "stations"] as const,
    queryFn: () => getJson<RadioStation[]>("/radio"),
  });

// ── Quran ──────────────────────────────────────────────────────────────────

export const quranSurahsQuery = () =>
  queryOptions({
    queryKey: ["quran", "surahs"] as const,
    // The surah index is immutable reference data — cache it for the session.
    staleTime: Infinity,
    queryFn: () => getJson<QuranSurah[]>("/quran/surahs"),
  });

export const quranEditionsQuery = () =>
  queryOptions({
    queryKey: ["quran", "editions"] as const,
    staleTime: Infinity,
    queryFn: () => getJson<QuranEdition[]>("/quran/editions"),
  });

export const quranRecitersQuery = () =>
  queryOptions({
    queryKey: ["quran", "reciters"] as const,
    staleTime: Infinity,
    queryFn: () => getJson<QuranReciter[]>("/quran/reciters"),
  });

export const quranSurahReaderQuery = (
  surah: number,
  locale: Locale,
  translationSlug: string,
  reciterSlug: string,
) =>
  queryOptions({
    queryKey: ["quran", "surah", surah, locale, translationSlug, reciterSlug] as const,
    staleTime: Infinity,
    queryFn: async () => {
      try {
        return await getJson<SurahReader>(`/quran/surah/${surah}`, {
          locale,
          // Empty translationSlug ⇒ omit the param so the server resolves the
          // locale default (ar.muyassar / en.sahih).
          ...(translationSlug ? { translation: translationSlug } : {}),
          reciter: reciterSlug,
        });
      } catch (err) {
        // Offline fallback: surah payloads are persisted per-file, not in the
        // AsyncStorage query-cache blob (see lib/quran-offline-store.ts), so
        // a network failure can still resolve from the last successful
        // prefetch for this exact identity before giving up.
        const cached = await readSurah({ surah, locale, translationSlug, reciterSlug });
        if (cached) return cached;
        throw err;
      }
    },
  });

// Mushaf (Safha) page mode — fetches a whole Madani mushaf page (1-604), which
// may span multiple surahs (PageReader.segments). No offline fallback: the
// per-file offline store (lib/quran-offline-store.ts) is keyed by surah, not
// page — page-mode reading is a known offline gap for v1 (see mobile
// APP_CONTEXT.md).
export const quranPageReaderQuery = (
  page: number,
  locale: Locale,
  translationSlug: string,
  reciterSlug: string,
) =>
  queryOptions({
    queryKey: ["quran", "page", page, locale, translationSlug, reciterSlug] as const,
    staleTime: Infinity,
    queryFn: () =>
      getJson<PageReader>(`/quran/page/${page}`, {
        locale,
        ...(translationSlug ? { translation: translationSlug } : {}),
        reciter: reciterSlug,
      }),
  });
