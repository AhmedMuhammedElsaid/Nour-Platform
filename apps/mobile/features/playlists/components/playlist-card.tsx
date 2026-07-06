import { memo } from "react";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { Pressable, View } from "react-native";
import type { Playlist } from "@repo/shared-core/schemas/playlist";
import type { Locale } from "@repo/shared-core/schemas/locale";

import { Chip } from "@/components/ui/chip";
import { Text } from "@/components/ui/text";
import { Cover } from "@/features/playlists/components/cover";
import type { CategoryChip } from "@/lib/types";

export type PlaylistCardProps = {
  playlist: Playlist;
  locale: Locale;
  categories?: CategoryChip[];
};

// Mirrors the web playlist card (apps/web/features/playlists/components/
// playlist-card.tsx): a centered column with a CIRCULAR scholar avatar, title,
// scholar name, a track-count pill, and category chips.
// Wrapped in memo: the Home grid re-renders often (sort/filter changes, ticks
// elsewhere in the tree), and most cards' props are unchanged on any given
// render — memo skips their re-render as long as `categories` is a stable
// array reference (see app/index.tsx's per-item categories memo).
function PlaylistCardComponent({ playlist, locale, categories = [] }: PlaylistCardProps) {
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
      className="flex-1 items-center gap-2 rounded-2xl border border-border bg-surface-2 p-3"
    >
      {/* Circular scholar avatar (web parity). A plain sizing wrapper carries the
          definite square dimensions (w-[78%] + aspect-square); an <Image> with a
          PERCENTAGE width + aspectRatio does not reliably report its derived
          height to the parent flex pass inside the numColumns=2 row, so the card
          measured short and the avatar bled past the (RN-default visible)
          bg-surface-2 box into the shelf below. The wrapper has NO borderRadius/
          overflow — the radius lives on the image, which clips ITSELF reliably on
          Android (the earlier parent-clip approach is what failed). */}
      <View className="aspect-square w-[78%]">
        <Cover
          id={playlist.id}
          imageUrl={playlist.scholarImage}
          className="h-full w-full rounded-full"
          emojiClassName="text-5xl"
        />
      </View>

      <Text variant="title" numberOfLines={2} className="text-center">
        {display.title}
      </Text>

      {display.scholarName != null && (
        <Text variant="muted" numberOfLines={1} className="text-center">
          {display.scholarName}
        </Text>
      )}

      {playlist.trackCount != null && playlist.trackCount > 0 && (
        <View className="rounded-full border border-primary px-2.5 py-0.5">
          <Text className="text-primary text-xs font-semibold">
            {t("home.trackCount", { count: playlist.trackCount })}
          </Text>
        </View>
      )}

      {categories.length > 0 && (
        <View className="flex-row flex-wrap justify-center gap-1">
          {categories.slice(0, 2).map((cat) => (
            <Chip key={cat.slug} label={cat.name} />
          ))}
        </View>
      )}
    </Pressable>
  );
}

export const PlaylistCard = memo(PlaylistCardComponent);
