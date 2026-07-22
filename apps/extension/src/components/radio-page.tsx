import { useEffect, useState } from "react";

import { fetchStations, buildStationQueue, type RadioStationSummary } from "../lib/content";
import { currentItem, type PlayerCommand, type PlayerState } from "../lib/player-state";
import {
  getRadioFavorites,
  getRecentStations,
  recordRecentStation,
  toggleRadioFavorite,
} from "../lib/radio-store";
import { useI18n } from "../lib/i18n";
import { Skeleton } from "./skeleton";
import { StationCard } from "./station-card";

const RECENT_VISIBLE_COUNT = 3;

// Favorited stations float to the top; the rest keep the server order. Pure
// so it's testable without rendering (package has no jsdom).
export function sortFavoritesFirst(
  stations: RadioStationSummary[],
  favorites: string[],
): RadioStationSummary[] {
  const fav = new Set(favorites);
  return [...stations].sort(
    (a, b) => Number(fav.has(b.slug)) - Number(fav.has(a.slug)),
  );
}

// Resolves MRU recent slugs to station objects, capped to `limit` (the most
// recent `limit`, since `recent` is already MRU-ordered — recordRecentStation
// unshifts). Pure so it's testable without rendering.
export function resolveRecentStations(
  stations: RadioStationSummary[],
  recent: string[],
  limit = RECENT_VISIBLE_COUNT,
): RadioStationSummary[] {
  const bySlug = new Map(stations.map((s) => [s.slug, s]));
  return recent
    .map((slug) => bySlug.get(slug))
    .filter((s): s is RadioStationSummary => s != null)
    .slice(0, limit);
}

// Full /radio view — mirrors apps/web/features/radio/components/radio-page.tsx:
// "Recently played" (capped to the last 3) + "All stations" (favorites float
// to the top), both using the shared lantern StationCard.
export function RadioPage({
  state,
  send,
}: {
  state: PlayerState | null;
  send: (command: PlayerCommand) => void;
}) {
  const { t } = useI18n();
  const [stations, setStations] = useState<RadioStationSummary[]>([]);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [recent, setRecent] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void fetchStations()
      .then(setStations)
      .catch(() => {})
      .finally(() => setLoading(false));
    void getRadioFavorites().then(setFavorites);
    void getRecentStations().then(setRecent);
  }, []);

  const currentId = state ? (currentItem(state)?.id ?? null) : null;
  const playing = state?.status === "playing";

  const handlePlay = (station: RadioStationSummary) => {
    const id = `radio:${station.slug}`;
    if (currentId === id) {
      send({ type: "toggle" });
      return;
    }
    send({ type: "load", queue: buildStationQueue(station), index: 0 });
    void recordRecentStation(station.slug).then(setRecent);
  };

  const handleToggleFavorite = (slug: string) => {
    void toggleRadioFavorite(slug).then(setFavorites);
  };

  const renderCard = (station: RadioStationSummary) => (
    <li key={station.slug}>
      <StationCard
        station={station}
        isCurrent={currentId === `radio:${station.slug}`}
        isPlaying={playing}
        isFavorite={favorites.includes(station.slug)}
        onPlay={handlePlay}
        onToggleFavorite={handleToggleFavorite}
      />
    </li>
  );

  const recentStations = resolveRecentStations(stations, recent);
  const sorted = sortFavoritesFirst(stations, favorites);

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-8">
      <header className="space-y-1">
        <h1 className="font-display text-2xl font-bold text-primary">{t("radio.title")}</h1>
        <p className="text-sm text-text-2">{t("radio.subtitle")}</p>
      </header>

      {loading ? (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="aspect-square w-full" />
          ))}
        </div>
      ) : stations.length === 0 ? (
        <p className="rounded-xl border border-border bg-surface p-6 text-center text-text-2">
          {t("radio.empty")}
        </p>
      ) : (
        <>
          {recentStations.length > 0 && (
            <section className="space-y-3">
              <h2 className="text-xs font-semibold uppercase tracking-[0.08em] text-text-2">
                {t("radio.recentlyPlayed")}
              </h2>
              <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3">{recentStations.map(renderCard)}</ul>
            </section>
          )}

          <section className="space-y-3">
            <h2 className="text-xs font-semibold uppercase tracking-[0.08em] text-text-2">
              {t("radio.allStations")}
            </h2>
            <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3">{sorted.map(renderCard)}</ul>
          </section>
        </>
      )}
    </div>
  );
}
