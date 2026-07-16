"use client";

import { useCallback, useState } from "react";
import { useTranslations } from "next-intl";

import { usePlayer } from "@repo/ui/blocks/player-context";

import { Link } from "@/i18n/navigation";
import type { StationView } from "../types";
import { stationToQueueTrack } from "../lib/station-to-queue";
import { readFavorites, toggleFavorite } from "../lib/radio-favorites";
import { recordRecentStation } from "../lib/radio-recent";
import { StationCard } from "./station-card";

const PREVIEW_COUNT = 4;

// Home "Radio" shelf — a short preview of the /radio catalog (first
// PREVIEW_COUNT curated stations) so the homepage hints at live radio without
// duplicating the full page. Cards are the same lantern StationCard as
// /radio (tap plays inline via the shared player); "Explore more" links
// through to the full station list.
export function RadioPreviewShelf({ stations }: { stations: StationView[] }) {
  const t = useTranslations("home");
  const tRadio = useTranslations("radio");
  const { loadQueue, currentTrack, isPlaying, toggle } = usePlayer();

  const [favorites, setFavorites] = useState<string[]>(() => readFavorites());

  const livePrefix = tRadio("livePrefix");
  const preview = stations.slice(0, PREVIEW_COUNT);

  const handlePlay = useCallback(
    (station: StationView) => {
      const queueId = `radio:${station.slug}`;
      if (currentTrack?.id === queueId) {
        toggle();
        return;
      }
      loadQueue([stationToQueueTrack(station, livePrefix)], 0);
      recordRecentStation(station.slug);
    },
    [currentTrack, toggle, loadQueue, livePrefix],
  );

  const handleToggleFavorite = useCallback((slug: string) => {
    setFavorites(toggleFavorite(slug));
  }, []);

  if (preview.length === 0) return null;

  return (
    <section aria-labelledby="radio-heading" className="mt-8">
      <div className="flex items-center justify-between">
        <h2 id="radio-heading" className="text-lg font-semibold">
          {t("radio")}
        </h2>
        <Link
          href="/radio"
          className="inline-flex items-center gap-1 text-sm text-text-2 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm px-2 py-1"
        >
          {t("radioExplore")}
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="size-3.5 rtl:-scale-x-100" aria-hidden="true">
            <path d="M9 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </Link>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-4 sm:grid-cols-4">
        {preview.map((station) => (
          <StationCard
            key={station.slug}
            station={station}
            isCurrent={currentTrack?.id === `radio:${station.slug}`}
            isPlaying={isPlaying}
            isFavorite={favorites.includes(station.slug)}
            onPlay={handlePlay}
            onToggleFavorite={handleToggleFavorite}
          />
        ))}
      </div>
    </section>
  );
}
