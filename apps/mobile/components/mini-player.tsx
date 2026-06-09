// Sticky bottom mini-player bar — visible whenever a queue is loaded.
// Mirrors the web audio-player.tsx bottom bar (compact: cover/title + play/pause + next).

import { Pressable, View } from "react-native";
import { useTranslation } from "react-i18next";

import { Text } from "@/components/ui/text";
import { cn } from "@/lib/cn";
import { usePlayer } from "@/lib/player-context";

function formatTime(secs: number): string {
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function MiniPlayer() {
  const { t } = useTranslation();
  const {
    hasQueue,
    currentTrack,
    isPlaying,
    isBuffering,
    errorMessage,
    currentTime,
    duration,
    toggle,
    next,
    prev,
    retry,
  } = usePlayer();

  if (!hasQueue || !currentTrack) return null;

  const progressPct = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <View
      className="border-t border-border bg-surface px-4 pb-6 pt-2"
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
        {/* Track info */}
        <View className="min-w-0 flex-1">
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
        </View>

        {/* Time */}
        <Text variant="muted" className="text-xs tabular-nums">
          {formatTime(currentTime)}
          {duration > 0 ? ` / ${formatTime(duration)}` : ""}
        </Text>

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
