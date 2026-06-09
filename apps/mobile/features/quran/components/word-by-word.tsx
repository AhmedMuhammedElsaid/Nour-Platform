import { View } from "react-native";
import type { QuranWord } from "@repo/shared-core/schemas/quran";

import { Text } from "@/components/ui/text";

// RN port of apps/web/features/quran/components/word-by-word.tsx — a wrapping
// row of words, each with the Arabic glyph above an optional English gloss.
export function WordByWord({ words, fontScale }: { words: QuranWord[]; fontScale: number }) {
  return (
    <View className="flex-row flex-wrap gap-x-4 gap-y-3" accessibilityLabel="word-by-word">
      {words.map((w) => (
        <View key={w.position} className="items-center">
          <Text className="font-quran text-text" style={{ fontSize: 24 * fontScale, lineHeight: 24 * fontScale * 1.8 }}>
            {w.arabic}
          </Text>
          {w.glossEn ? <Text variant="muted" className="text-xs">{w.glossEn}</Text> : null}
        </View>
      ))}
    </View>
  );
}
