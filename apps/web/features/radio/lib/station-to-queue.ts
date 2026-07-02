import type { QueueTrack } from "@repo/ui/blocks/player-context";

import type { StationView } from "../types";

// A radio station is a one-item, infinite-duration queue. `isLive` makes the
// player hide the seek bar (LIVE pill instead) and skip resume-position logic.
// `playlistTitle` shows under the station name in the now-playing bar.
export function stationToQueueTrack(
  station: StationView,
  livePrefix: string,
): QueueTrack {
  return {
    id: `radio:${station.slug}`,
    title: station.name,
    mediaUrl: station.streamUrl,
    ...(station.image ? { coverUrl: station.image } : {}),
    playlistTitle: station.city ? `${livePrefix} · ${station.city}` : livePrefix,
    isLive: true,
  };
}
