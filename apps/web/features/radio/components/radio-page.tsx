"use client";

import { useCallback, useMemo, useState } from "react";
import { useTranslations } from "next-intl";

import { usePlayer } from "@repo/ui/blocks/player-context";

import type { StationView } from "../types";
import { stationToQueueTrack } from "../lib/station-to-queue";
import { readFavorites, toggleFavorite } from "../lib/radio-favorites";
import { readRecentStations, recordRecentStation } from "../lib/radio-recent";
import { useNowPlaying } from "../hooks/use-now-playing";
import { StationCard } from "./station-card";

export function RadioPage({ stations }: { stations: StationView[] }) {
  const t = useTranslations("radio");
  const { loadQueue, currentTrack, isPlaying, toggle } = usePlayer();

  // Device-local state, read lazily on mount (localStorage is client-only).
  const [favorites, setFavorites] = useState<string[]>(() => readFavorites());
  const [recent, setRecent] = useState<string[]>(() => readRecentStations());

  const livePrefix = t("livePrefix");

  const handlePlay = useCallback(
    (station: StationView) => {
      const queueId = `radio:${station.slug}`;
      if (currentTrack?.id === queueId) {
        toggle();
        return;
      }
      loadQueue([stationToQueueTrack(station, livePrefix)], 0);
      setRecent(recordRecentStation(station.slug));
    },
    [currentTrack, toggle, loadQueue, livePrefix],
  );

  const handleToggleFavorite = useCallback((slug: string) => {
    setFavorites(toggleFavorite(slug));
  }, []);

  // Poll "now playing" only for the station that's currently streaming.
  const currentSlug = currentTrack?.id?.startsWith("radio:")
    ? currentTrack.id.slice("radio:".length)
    : null;
  const nowPlaying = useNowPlaying(currentSlug, isPlaying);

  // Favorited stations float to the top; the rest keep the server order.
  const sorted = useMemo(() => {
    const fav = new Set(favorites);
    return [...stations].sort(
      (a, b) => Number(fav.has(b.slug)) - Number(fav.has(a.slug)),
    );
  }, [stations, favorites]);

  const recentStations = useMemo(() => {
    const bySlug = new Map(stations.map((s) => [s.slug, s]));
    return recent.map((slug) => bySlug.get(slug)).filter((s): s is StationView => s != null);
  }, [recent, stations]);

  const renderCard = (station: StationView) => (
    <StationCard
      key={station.slug}
      station={station}
      isCurrent={currentTrack?.id === `radio:${station.slug}`}
      isPlaying={isPlaying}
      isFavorite={favorites.includes(station.slug)}
      nowPlaying={station.slug === currentSlug ? nowPlaying : null}
      onPlay={handlePlay}
      onToggleFavorite={handleToggleFavorite}
    />
  );

  return (
    <section className="mx-auto max-w-3xl px-4 py-8 sm:px-6 sm:py-12">
      <h1 className="font-display text-3xl font-bold text-text">{t("title")}</h1>
      <p className="mt-1 text-sm text-text-2">{t("subtitle")}</p>

      {stations.length === 0 ? (
        <p className="mt-10 rounded-xl border border-border bg-surface p-6 text-center text-text-2">
          {t("empty")}
        </p>
      ) : (
        <>
          {recentStations.length > 0 && (
            <div className="mt-8">
              <h2 className="mb-3 text-sm font-semibold text-text-2">{t("recentlyPlayed")}</h2>
              <div className="grid grid-cols-1 gap-3">{recentStations.map(renderCard)}</div>
            </div>
          )}

          <div className="mt-8">
            <h2 className="mb-3 text-sm font-semibold text-text-2">{t("allStations")}</h2>
            <div className="grid grid-cols-1 gap-3">{sorted.map(renderCard)}</div>
          </div>
        </>
      )}
    </section>
  );
}
