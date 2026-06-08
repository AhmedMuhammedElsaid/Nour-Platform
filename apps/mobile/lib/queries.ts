import { queryOptions } from "@tanstack/react-query";
import type { Playlist } from "@repo/shared-core/schemas/playlist";
import type { Category } from "@repo/shared-core/schemas/category";
import type { Azkar } from "@repo/shared-core/schemas/azkar";
import type { Locale } from "@repo/shared-core/schemas/locale";

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
