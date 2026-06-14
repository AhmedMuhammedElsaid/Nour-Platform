import { useCallback, useEffect, useRef, useState } from "react";
import { FlatList, Pressable, View } from "react-native";
import { useTranslation } from "react-i18next";
import type {
  QuranEdition,
  QuranReciter,
  ReaderAyah,
  SurahReader,
} from "@repo/shared-core/schemas/quran";

import { Text } from "@/components/ui/text";
import { cn } from "@/lib/cn";
import {
  getQuranBookmarks,
  isAyahBookmarked,
  setQuranLastRead,
  toggleQuranBookmark,
  type AyahRef,
  type QuranPrefs,
} from "@/lib/device-local";
import { usePlayer } from "@/lib/player-context";
import { useDockSpacing } from "@/lib/use-dock-spacing";
import { useAyahAudio } from "../hooks/use-ayah-audio";
import { AyahRow } from "./ayah-row";
import { ReaderSettingsSheet } from "./reader-settings-sheet";
import { TafsirSheet } from "./tafsir-sheet";

export interface ReaderProps {
  data: SurahReader;
  editions: QuranEdition[];
  reciters: QuranReciter[];
  locale: string;
  prefs: QuranPrefs;
  onChangePrefs: (next: QuranPrefs) => void;
}

// RN port of apps/web/features/quran/components/reader.tsx. The screen owns
// prefs (translation/reciter are part of its fetch key); this component owns
// bookmarks, ayah audio, the settings + tafsir sheets, and current-ayah scroll.
export function Reader({ data, editions, reciters, locale, prefs, onChangePrefs }: ReaderProps) {
  const { t } = useTranslation();
  const dockSpacing = useDockSpacing();
  const [bookmarks, setBookmarks] = useState<AyahRef[]>([]);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [tafsirAyah, setTafsirAyah] = useState<{ numberGlobal: number; ref: string } | null>(null);
  const listRef = useRef<FlatList<ReaderAyah>>(null);

  // The reader's ayah audio (expo-audio) and the site-wide RNTP player are
  // independent — coordinate them so they never play at once (point 3).
  const player = usePlayer();
  const audio = useAyahAudio(
    data.ayahs.map((a) => ({ numberGlobal: a.numberGlobal, audioUrl: a.audioUrl })),
    {
      onPlaybackStart: () => {
        if (player.isPlaying) player.pause();
      },
    },
  );

  // Reverse direction: starting the site-wide player stops the ayah audio.
  const { isPlaying: ayahPlaying, stop: stopAyah } = audio;
  const playerPlaying = player.isPlaying;
  useEffect(() => {
    if (playerPlaying && ayahPlaying) stopAyah();
  }, [playerPlaying, ayahPlaying, stopAyah]);

  const surahNameEn = data.surah.name.en;
  const translationDir = data.translationEdition?.dir ?? (locale === "ar" ? "rtl" : "ltr");

  // Hydrate bookmarks once.
  useEffect(() => {
    void getQuranBookmarks().then(setBookmarks);
  }, []);

  // Record last-read = first ayah of this surah on mount (drives the Home
  // "Continue reading" shelf).
  useEffect(() => {
    const first = data.ayahs[0];
    if (first) {
      void setQuranLastRead({
        surah: first.surah,
        ayahInSurah: first.ayahInSurah,
        numberGlobal: first.numberGlobal,
        surahName: surahNameEn,
      });
    }
  }, [data.ayahs, surahNameEn]);

  // Scroll the currently-playing ayah into view.
  useEffect(() => {
    if (audio.currentGlobal === null) return;
    const idx = data.ayahs.findIndex((a) => a.numberGlobal === audio.currentGlobal);
    if (idx >= 0) {
      listRef.current?.scrollToIndex({ index: idx, animated: true, viewPosition: 0.3 });
    }
  }, [audio.currentGlobal, data.ayahs]);

  const onToggleBookmark = useCallback(
    (ayah: ReaderAyah) => {
      void toggleQuranBookmark({
        surah: ayah.surah,
        ayahInSurah: ayah.ayahInSurah,
        numberGlobal: ayah.numberGlobal,
        surahName: surahNameEn,
      }).then(setBookmarks);
    },
    [surahNameEn],
  );

  // Same ayah toggles play/pause; a different ayah starts fresh.
  const onPlayToggle = useCallback(
    (numberGlobal: number) => {
      if (audio.currentGlobal === numberGlobal) audio.toggle();
      else audio.playAyah(numberGlobal);
    },
    [audio],
  );

  const display = data.surah.name;

  const header = (
    <View className="gap-3 pb-4">
      <View className="flex-row items-baseline justify-between gap-4">
        <Text variant="display" className="text-2xl text-primary">
          {display.en}
        </Text>
        <Text className="font-quran text-2xl text-text" style={{ writingDirection: "rtl" }}>
          {display.ar}
        </Text>
      </View>
      <Text variant="muted">
        {data.surah.meaning} · {data.surah.ayahCount} {t("quran.ayahs")}
      </Text>
      <View className="flex-row items-center gap-2">
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ selected: audio.repeatAyah }}
          onPress={() => audio.setRepeatAyah(!audio.repeatAyah)}
          className={cn(
            "rounded-md border px-3 py-1.5",
            audio.repeatAyah ? "border-primary" : "border-border",
          )}
        >
          <Text className={cn("text-sm", audio.repeatAyah ? "text-primary" : "text-text-2")}>
            🔁 {t("quran.repeatAyah")}
          </Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t("quran.settings")}
          onPress={() => setSettingsOpen(true)}
          className="ms-auto rounded-md border border-border px-3 py-1.5"
        >
          <Text className="text-sm text-text-2">⚙ {t("quran.settings")}</Text>
        </Pressable>
      </View>
    </View>
  );

  return (
    <>
      <FlatList<ReaderAyah>
        ref={listRef}
        className="flex-1 bg-bg px-4"
        data={data.ayahs}
        keyExtractor={(a) => String(a.numberGlobal)}
        ListHeaderComponent={header}
        contentContainerClassName="pt-4"
        contentContainerStyle={{ paddingBottom: dockSpacing }}
        onScrollToIndexFailed={() => undefined}
        renderItem={({ item }) => (
          <AyahRow
            ayah={item}
            showTranslation={prefs.showTranslation}
            translationDir={translationDir}
            showWordByWord={prefs.showWordByWord}
            fontScale={prefs.fontScale}
            isCurrent={audio.currentGlobal === item.numberGlobal}
            isPlaying={audio.isPlaying}
            isBookmarked={isAyahBookmarked(bookmarks, {
              surah: item.surah,
              ayahInSurah: item.ayahInSurah,
            })}
            onPlay={onPlayToggle}
            onToggleBookmark={onToggleBookmark}
            onOpenTafsir={(ng) => {
              const a = data.ayahs.find((x) => x.numberGlobal === ng);
              if (a) setTafsirAyah({ numberGlobal: ng, ref: `${a.surah}:${a.ayahInSurah}` });
            }}
          />
        )}
      />

      <ReaderSettingsSheet
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        prefs={prefs}
        onChange={onChangePrefs}
        editions={editions}
        reciters={reciters}
      />
      <TafsirSheet ayah={tafsirAyah} locale={locale} onClose={() => setTafsirAyah(null)} />
    </>
  );
}
