import { Pressable, View } from "react-native";
import { useTranslation } from "react-i18next";
import type { ReaderAyah } from "@repo/shared-core/schemas/quran";

import { Text } from "@/components/ui/text";
import { cn } from "@/lib/cn";
import { WordByWord } from "./word-by-word";
import { TranslationBlock } from "./translation-block";

export interface AyahRowProps {
  ayah: ReaderAyah;
  showTranslation: boolean;
  translationDir: "rtl" | "ltr";
  showWordByWord: boolean;
  fontScale: number;
  isCurrent: boolean;
  isPlaying: boolean;
  isBookmarked: boolean;
  onPlay: (numberGlobal: number) => void;
  onToggleBookmark: (ayah: ReaderAyah) => void;
  onOpenTafsir: (numberGlobal: number) => void;
}

// RN port of apps/web/features/quran/components/ayah-row.tsx. Icon buttons are
// unicode glyphs (no SVG/icon dep — same approach as the rest of mobile).
export function AyahRow({
  ayah,
  showTranslation,
  translationDir,
  showWordByWord,
  fontScale,
  isCurrent,
  isPlaying,
  isBookmarked,
  onPlay,
  onToggleBookmark,
  onOpenTafsir,
}: AyahRowProps) {
  const { t } = useTranslation();

  return (
    <View
      className={cn("border-b border-border py-5", isCurrent && "bg-surface-2")}
    >
      <View className="mb-3 flex-row items-center">
        <Text className="rounded-full bg-surface-2 px-2 py-0.5 text-sm font-medium text-primary">
          {ayah.ayahInSurah}
        </Text>
        <View className="ms-auto flex-row items-center gap-1">
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={isCurrent && isPlaying ? t("quran.pauseAyah") : t("quran.playAyah")}
            disabled={!ayah.audioUrl}
            onPress={() => onPlay(ayah.numberGlobal)}
            className={cn("rounded p-2", !ayah.audioUrl && "opacity-40")}
          >
            <Text className={cn("text-lg", isCurrent && "text-primary")}>
              {isCurrent && isPlaying ? "⏸" : "▶"}
            </Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={isBookmarked ? t("quran.removeBookmark") : t("quran.addBookmark")}
            onPress={() => onToggleBookmark(ayah)}
            className="rounded p-2"
          >
            <Text className={cn("text-lg", isBookmarked && "text-primary")}>
              {isBookmarked ? "🔖" : "🏷"}
            </Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t("quran.tafsir")}
            onPress={() => onOpenTafsir(ayah.numberGlobal)}
            className="rounded p-2"
          >
            <Text className="text-lg">📖</Text>
          </Pressable>
        </View>
      </View>

      {showWordByWord ? (
        <WordByWord words={ayah.words} fontScale={fontScale} />
      ) : (
        <Text
          className="font-quran text-text"
          style={{ fontSize: 30 * fontScale, lineHeight: 30 * fontScale * 2.2, writingDirection: "rtl" }}
        >
          {ayah.textUthmani}
          <Text className="text-primary"> ۝{ayah.ayahInSurah}</Text>
        </Text>
      )}

      {showTranslation && ayah.translation ? (
        <TranslationBlock text={ayah.translation} dir={translationDir} />
      ) : null}
    </View>
  );
}
