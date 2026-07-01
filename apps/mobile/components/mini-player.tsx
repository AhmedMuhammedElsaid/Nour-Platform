// Sticky bottom mini-player bar — visible whenever a queue is loaded.
// Mirrors the web audio-player.tsx bottom bar (compact: cover/title + play/pause + next).

import { Pressable, View } from "react-native";
import { useTranslation } from "react-i18next";
import { useRouter } from "expo-router";

import {
  PrevIcon,
  PlayIcon,
  PauseIcon,
  NextIcon,
  ShuffleIcon,
  RepeatIcon,
  RepeatOneIcon,
  RetryIcon,
} from "@/components/icons/player-icons";
import { Text } from "@/components/ui/text";
import { cn } from "@/lib/cn";
import { usePlayer } from "@/lib/player-context";
import { useTheme } from "@/lib/theme-context";

export function MiniPlayer({ bottomInset = 0 }: { bottomInset?: number }) {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const router = useRouter();
  const primaryColor = theme === "dark" ? "#f0e6cc" : "#13201a";
  const mutedColor = theme === "dark" ? "#5a4a38" : "#6b7670";
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
  // Live radio stream: no progress bar, no queue/shuffle/repeat — play/pause only.
  const isLive = currentTrack.isLive ?? false;

  return (
    <View
      className="border-t border-border bg-surface px-4 pt-2"
      style={{ paddingBottom: bottomInset + 8 }}
      accessibilityRole="toolbar"
      accessibilityLabel={t("player.miniPlayer")}
    >
      {/* Progress bar — hidden for live streams (no finite progress) */}
      {!isLive && (
        <View className="mb-2 h-1 overflow-hidden rounded-full bg-surface-2">
          <View
            className="h-full rounded-full bg-primary"
            style={{ width: `${Math.min(100, progressPct)}%` }}
          />
        </View>
      )}

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

        {/* Quick shuffle + repeat toggles — not for live streams */}
        {!isLive && (
          <View className="flex-row items-center gap-1">
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ selected: isShuffled }}
              accessibilityLabel={t("player.shuffle")}
              onPress={toggleShuffle}
              className="size-9 items-center justify-center"
            >
              <ShuffleIcon color={isShuffled ? primaryColor : mutedColor} size={18} />
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ selected: repeatMode !== "off" }}
              accessibilityLabel={t("player.repeat")}
              onPress={cycleRepeat}
              className="size-9 items-center justify-center"
            >
              {repeatMode === "one" ? (
                <RepeatOneIcon color={primaryColor} size={18} />
              ) : (
                <RepeatIcon color={repeatMode !== "off" ? primaryColor : mutedColor} size={18} />
              )}
            </Pressable>
          </View>
        )}

        {/* Transport */}
        <View className="flex-row items-center gap-1">
          {!isLive && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t("player.prev")}
              onPress={prev}
              className="size-9 items-center justify-center"
            >
              <PrevIcon color={primaryColor} size={18} />
            </Pressable>
          )}

          {errorMessage != null ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t("player.retry")}
              onPress={retry}
              className="size-11 items-center justify-center rounded-full bg-primary"
            >
              <RetryIcon color="#13201a" size={20} />
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
              {isPlaying ? <PauseIcon color="#13201a" size={20} /> : <PlayIcon color="#13201a" size={20} />}
            </Pressable>
          )}

          {!isLive && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t("player.next")}
              onPress={next}
              className="size-9 items-center justify-center"
            >
              <NextIcon color={primaryColor} size={18} />
            </Pressable>
          )}
        </View>
      </View>
    </View>
  );
}
