import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { Pressable, View } from "react-native";
import type { Playlist } from "@repo/shared-core/schemas/playlist";
import type { Locale } from "@repo/shared-core/schemas/locale";

import { Card } from "@/components/ui/card";
import { Chip } from "@/components/ui/chip";
import { Text } from "@/components/ui/text";
import { Cover } from "@/features/playlists/components/cover";
import type { CategoryChip } from "@/lib/types";

export type PlaylistCardProps = {
  playlist: Playlist;
  locale: Locale;
  categories?: CategoryChip[];
};

export function PlaylistCard({ playlist, locale, categories = [] }: PlaylistCardProps) {
  const router = useRouter();
  const { t } = useTranslation();
  // Tolerate a row missing the active-locale object (embedded-locale data can
  // lack one side) — fall back to the other locale so the card renders instead
  // of crashing the list. Mirrors the titleOf fallback on the home grid.
  const display = playlist[locale] ?? playlist.ar ?? playlist.en;
  if (display == null) return null;

  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => router.push(`/playlist/${encodeURIComponent(display.slug)}`)}
      className="flex-1"
    >
      <Card>
        <Cover
          id={playlist.id}
          imageUrl={playlist.scholarImage}
          className="aspect-square w-full"
          emojiClassName="text-5xl"
        />
        <View className="gap-1 p-3">
          <Text variant="title" numberOfLines={2}>
            {display.title}
          </Text>
          {playlist.trackCount != null && (
            <Text variant="muted">{t("home.trackCount", { count: playlist.trackCount })}</Text>
          )}
          {categories.length > 0 && (
            <View className="mt-1 flex-row flex-wrap gap-1">
              {categories.slice(0, 2).map((cat) => (
                <Chip key={cat.slug} label={cat.name} />
              ))}
            </View>
          )}
        </View>
      </Card>
    </Pressable>
  );
}
