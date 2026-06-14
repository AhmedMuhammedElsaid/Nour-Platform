// Sticky bottom mini-player bar — visible whenever a queue is loaded.
// Mirrors the web audio-player.tsx bottom bar (compact: cover/title + play/pause + next).

import { Pressable, View } from "react-native";
import { useTranslation } from "react-i18next";
import { useRouter } from "expo-router";

import { Text } from "@/components/ui/text";
import { cn } from "@/lib/cn";
import { usePlayer } from "@/lib/player-context";

export function MiniPlayer({ bottomInset = 0 }: { bottomInset?: number }) {
  const { t } = useTranslation();
  const router = useRouter();
  const {
    hasQueue,
    currentTrack,
    isPlaying,
    isBuffering,
    errorMessage,
    currentTime,
    duration,
    repeatMode,
    isShuffled,
    toggle,
    next,
    prev,
    retry,
    cycleRepeat,
    toggleShuffle,
  } = usePlayer();

  if (!hasQueue || !currentTrack) return null;

  const progressPct = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <View
      className="border-t border-border bg-surface px-4 pt-2"
      style={{ paddingBottom: bottomInset + 8 }}
      accessibilityRole="toolbar"
      accessibilityLabel={t("player.miniPlayer")}
    >
      {/* Progress bar */}
      <View className="mb-2 h-1 overflow-hidden rounded-full bg-surface-2">
        <View
          className="h-full rounded-full bg-primary"
          style={{ width: `${Math.min(100, progressPct)}%` }}
        />
      </View>

      <View className="flex-row items-center gap-3">
        {/* Track info — tap to open the full Now Playing screen */}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t("player.openPlayer")}
          onPress={() => router.push("/player")}
          className="min-w-0 flex-1"
        >
          <Text variant="body" numberOfLines={1} className="font-medium">
            {currentTrack.title}
          </Text>
          {currentTrack.playlistTitle != null && (
            <Text variant="muted" numberOfLines={1} className="text-xs">
              {currentTrack.playlistTitle}
            </Text>
          )}
          {errorMessage != null && (
            <Text className="text-xs text-danger">{errorMessage}</Text>
          )}
        </Pressable>

        {/* Quick shuffle + repeat toggles */}
        <View className="flex-row items-center gap-1">
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ selected: isShuffled }}
            accessibilityLabel={t("player.shuffle")}
            onPress={toggleShuffle}
            className="size-9 items-center justify-center"
          >
            <Text className={cn("text-sm", isShuffled ? "text-primary" : "text-text-2")}>🔀</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ selected: repeatMode !== "off" }}
            accessibilityLabel={t("player.repeat")}
            onPress={cycleRepeat}
            className="size-9 items-center justify-center"
          >
            <Text className={cn("text-sm", repeatMode !== "off" ? "text-primary" : "text-text-2")}>
              {repeatMode === "one" ? "🔂" : "🔁"}
            </Text>
          </Pressable>
        </View>

        {/* Transport */}
        <View className="flex-row items-center gap-1">
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t("player.prev")}
            onPress={prev}
            className="size-9 items-center justify-center"
          >
            <Text className="text-lg text-text">⏮</Text>
          </Pressable>

          {errorMessage != null ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t("player.retry")}
              onPress={retry}
              className="size-11 items-center justify-center rounded-full bg-primary"
            >
              <Text className="text-lg text-bg">↻</Text>
            </Pressable>
          ) : (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={
                isPlaying ? t("player.pause") : t("player.play")
              }
              onPress={toggle}
              className={cn(
                "size-11 items-center justify-center rounded-full bg-primary",
                isBuffering && "opacity-60",
              )}
            >
              <Text className="text-lg text-bg">
                {isPlaying ? "⏸" : "▶"}
              </Text>
            </Pressable>
          )}

          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t("player.next")}
            onPress={next}
            className="size-9 items-center justify-center"
          >
            <Text className="text-lg text-text">⏭</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}
