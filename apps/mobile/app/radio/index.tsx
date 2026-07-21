// Radio screen — a list of live Islamic radio stations. Reached from the Home
// "Radio" card (router.push("/radio")); the app has no header chrome
// (Stack headerShown:false), so this screen draws its own back row. Mirrors
// apps/web/features/radio/components/radio-page.tsx: tapping a station loads a
// one-item live queue into the shared player (LIVE UI, no seek).

import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { Pressable, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Text } from "@/components/ui/text";
import { initialLocale } from "@/lib/i18n";
import { usePlayer } from "@/lib/player-context";
import { radioStationsQuery } from "@/lib/queries";
import { useDockSpacing } from "@/lib/use-dock-spacing";
import {
  getRadioFavorites,
  getRecentStations,
  recordRecentStation,
  toggleRadioFavorite,
} from "@/lib/device-local";
import { StationCard } from "@/features/radio/components/station-card";
import { stationToQueueTrack } from "@/features/radio/lib/station-to-queue";
import { toStationView } from "@/features/radio/lib/station-view";
import type { StationView } from "@/features/radio/types";

const RECENT_VISIBLE_COUNT = 4;

export default function RadioScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const dockSpacing = useDockSpacing();
  const locale = initialLocale;
  const { loadQueue, currentTrack, isPlaying, toggle } = usePlayer();

  const stationsQuery = useQuery(radioStationsQuery());

  const [favorites, setFavorites] = useState<string[]>([]);
  const [recent, setRecent] = useState<string[]>([]);
  useEffect(() => {
    void getRadioFavorites().then(setFavorites);
    void getRecentStations().then(setRecent);
  }, []);

  const livePrefix = t("radio.livePrefix");

  // Resolve DTOs → locale-aware views (toStationView tolerates a row missing
  // the active locale so one bad row can't blank the list).
  const stations = useMemo<StationView[]>(
    () => (stationsQuery.data ?? []).map((s) => toStationView(s, locale)),
    [stationsQuery.data, locale],
  );

  const handlePlay = useCallback(
    (station: StationView) => {
      const queueId = `radio:${station.slug}`;
      if (currentTrack?.id === queueId) {
        toggle();
        return;
      }
      loadQueue([stationToQueueTrack(station, livePrefix)], 0);
      void recordRecentStation(station.slug).then(setRecent);
    },
    [currentTrack, toggle, loadQueue, livePrefix],
  );

  const handleToggleFavorite = useCallback((slug: string) => {
    void toggleRadioFavorite(slug).then(setFavorites);
  }, []);

  const sorted = useMemo(() => {
    const fav = new Set(favorites);
    return [...stations].sort((a, b) => Number(fav.has(b.slug)) - Number(fav.has(a.slug)));
  }, [stations, favorites]);

  // `recent` is MRU-ordered (recordRecentStation unshifts), so the first
  // RECENT_VISIBLE_COUNT entries are the most recently played — the rest stay
  // stored (device-local history) but aren't rendered. Mirrors the web cap.
  const recentStations = useMemo(() => {
    const bySlug = new Map(stations.map((s) => [s.slug, s]));
    return recent
      .map((slug) => bySlug.get(slug))
      .filter((s): s is StationView => s != null)
      .slice(0, RECENT_VISIBLE_COUNT);
  }, [recent, stations]);

  const renderCard = (station: StationView) => (
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
  );

  return (
    <ScrollView
      className="flex-1 bg-bg px-4"
      contentContainerClassName="gap-6"
      contentContainerStyle={{ paddingTop: insets.top + 12, paddingBottom: dockSpacing }}
    >
      {/* Back + title */}
      <View className="flex-row items-center gap-2">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t("common.back")}
          onPress={() => router.back()}
          className="size-9 items-center justify-center"
        >
          <Text variant="muted" className="text-2xl">‹</Text>
        </Pressable>
        <View>
          <Text variant="display" className="text-2xl">{t("radio.title")}</Text>
          <Text variant="muted">{t("radio.subtitle")}</Text>
        </View>
      </View>

      {stationsQuery.isPending ? (
        <View className="flex-row flex-wrap gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <View key={i} className="w-[48%] gap-2">
              <Skeleton className="aspect-square w-full" />
              <Skeleton className="h-4 w-3/4" />
            </View>
          ))}
        </View>
      ) : stationsQuery.isError && !stationsQuery.data ? (
        <View className="items-center gap-3">
          <Text className="text-danger">{t("common.error")}</Text>
          <Button label={t("common.retry")} variant="outline" onPress={() => void stationsQuery.refetch()} />
        </View>
      ) : stations.length === 0 ? (
        <Text variant="muted">{t("radio.empty")}</Text>
      ) : (
        <>
          {recentStations.length > 0 && (
            <View className="gap-3">
              <Text variant="label">{t("radio.recentlyPlayed")}</Text>
              <View className="flex-row flex-wrap gap-3">{recentStations.map(renderCard)}</View>
            </View>
          )}
          <View className="gap-3">
            <Text variant="label">{t("radio.allStations")}</Text>
            <View className="flex-row flex-wrap gap-3">{sorted.map(renderCard)}</View>
          </View>
        </>
      )}
    </ScrollView>
  );
}
