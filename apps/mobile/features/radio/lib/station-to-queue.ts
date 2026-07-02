import type { QueueTrack } from "@/lib/player-context";
import { assetUrl } from "@/lib/api";

import type { StationView } from "../types";

// A radio station is a one-item, infinite-duration queue. `isLive` makes RNTP
// stream without a duration and the player UI show a LIVE badge (no seek/resume).
// Mirrors apps/web/features/radio/lib/station-to-queue.ts.
export function stationToQueueTrack(station: StationView, livePrefix: string): QueueTrack {
  return {
    id: `radio:${station.slug}`,
    title: station.name,
    mediaUrl: station.streamUrl,
    ...(station.image ? { coverUrl: assetUrl(station.image) } : {}),
    playlistTitle: station.city ? `${livePrefix} · ${station.city}` : livePrefix,
    isLive: true,
  };
}
