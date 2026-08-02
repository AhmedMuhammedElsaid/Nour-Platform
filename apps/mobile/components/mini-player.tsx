// Sticky bottom mini-player bar — visible whenever a queue is loaded.
// Mirrors the web audio-player.tsx bottom bar (compact: cover/title + play/pause + next).

import { memo } from "react";
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
  CloseIcon,
} from "@/components/icons/player-icons";
import { Text } from "@/components/ui/text";
import { cn } from "@/lib/cn";
import {
  usePlayerActions,
  usePlayerProgress,
  usePlayerQueue,
  usePlayerTransport,
} from "@/lib/player-context";
import { useTheme } from "@/lib/theme-context";

// Rendered height when a queue is loaded and bottomInset is 0 (the dock always
// passes 0 here — see bottom-dock.tsx). Measured on the A72: border-t(1) +
// pt-2(8) + style paddingBottom(8) + the mb-2 progress bar row(4+2) + the
// tallest row content, the size-11 play button(44). Named so
// lib/use-dock-spacing.ts doesn't re-guess it.
export const MINI_PLAYER_HEIGHT = 73;

// The ONLY subscriber to the 250ms progress tick in this file. The mini-player
// is mounted globally (bottom-dock.tsx) on every route, so subscribing in
// MiniPlayerImpl re-rendered its whole transport row 4×/sec during playback on
// whatever screen you were on — and did so even when the bar is hidden (live
// stream) or the component renders null, because hooks run before those exits.
// Keep the subscription down here where the value is actually painted.
function MiniPlayerProgress() {
  const { currentTime, duration } = usePlayerProgress();
  const progressPct = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <View className="mb-2 h-1 overflow-hidden rounded-full bg-surface-2">
      <View
        className="h-full rounded-full bg-primary"
        style={{ width: `${Math.min(100, progressPct)}%` }}
      />
    </View>
  );
}

function MiniPlayerImpl({ bottomInset = 0 }: { bottomInset?: number }) {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const router = useRouter();
  const primaryColor = theme === "dark" ? "#f0e6cc" : "#13201a";
  const mutedColor = theme === "dark" ? "#5a4a38" : "#6b7670";
  const { hasQueue, currentTrack, isPlaying, isBuffering, errorMessage } =
    usePlayerTransport();
  const { repeatMode, isShuffled } = usePlayerQueue();
  const { toggle, next, prev, retry, stop, cycleRepeat, toggleShuffle } =
    usePlayerActions();

  if (!hasQueue || !currentTrack) return null;

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
      {!isLive && <MiniPlayerProgress />}

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

          {/* Close — stop playback + clear the queue so the bar disappears. */}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t("player.close")}
            onPress={stop}
            className="size-9 items-center justify-center"
          >
            <CloseIcon color={mutedColor} size={18} />
          </Pressable>
        </View>
      </View>
    </View>
  );
}

// Mounted on every route via the dock, so it re-rendered on every navigation
// even though its only prop is a constant. Its own context subscriptions still
// drive it — memo just stops the parent's pathname churn from reaching it.
export const MiniPlayer = memo(MiniPlayerImpl);
