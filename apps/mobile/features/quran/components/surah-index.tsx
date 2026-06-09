import { Pressable, View } from "react-native";
import { useRouter } from "expo-router";
import type { QuranSurah } from "@repo/shared-core/schemas/quran";

import { Text } from "@/components/ui/text";

// RN port of apps/web/features/quran/components/surah-index.tsx. Rendered as a
// list of pressable rows (the parent screen owns the FlatList; this maps a
// pre-sliced array so it can sit inside a ListHeader or its own list).
export function SurahRow({ surah }: { surah: QuranSurah }) {
  const router = useRouter();
  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => router.push(`/quran/${surah.number}`)}
      className="flex-row items-center gap-3 border-b border-border px-1 py-3"
    >
      <Text className="h-9 w-9 rounded-full bg-surface-2 text-center text-sm font-medium leading-9 text-primary">
        {surah.number}
      </Text>
      <View className="min-w-0 flex-1">
        <Text className="font-medium text-text">{surah.name.en}</Text>
        <Text variant="muted" className="text-sm">
          {surah.meaning} · {surah.ayahCount} · {surah.revelationPlace}
        </Text>
      </View>
      <Text className="font-quran text-xl text-primary" style={{ writingDirection: "rtl" }}>
        {surah.name.ar}
      </Text>
    </Pressable>
  );
}
