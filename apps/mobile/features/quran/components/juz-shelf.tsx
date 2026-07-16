import { Pressable, View } from "react-native";
import { useRouter } from "expo-router";
import type { JuzSurahEntry } from "@repo/shared-core/quran/juz";
import type { QuranSurah } from "@repo/shared-core/schemas/quran";

import { Text } from "@/components/ui/text";

// RN port of apps/web/features/quran/components/juz-shelf.tsx's row — the
// parent screen owns the SectionList (one section per juz); this renders one
// surah-within-a-juz row. `entry` carries the ayah range that belongs to
// THIS juz, which can be a partial slice of `surah` when a juz splits it.
export function JuzRow({ entry, surah }: { entry: JuzSurahEntry; surah: QuranSurah }) {
  const router = useRouter();
  const isPartial = entry.ayahStart > 1 || entry.ayahEnd < surah.ayahCount;
  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => router.push(`/quran/${entry.number}?autoplay=1`)}
      className="flex-row items-center gap-3 border-b border-border px-1 py-2.5"
    >
      <View className="size-8 items-center justify-center rounded-full bg-primary/15">
        <Text className="text-xs font-medium text-primary">{entry.number}</Text>
      </View>
      <View className="min-w-0 flex-1">
        <Text className="text-sm font-medium text-text">{surah.name.en}</Text>
        <Text variant="muted" className="text-xs">
          {isPartial ? `ayahs ${entry.ayahStart}-${entry.ayahEnd}` : `${surah.ayahCount} ayahs`}
        </Text>
      </View>
      <Text className="font-quran text-lg text-primary" style={{ writingDirection: "rtl" }}>
        {surah.name.ar}
      </Text>
    </Pressable>
  );
}
