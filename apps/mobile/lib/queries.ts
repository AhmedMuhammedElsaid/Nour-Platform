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
} from "@repo/shared-core/schemas/quran";

import { getJson } from "@/lib/api";
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
    queryFn: () =>
      getJson<SurahReader>(`/quran/surah/${surah}`, {
        locale,
        // Empty translationSlug ⇒ omit the param so the server resolves the
        // locale default (ar.muyassar / en.sahih).
        ...(translationSlug ? { translation: translationSlug } : {}),
        reciter: reciterSlug,
      }),
  });
