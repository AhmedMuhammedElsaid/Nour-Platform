import { Pressable, View } from "react-native";
import { useRouter } from "expo-router";
import Svg, { Circle } from "react-native-svg";
import type { QuranSurah } from "@repo/shared-core/schemas/quran";

import { Text } from "@/components/ui/text";

// RN port of apps/web/features/quran/components/surah-index.tsx — same
// illuminated-grid + reading-progress-ring treatment. The parent screen owns
// the FlatList grid (numColumns=2); this renders one tile.

// RN SVG can't consume CSS variables, so the ring is hardcoded to
// --color-primary / --color-border (dark) — same exception station-card.tsx
// already takes for its GOLD constant.
const RING_GOLD = "#c8a050";
const RING_TRACK = "rgba(200, 160, 80, 0.15)";

function ProgressRing({ pct, size = 44, strokeWidth = 3 }: { pct: number; size?: number; strokeWidth?: number }) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - Math.min(100, pct) / 100);
  return (
    <Svg width={size} height={size} style={{ transform: [{ rotate: "-90deg" }] }}>
      <Circle cx={size / 2} cy={size / 2} r={radius} stroke={RING_TRACK} strokeWidth={strokeWidth} fill="none" />
      <Circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        stroke={RING_GOLD}
        strokeWidth={strokeWidth}
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        strokeLinecap="round"
        fill="none"
      />
    </Svg>
  );
}

interface Props {
  surah: QuranSurah;
  // Reading progress (0-100) for THIS surah, or null. The parent screen reads
  // the single device-local last-read pointer once and matches it to one
  // surah — every other card gets null (a plain badge), never a fabricated 0%.
  progressPct: number | null;
}

export function SurahCard({ surah, progressPct }: Props) {
  const router = useRouter();
  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => router.push(`/quran/${surah.number}?autoplay=1`)}
      className="relative mb-3 flex-1 items-center gap-1 rounded-lg border border-border bg-surface p-4 pt-5"
    >
      <View pointerEvents="none" className="absolute start-2 top-2 h-3 w-3 border-l border-t border-primary/40" />
      <View pointerEvents="none" className="absolute end-2 bottom-2 h-3 w-3 border-r border-b border-primary/40" />

      {progressPct !== null ? (
        <View className="mb-1 items-center justify-center" style={{ width: 44, height: 44 }}>
          <ProgressRing pct={progressPct} />
          <View className="absolute size-9 items-center justify-center rounded-full bg-surface">
            <Text className="text-sm font-medium text-primary">{surah.number}</Text>
          </View>
        </View>
      ) : (
        <View className="mb-1 size-9 items-center justify-center rounded-full bg-primary/15">
          <Text className="text-sm font-medium text-primary">{surah.number}</Text>
        </View>
      )}

      <Text className="font-quran text-center text-2xl leading-relaxed text-primary" style={{ writingDirection: "rtl" }}>
        {surah.name.ar}
      </Text>
      <Text className="text-center text-sm font-medium text-text">{surah.name.en}</Text>
      <Text variant="muted" className="text-center text-xs">
        {surah.meaning} · {surah.ayahCount} ayahs
      </Text>
    </Pressable>
  );
}
