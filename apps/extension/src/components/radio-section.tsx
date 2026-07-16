import { useEffect, useState } from "react";

import { fetchStations, buildStationQueue, type RadioStationSummary } from "../lib/content";
import { currentItem, type PlayerCommand, type PlayerState } from "../lib/player-state";
import { getRadioFavorites, recordRecentStation, toggleRadioFavorite } from "../lib/radio-store";
import { useI18n } from "../lib/i18n";
import { navigate } from "../lib/router";
import { StationCard } from "./station-card";

const PREVIEW_COUNT = 4;

// Pure so the slice is testable without rendering (package has no jsdom —
// see vitest.config.ts `environment: "node"`).
export function previewStations(
  stations: RadioStationSummary[],
  limit = PREVIEW_COUNT,
): RadioStationSummary[] {
  return stations.slice(0, limit);
}

// Home "Radio" shelf — a short preview of the /radio catalog (first
// PREVIEW_COUNT curated stations), reusing the same lantern StationCard as the
// full page. Tapping a card loads a one-item live queue into the shared
// player engine (LIVE UI handled by PlayerBar via QueueItem.isLive).
// "Explore more" opens the dedicated radio view. Mirrors
// apps/web/features/radio/components/radio-preview-shelf.tsx.
export function RadioSection({
  state,
  send,
}: {
  state: PlayerState | null;
  send: (command: PlayerCommand) => void;
}) {
  const { t } = useI18n();
  const [stations, setStations] = useState<RadioStationSummary[]>([]);
  const [favorites, setFavorites] = useState<string[]>([]);

  useEffect(() => {
    void fetchStations()
      .then(setStations)
      .catch(() => {});
    void getRadioFavorites().then(setFavorites);
  }, []);

  const preview = previewStations(stations);
  if (preview.length === 0) return null;

  const currentId = state ? (currentItem(state)?.id ?? null) : null;
  const playing = state?.status === "playing";

  const handlePlay = (station: RadioStationSummary) => {
    const id = `radio:${station.slug}`;
    if (currentId === id) {
      send({ type: "toggle" });
      return;
    }
    send({ type: "load", queue: buildStationQueue(station), index: 0 });
    void recordRecentStation(station.slug);
  };

  const handleToggleFavorite = (slug: string) => {
    void toggleRadioFavorite(slug).then(setFavorites);
  };

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-xs font-semibold uppercase tracking-[0.08em] text-text-2">{t("home.radio")}</h2>
        <button
          type="button"
          onClick={() => navigate({ view: "radio" })}
          className="cursor-pointer text-xs text-text-2 hover:text-primary"
        >
          {t("home.radioExplore")}
        </button>
      </div>
      <ul className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {preview.map((station) => {
          const isCurrent = currentId === `radio:${station.slug}`;
          return (
            <li key={station.slug}>
              <StationCard
                station={station}
                isCurrent={isCurrent}
                isPlaying={playing}
                isFavorite={favorites.includes(station.slug)}
                onPlay={handlePlay}
                onToggleFavorite={handleToggleFavorite}
              />
            </li>
          );
        })}
      </ul>
    </section>
  );
}
