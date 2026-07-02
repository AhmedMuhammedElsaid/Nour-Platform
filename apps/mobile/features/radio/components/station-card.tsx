import { useTranslation } from "react-i18next";
import { Image, Pressable, View } from "react-native";

import { PlayIcon, PauseIcon } from "@/components/icons/player-icons";
import { Text } from "@/components/ui/text";
import { assetUrl } from "@/lib/api";

import type { StationView } from "../types";

// Icon color on the gold `bg-primary` play button — matches mini-player.tsx
// (the primary foreground is the same dark green in both themes).
const ON_PRIMARY = "#13201a";

interface Props {
  station: StationView;
  isCurrent: boolean;
  isPlaying: boolean;
  isFavorite: boolean;
  onPlay: (station: StationView) => void;
  onToggleFavorite: (slug: string) => void;
}

export function StationCard({
  station,
  isCurrent,
  isPlaying,
  isFavorite,
  onPlay,
  onToggleFavorite,
}: Props) {
  const { t } = useTranslation();
  const playingNow = isCurrent && isPlaying;

  return (
    <View
      className={`flex-row items-center gap-3 rounded-xl border p-3 ${
        isCurrent ? "border-primary/50 bg-primary/5" : "border-border bg-surface"
      }`}
    >
      <View className="size-14 items-center justify-center overflow-hidden rounded-lg bg-primary/10">
        {station.image ? (
          <Image source={{ uri: assetUrl(station.image) }} className="size-full" resizeMode="cover" />
        ) : (
          <Text className="text-2xl">📻</Text>
        )}
      </View>

      <View className="min-w-0 flex-1">
        <Text variant="body" numberOfLines={1} className="font-medium">
          {station.name}
        </Text>
        <View className="mt-1 flex-row items-center gap-1.5">
          <View className="size-1.5 rounded-full bg-danger" />
          <Text className="text-2xs font-semibold text-danger">{t("radio.live")}</Text>
        </View>
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityState={{ selected: isFavorite }}
        accessibilityLabel={isFavorite ? t("radio.unfavorite") : t("radio.favorite")}
        onPress={() => onToggleFavorite(station.slug)}
        className="size-10 items-center justify-center"
      >
        <Text className={isFavorite ? "text-xl text-primary" : "text-xl text-muted"}>
          {isFavorite ? "★" : "☆"}
        </Text>
      </Pressable>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={playingNow ? t("player.pause") : t("player.play")}
        onPress={() => onPlay(station)}
        className="size-12 items-center justify-center rounded-full bg-primary"
      >
        {playingNow ? <PauseIcon color={ON_PRIMARY} size={22} /> : <PlayIcon color={ON_PRIMARY} size={22} />}
      </Pressable>
    </View>
  );
}
