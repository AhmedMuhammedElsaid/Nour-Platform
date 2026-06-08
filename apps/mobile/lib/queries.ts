import { queryOptions } from "@tanstack/react-query";
import type { Playlist } from "@repo/shared-core/schemas/playlist";

import { getJson } from "@/lib/api";

export const playlistsQuery = () =>
  queryOptions({
    queryKey: ["playlists"] as const,
    queryFn: () => getJson<Playlist[]>("/playlists"),
  });
