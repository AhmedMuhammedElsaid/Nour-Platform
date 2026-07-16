import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Image, Pressable, View } from "react-native";
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import Svg, { Circle, Path } from "react-native-svg";

import { PlayIcon, PauseIcon } from "@/components/icons/player-icons";
import { Text } from "@/components/ui/text";
import { assetUrl } from "@/lib/api";

import type { StationView } from "../types";

// Icon color on the gold `bg-primary` play button — matches mini-player.tsx.
const ON_PRIMARY = "#13201a";
const GOLD = "#c8a050";

function RadioGlyph() {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke={GOLD} strokeWidth={1.5}>
      <Path d="M3.5 8.5 18 3M6 8.5h14a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-9a1 1 0 0 1 1-1z" />
      <Circle cx={8} cy={14} r={3} />
      <Path d="M16 12.5h2M16 15.5h2" strokeLinecap="round" />
    </Svg>
  );
}

// The lone geometric ornament (khatam/8-point star), mirroring the web/
// extension lantern tile — used once, next to the LIVE label.
function Star8Icon() {
  return (
    <Svg width={9} height={9} viewBox="0 0 24 24" fill={GOLD} opacity={0.8}>
      <Path d="M12 0l2.2 7.6L20 4l-3.6 6.4L24 12l-7.6 1.6L20 20l-6.4-3.6L12 24l-1.6-7.6L4 20l3.6-6.4L0 12l7.6-1.6L4 4l6.4 3.6z" />
    </Svg>
  );
}

// Three bars next to LIVE — idle/grey until this exact card is playing, then
// breathes via a UI-thread Reanimated loop (same technique as the prayer-times
// sun-arc corona pulse — see sun-arc.tsx).
function WaveformMini({ playing }: { playing: boolean }) {
  const t = useSharedValue(0);
  useEffect(() => {
    if (playing) {
      t.value = withRepeat(withTiming(1, { duration: 550, easing: Easing.inOut(Easing.ease) }), -1, true);
    } else {
      cancelAnimation(t);
      t.value = withTiming(0, { duration: 200 });
    }
    return () => cancelAnimation(t);
  }, [playing, t]);

  const s1 = useAnimatedStyle(() => ({ height: 3 + t.value * 5 }));
  const s2 = useAnimatedStyle(() => ({ height: 3 + t.value * 7 }));
  const s3 = useAnimatedStyle(() => ({ height: 3 + t.value * 4 }));
  const barColor = playing ? GOLD : "#6b6357";

  return (
    <View className="flex-row items-end gap-0.5" style={{ height: 10 }}>
      <Animated.View style={[{ width: 2, borderRadius: 1, backgroundColor: barColor }, s1]} />
      <Animated.View style={[{ width: 2, borderRadius: 1, backgroundColor: barColor }, s2]} />
      <Animated.View style={[{ width: 2, borderRadius: 1, backgroundColor: barColor }, s3]} />
    </View>
  );
}

// Sun-like glow halo behind the icon, gold like the prayer-times sun arc —
// a solid pulsing circle (RN has no CSS radial-gradient/blur without an extra
// dep) rather than a literal port of the web's box-shadow bloom.
function GlowHalo({ active }: { active: boolean }) {
  const opacity = useSharedValue(0);
  useEffect(() => {
    if (active) {
      opacity.value = withRepeat(withTiming(0.55, { duration: 1300, easing: Easing.inOut(Easing.ease) }), -1, true);
    } else {
      cancelAnimation(opacity);
      opacity.value = withTiming(0, { duration: 250 });
    }
    return () => cancelAnimation(opacity);
  }, [active, opacity]);

  const style = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        { position: "absolute", width: 84, height: 84, borderRadius: 42, backgroundColor: GOLD, opacity: 0.25 },
        style,
      ]}
    />
  );
}

interface Props {
  station: StationView;
  isCurrent: boolean;
  isPlaying: boolean;
  isFavorite: boolean;
  onPlay: (station: StationView) => void;
  onToggleFavorite: (slug: string) => void;
}

// Lantern-tile card — mirrors the web/extension design (arch shape, sun-glow-
// while-playing, star+waveform LIVE badge) adapted to RN grid tiles instead of
// the row list this card used to be. Meant for a 2-col flex-wrap grid (see
// app/radio/index.tsx and radio-preview-shelf.tsx).
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
      className={`relative overflow-hidden rounded-t-3xl rounded-b-2xl border bg-surface-2 px-3 pt-5 pb-4 items-center ${
        playingNow ? "border-primary/60" : "border-border"
      }`}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={isFavorite ? t("radio.unfavorite") : t("radio.favorite")}
        accessibilityState={{ selected: isFavorite }}
        onPress={() => onToggleFavorite(station.slug)}
        hitSlop={8}
        className="absolute end-1.5 top-1.5 z-10 size-8 items-center justify-center"
      >
        <Text className={isFavorite ? "text-lg text-primary" : "text-lg text-muted"}>
          {isFavorite ? "★" : "☆"}
        </Text>
      </Pressable>

      <View className="items-center justify-center">
        <GlowHalo active={playingNow} />
        <View className="size-14 items-center justify-center rounded-full bg-surface">
          {station.image ? (
            <Image source={{ uri: assetUrl(station.image) }} className="size-full rounded-full" resizeMode="cover" />
          ) : (
            <RadioGlyph />
          )}
        </View>
      </View>

      <Text variant="body" numberOfLines={1} className="mt-2 text-center text-sm">
        {station.name}
      </Text>

      <View className="mt-1.5 flex-row items-center gap-1.5">
        <Star8Icon />
        <WaveformMini playing={playingNow} />
        <Text className={`text-2xs font-semibold uppercase ${playingNow ? "text-primary" : "text-muted"}`}>
          {t("radio.live")}
        </Text>
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={playingNow ? t("player.pause") : t("player.play")}
        onPress={() => onPlay(station)}
        className="mt-3 size-11 items-center justify-center rounded-full bg-primary"
      >
        {playingNow ? <PauseIcon color={ON_PRIMARY} size={20} /> : <PlayIcon color={ON_PRIMARY} size={20} />}
      </Pressable>
    </View>
  );
}
