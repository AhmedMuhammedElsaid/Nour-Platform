import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { Stack, useLocalSearchParams } from "expo-router";
import { ActivityIndicator, FlatList, View } from "react-native";

import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { Text } from "@/components/ui/text";
import { Cover } from "@/features/playlists/components/cover";
import { initialLocale } from "@/lib/i18n";
import { categoriesQuery, playlistDetailQuery } from "@/lib/queries";
import type { CategoryChip, PlayableTrack } from "@/lib/types";

function formatDuration(secs?: number): string | null {
  if (secs == null) return null;
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export default function PlaylistDetailScreen() {
  const { t } = useTranslation();
  const locale = initialLocale;
  const { slug } = useLocalSearchParams<{ slug: string }>();

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
      <Cover id={playlist.id} className="h-56 w-full rounded-xl" emojiClassName="text-7xl" />

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

      {tracks.length > 0 && (
        // Wired to the audio engine in Phase 6; a no-op placeholder until then.
        <Button label={t("playlist.playAll")} disabled />
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
        contentContainerClassName="gap-1 pb-12"
        ListEmptyComponent={<Text variant="muted">{t("playlist.noTracks")}</Text>}
        renderItem={({ item, index }) => {
          const dur = formatDuration(item.durationSecs);
          return (
            <View className="flex-row items-center gap-3 border-b border-border py-3">
              <Text variant="muted" className="w-6 text-center">
                {index + 1}
              </Text>
              <Text variant="body" numberOfLines={1} className="flex-1">
                {item[locale].title}
              </Text>
              {dur != null && <Text variant="muted">{dur}</Text>}
            </View>
          );
        }}
      />
    </>
  );
}
