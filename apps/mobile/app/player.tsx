// Full-screen "Now Playing" — a modal route mirroring the web's audio-player.tsx
// (packages/ui/src/blocks/audio-player). All state already lives in the player
// context; this is the missing UI: large artwork, seek slider, transport,
// repeat/shuffle, volume, speed, and sleep timer (points 10 & 19). Glyphs stay
// as text for now; Phase 7 swaps in SVG transport icons across every surface.

import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Stack, useRouter } from "expo-router";
import { Pressable, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  ChevronDownIcon,
  ShuffleIcon,
  PrevIcon,
  PlayIcon,
  PauseIcon,
  NextIcon,
  RetryIcon,
  RepeatIcon,
  RepeatOneIcon,
  VolumeIcon,
  MuteIcon,
} from "@/components/icons/player-icons";
import { Cover } from "@/features/playlists/components/cover";
import { Slider } from "@/components/ui/slider";
import { Text } from "@/components/ui/text";
import { cn } from "@/lib/cn";
import { PLAYBACK_RATES, usePlayer } from "@/lib/player-context";
import { useTheme } from "@/lib/theme-context";

function formatTime(secs: number): string {
  if (!Number.isFinite(secs) || secs < 0) return "0:00";
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

const SLEEP_OPTIONS = [15, 30, 45, 60] as const;

export default function PlayerScreen() {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const primaryColor = theme === "dark" ? "#f0e6cc" : "#13201a";
  const mutedColor = theme === "dark" ? "#5a4a38" : "#6b7670";
  const textColor = theme === "dark" ? "#e4e2dd" : "#1a1814";
  const {
    hasQueue,
    currentTrack,
    currentIndex,
    queue,
    isPlaying,
    isBuffering,
    errorMessage,
    currentTime,
    duration,
    repeatMode,
    isShuffled,
    playbackRate,
    volume,
    toggle,
    seek,
    next,
    prev,
    retry,
    cycleRepeat,
    toggleShuffle,
    setPlaybackRate,
    setVolume,
    sleepTimerEndsAt,
    sleepAtTrackEnd,
    setSleepTimer,
  } = usePlayer();

  // Live remaining-time readout while a timed sleep timer runs.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (sleepTimerEndsAt == null) return;
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [sleepTimerEndsAt]);
  const sleepRemainingMs = sleepTimerEndsAt != null ? Math.max(0, sleepTimerEndsAt - now) : 0;

  const close = () => router.back();

  if (!hasQueue || !currentTrack) {
    return (
      <View className="flex-1 items-center justify-center gap-4 bg-bg px-6" style={{ paddingTop: insets.top }}>
        <Stack.Screen options={{ presentation: "modal", headerShown: false }} />
        <Text variant="muted">{t("player.nothingPlaying")}</Text>
        <Pressable accessibilityRole="button" onPress={close} className="rounded-md border border-border px-4 py-2">
          <Text>{t("common.close")}</Text>
        </Pressable>
      </View>
    );
  }

  const sliderMax = duration > 0 ? duration : currentTrack.durationSecs ?? 0;
  // Live radio stream: no seeking, no queue navigation — LIVE badge + play only.
  const isLive = currentTrack.isLive ?? false;
  const repeatLabel =
    repeatMode === "one"
      ? t("player.repeatOne")
      : repeatMode === "all"
        ? t("player.repeatAll")
        : t("player.repeatOff");

  return (
    <ScrollView
      className="flex-1 bg-bg"
      contentContainerClassName="px-6 gap-6"
      contentContainerStyle={{ paddingTop: insets.top + 8, paddingBottom: insets.bottom + 24 }}
    >
      <Stack.Screen options={{ presentation: "modal", headerShown: false }} />

      {/* Header: collapse + context */}
      <View className="flex-row items-center justify-between">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t("common.close")}
          onPress={close}
          className="size-9 items-center justify-center"
        >
          <ChevronDownIcon color={textColor} size={24} />
        </Pressable>
        <Text variant="muted" className="text-xs uppercase">
          {t("player.nowPlaying")}
        </Text>
        <View className="size-9" />
      </View>

      {/* Artwork */}
      <Cover id={currentTrack.id} className="aspect-square w-full rounded-2xl" emojiClassName="text-8xl" />

      {/* Title + context */}
      <View className="gap-1">
        <Text variant="display" className="text-2xl" numberOfLines={2}>
          {currentTrack.title}
        </Text>
        <Text variant="muted" numberOfLines={1}>
          {currentTrack.playlistTitle ?? `${currentIndex + 1} / ${queue.length}`}
        </Text>
        {errorMessage != null && <Text className="text-sm text-danger">{errorMessage}</Text>}
      </View>

      {/* Seek — or a LIVE badge for radio streams (no seeking) */}
      {isLive ? (
        <View className="flex-row items-center justify-center gap-2 py-2">
          <View className="size-2 rounded-full bg-danger" />
          <Text className="text-xs font-semibold uppercase tracking-wide text-text-2">LIVE</Text>
        </View>
      ) : (
        <View className="gap-1">
          <Slider
            value={currentTime}
            max={sliderMax > 0 ? sliderMax : 1}
            onSlidingComplete={seek}
            accessibilityLabel={t("player.nowPlaying")}
          />
          <View className="flex-row justify-between">
            <Text variant="muted" className="text-xs tabular-nums">{formatTime(currentTime)}</Text>
            <Text variant="muted" className="text-xs tabular-nums">{formatTime(sliderMax)}</Text>
          </View>
        </View>
      )}

      {/* Transport */}
      <View className={cn("flex-row items-center", isLive ? "justify-center gap-8" : "justify-between")}>
        {!isLive && (
          <>
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ selected: isShuffled }}
              accessibilityLabel={t("player.shuffle")}
              onPress={toggleShuffle}
              className="size-11 items-center justify-center"
            >
              <ShuffleIcon color={isShuffled ? primaryColor : mutedColor} size={24} />
            </Pressable>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t("player.prev")}
              onPress={prev}
              className="size-12 items-center justify-center"
            >
              <PrevIcon color={primaryColor} size={28} />
            </Pressable>
          </>
        )}

        {errorMessage != null ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t("player.retry")}
            onPress={retry}
            className="size-16 items-center justify-center rounded-full bg-primary"
          >
            <RetryIcon color="#13201a" size={28} />
          </Pressable>
        ) : (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={isPlaying ? t("player.pause") : t("player.play")}
            onPress={toggle}
            className={cn(
              "size-16 items-center justify-center rounded-full bg-primary",
              isBuffering && "opacity-60",
            )}
          >
            {isPlaying ? <PauseIcon color="#13201a" size={28} /> : <PlayIcon color="#13201a" size={28} />}
          </Pressable>
        )}

        {!isLive && (
          <>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t("player.next")}
              onPress={next}
              className="size-12 items-center justify-center"
            >
              <NextIcon color={primaryColor} size={28} />
            </Pressable>

            <Pressable
              accessibilityRole="button"
              accessibilityState={{ selected: repeatMode !== "off" }}
              accessibilityLabel={repeatLabel}
              onPress={cycleRepeat}
              className="size-11 items-center justify-center"
            >
              {repeatMode === "one" ? (
                <RepeatOneIcon color={primaryColor} size={24} />
              ) : (
                <RepeatIcon color={repeatMode !== "off" ? primaryColor : mutedColor} size={24} />
              )}
            </Pressable>
          </>
        )}
      </View>

      {/* Volume */}
      <View className="flex-row items-center gap-3">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={volume === 0 ? t("player.unmute") : t("player.mute")}
          onPress={() => setVolume(volume === 0 ? 1 : 0)}
          className="size-9 items-center justify-center"
        >
          {volume === 0 ? (
            <MuteIcon color={mutedColor} size={20} />
          ) : (
            <VolumeIcon color={primaryColor} size={20} />
          )}
        </Pressable>
        <View className="flex-1">
          <Slider value={volume} max={1} onValueChange={setVolume} accessibilityLabel={t("player.volume")} />
        </View>
      </View>

      {/* Speed */}
      <View className="gap-2">
        <Text variant="label">{t("player.speed")}</Text>
        <View className="flex-row flex-wrap gap-2">
          {PLAYBACK_RATES.map((rate) => (
            <Pressable
              key={rate}
              accessibilityRole="button"
              accessibilityState={{ selected: rate === playbackRate }}
              onPress={() => setPlaybackRate(rate)}
              className={cn(
                "rounded-md border px-3 py-1.5",
                rate === playbackRate ? "border-primary bg-primary" : "border-border",
              )}
            >
              <Text className={cn("text-sm", rate === playbackRate ? "text-bg font-medium" : "text-text-2")}>
                {rate}×
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      {/* Sleep timer */}
      <View className="gap-2">
        <View className="flex-row items-center gap-2">
          <Text variant="label">{t("player.sleepTimer")}</Text>
          {sleepTimerEndsAt != null && (
            <Text className="text-sm text-primary tabular-nums">{formatTime(sleepRemainingMs / 1000)}</Text>
          )}
        </View>
        <View className="flex-row flex-wrap gap-2">
          {SLEEP_OPTIONS.map((m) => (
            <Pressable
              key={m}
              accessibilityRole="button"
              onPress={() => setSleepTimer(m)}
              className="rounded-md border border-border px-3 py-1.5"
            >
              <Text className="text-sm text-text-2">{m}m</Text>
            </Pressable>
          ))}
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ selected: sleepAtTrackEnd }}
            onPress={() => setSleepTimer("end-of-track")}
            className={cn(
              "rounded-md border px-3 py-1.5",
              sleepAtTrackEnd ? "border-primary bg-primary" : "border-border",
            )}
          >
            <Text className={cn("text-sm", sleepAtTrackEnd ? "text-bg font-medium" : "text-text-2")}>
              {t("player.endOfTrack")}
            </Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            disabled={sleepTimerEndsAt == null && !sleepAtTrackEnd}
            onPress={() => setSleepTimer(null)}
            className="rounded-md px-3 py-1.5"
          >
            <Text className="text-sm text-text-2">{t("player.off")}</Text>
          </Pressable>
        </View>
      </View>
    </ScrollView>
  );
}
