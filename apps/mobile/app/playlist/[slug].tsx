import { useEffect, useMemo, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { Stack, useLocalSearchParams } from "expo-router";
import { ActivityIndicator, FlatList, Pressable, View } from "react-native";

import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { Text } from "@/components/ui/text";
import { DownloadButton } from "@/features/downloads/components/download-button";
import { useDownloads } from "@/features/downloads/hooks/use-downloads";
import { Cover } from "@/features/playlists/components/cover";
import { initialLocale } from "@/lib/i18n";
import { usePlayer, type QueueTrack } from "@/lib/player-context";
import { categoriesQuery, playlistDetailQuery } from "@/lib/queries";
import type { CategoryChip, PlayableTrack } from "@/lib/types";
import { useDockSpacing } from "@/lib/use-dock-spacing";

function formatDuration(secs?: number): string | null {
  if (secs == null) return null;
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export default function PlaylistDetailScreen() {
  const { t } = useTranslation();
  const locale = initialLocale;
  const { slug, trackId } = useLocalSearchParams<{ slug: string; trackId?: string }>();
  const dockSpacing = useDockSpacing();
  const { loadQueue, currentTrack, isPlaying } = usePlayer();
  const downloads = useDownloads();

  const detail = useQuery(playlistDetailQuery(slug ?? "", locale));
  const categories = useQuery(categoriesQuery());

  const playlistCategories = useMemo<CategoryChip[]>(() => {
    const ids = detail.data?.playlist.categoryIds ?? [];
    if (ids.length === 0) return [];
    const byId = new Map((categories.data ?? []).map((c) => [c.id, c]));
    return ids
      .map((id) => byId.get(id))
      .filter((c): c is NonNullable<typeof c> => c != null)
      .map((c) => ({ slug: c[locale].slug, name: c[locale].name }));
  }, [detail.data, categories.data, locale]);

  // Playable tracks with srcUrl.
  const playableTracks = useMemo(() => {
    if (!detail.data) return [];
    return detail.data.tracks.filter(
      (tr): tr is PlayableTrack & { srcUrl: string } => tr.srcUrl != null,
    );
  }, [detail.data]);

  // Build the queue tracks for the player.
  const queueTracks = useMemo<QueueTrack[]>(() => {
    if (!detail.data) return [];
    const { playlist } = detail.data;
    return playableTracks.map((tr) => ({
      id: tr.id,
      title: tr[locale].title,
      mediaUrl: tr.srcUrl,
      durationSecs: tr.durationSecs,
      playlistTitle: playlist[locale].title,
      playlistSlug: playlist[locale].slug,
      locale,
    }));
  }, [detail.data, playableTracks, locale]);

  // Continue-listening deep link (?trackId=…): auto-start the queue at that
  // track once it resolves (mirrors the web's #trackId autoplay, point 17).
  // Guarded by a ref so it fires once per requested id, not on every render.
  const autoplayedRef = useRef<string | null>(null);
  useEffect(() => {
    if (!trackId || queueTracks.length === 0) return;
    if (autoplayedRef.current === trackId) return;
    const idx = queueTracks.findIndex((q) => q.id === trackId);
    if (idx >= 0) {
      autoplayedRef.current = trackId;
      loadQueue(queueTracks, idx);
    }
  }, [trackId, queueTracks, loadQueue]);

  const playAll = () => {
    if (queueTracks.length > 0) loadQueue(queueTracks, 0);
  };

  const playTrack = (index: number) => {
    if (queueTracks.length > 0) loadQueue(queueTracks, index);
  };

  const downloadAll = () => {
    if (!detail.data) return;
    for (const tr of playableTracks) {
      downloads.startDownload({
        id: tr.id,
        title: tr[locale].title,
        srcUrl: tr.srcUrl,
        playlistTitle: detail.data.playlist[locale].title,
        playlistSlug: detail.data.playlist[locale].slug,
      });
    }
  };

  if (detail.isPending) {
    return (
      <View className="flex-1 items-center justify-center bg-bg">
        <ActivityIndicator color="#c8a050" />
      </View>
    );
  }

  if (detail.isError || !detail.data) {
    return (
      <View className="flex-1 items-center justify-center gap-3 bg-bg px-4">
        <Text className="text-danger">{t("common.error")}</Text>
        <Button label={t("common.retry")} variant="outline" onPress={() => void detail.refetch()} />
      </View>
    );
  }

  const { playlist, tracks } = detail.data;
  const display = playlist[locale];

  const header = (
    <View className="gap-4 pb-2">
      <Cover
        id={playlist.id}
        imageUrl={playlist.scholarImage}
        className="h-56 w-full rounded-xl"
        emojiClassName="text-7xl"
      />

      <View className="gap-2">
        <Text variant="display" className="text-3xl">
          {display.title}
        </Text>

        {display.scholarName != null && (
          <Text variant="muted">
            {t("playlist.by")} <Text className="font-medium text-text">{display.scholarName}</Text>
          </Text>
        )}

        {display.description != null && <Text variant="muted">{display.description}</Text>}

        {playlistCategories.length > 0 && (
          <View className="flex-row flex-wrap gap-1.5">
            {playlistCategories.map((cat) => (
              <Chip key={cat.slug} label={cat.name} />
            ))}
          </View>
        )}

        <Text variant="muted">{t("playlist.trackCount", { count: tracks.length })}</Text>
      </View>

      {queueTracks.length > 0 && (
        <View className="flex-row gap-2">
          <View className="flex-1">
            <Button label={t("playlist.playAll")} onPress={playAll} />
          </View>
          <Button
            label={t("downloads.downloadAll")}
            variant="outline"
            onPress={downloadAll}
          />
        </View>
      )}

      <Text variant="label" className="mt-2">
        {t("playlist.tracksHeading")}
      </Text>
    </View>
  );

  return (
    <>
      <Stack.Screen options={{ headerShown: true, title: display.title }} />
      <FlatList<PlayableTrack>
        className="flex-1 bg-bg px-4 pt-4"
        data={tracks}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={header}
        contentContainerClassName="gap-1"
        contentContainerStyle={{ paddingBottom: dockSpacing }}
        ListEmptyComponent={<Text variant="muted">{t("playlist.noTracks")}</Text>}
        renderItem={({ item, index }) => {
          const dur = formatDuration(item.durationSecs);
          const isActive = currentTrack?.id === item.id;
          const playable = item.srcUrl != null;
          const queueIndex = playable
            ? queueTracks.findIndex((q) => q.id === item.id)
            : -1;
          const dlStatus = downloads.getStatus(item.id);

          return (
            <Pressable
              accessibilityRole="button"
              disabled={!playable}
              onPress={() => {
                if (queueIndex >= 0) playTrack(queueIndex);
              }}
            >
              <View className="flex-row items-center gap-3 border-b border-border py-3">
                <Text
                  variant="muted"
                  className={`w-6 text-center ${isActive && isPlaying ? "text-primary font-bold" : ""}`}
                >
                  {isActive && isPlaying ? "▶" : String(index + 1)}
                </Text>
                <Text
                  variant="body"
                  numberOfLines={1}
                  className={`flex-1 ${isActive ? "text-primary font-medium" : ""}`}
                >
                  {item[locale].title}
                </Text>
                {dur != null && <Text variant="muted">{dur}</Text>}
                {playable && (
                  <DownloadButton
                    trackId={item.id}
                    title={item[locale].title}
                    status={dlStatus}
                    onDownload={() =>
                      downloads.startDownload({
                        id: item.id,
                        title: item[locale].title,
                        srcUrl: item.srcUrl as string,
                        playlistTitle: display.title,
                        playlistSlug: display.slug,
                      })
                    }
                    onDelete={() => downloads.remove(item.id)}
                  />
                )}
              </View>
            </Pressable>
          );
        }}
      />
    </>
  );
}
