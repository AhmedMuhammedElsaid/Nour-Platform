import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { Pressable, View } from "react-native";
import { useRouter } from "expo-router";

import { Text } from "@/components/ui/text";
import { initialLocale } from "@/lib/i18n";
import { usePlayer } from "@/lib/player-context";
import { radioStationsQuery } from "@/lib/queries";
import { getRadioFavorites, recordRecentStation, toggleRadioFavorite } from "@/lib/device-local";
import { StationCard } from "./station-card";
import { stationToQueueTrack } from "../lib/station-to-queue";
import { toStationView } from "../lib/station-view";
import type { StationView } from "../types";

const PREVIEW_COUNT = 4;

// Home "Radio" shelf — a short preview of the /radio catalog (first
// PREVIEW_COUNT curated stations), reusing the same lantern StationCard so a
// tap plays inline via the shared player. "Explore more" opens the full
// /radio screen. Mirrors apps/web/features/radio/components/radio-preview-shelf.tsx.
// Replaces the old plain RadioHomeCard nav card (this shelf's own link covers
// the same navigation).
export function RadioPreviewShelf() {
  const { t } = useTranslation();
  const router = useRouter();
  const locale = initialLocale;
  const { loadQueue, currentTrack, isPlaying, toggle } = usePlayer();
  const { data } = useQuery(radioStationsQuery());

  const [favorites, setFavorites] = useState<string[]>([]);
  useEffect(() => {
    void getRadioFavorites().then(setFavorites);
  }, []);

  const livePrefix = t("radio.livePrefix");

  const preview = useMemo<StationView[]>(
    () => (data ?? []).slice(0, PREVIEW_COUNT).map((s) => toStationView(s, locale)),
    [data, locale],
  );

  const handlePlay = useCallback(
    (station: StationView) => {
      const queueId = `radio:${station.slug}`;
      if (currentTrack?.id === queueId) {
        toggle();
        return;
      }
      loadQueue([stationToQueueTrack(station, livePrefix)], 0);
      void recordRecentStation(station.slug);
    },
    [currentTrack, toggle, loadQueue, livePrefix],
  );

  const handleToggleFavorite = useCallback((slug: string) => {
    void toggleRadioFavorite(slug).then(setFavorites);
  }, []);

  if (preview.length === 0) return null;

  return (
    <View className="mt-8 gap-3">
      <View className="flex-row items-center justify-between">
        <Text variant="label">{t("home.radio")}</Text>
        <Pressable
          accessibilityRole="button"
          onPress={() => router.push("/radio")}
          hitSlop={8}
          className="flex-row items-center gap-1"
        >
          <Text className="text-sm text-muted">{t("home.radioExplore")}</Text>
          <Text className="text-sm text-muted">›</Text>
        </Pressable>
      </View>

      <View className="flex-row flex-wrap gap-3">
        {preview.map((station) => (
          <View key={station.slug} className="w-[48%]">
            <StationCard
              station={station}
              isCurrent={currentTrack?.id === `radio:${station.slug}`}
              isPlaying={isPlaying}
              isFavorite={favorites.includes(station.slug)}
              onPlay={handlePlay}
              onToggleFavorite={handleToggleFavorite}
            />
          </View>
        ))}
      </View>
    </View>
  );
}
