import { useCallback, useEffect, useRef, useState } from "react";
import { FlatList, Pressable, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect } from "expo-router";
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
  onBack: () => void;
  // Auto-start playback from the first ayah on mount (home Readers shelf →
  // Al-Fatiha in the tapped reciter's voice).
  autoStart?: boolean;
}

// RN port of apps/web/features/quran/components/reader.tsx. The screen owns
// prefs (translation/reciter are part of its fetch key); this component owns
// bookmarks, ayah audio, the settings + tafsir sheets, and current-ayah scroll.
// It also owns the single themed header (back + title + settings/repeat) —
// the Stack header is hidden to avoid the duplicate-title white bar (point 25).
export function Reader({ data, editions, reciters, locale, prefs, onChangePrefs, onBack, autoStart }: ReaderProps) {
  const { t } = useTranslation();
  const dockSpacing = useDockSpacing();
  const insets = useSafeAreaInsets();
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

  // Stop this reader's ayah audio whenever the screen loses focus — leaving via
  // back, a tab switch, or opening another surah. Each Reader owns its own
  // expo-audio player, which keeps playing after the screen is gone; without
  // this, re-entering from the home Readers shelf spins up a second player and
  // the two recitations overlap (the reported bug). Fires on blur AND unmount.
  useFocusEffect(useCallback(() => () => stopAyah(), [stopAyah]));

  // Autostart from the first ayah when arriving with autoStart (Readers shelf →
  // Al-Fatiha in the tapped voice). Fires once; RN has no autoplay gesture gate.
  const didAutoStart = useRef(false);
  const { playAyah } = audio;
  useEffect(() => {
    if (!autoStart || didAutoStart.current) return;
    const first = data.ayahs[0];
    if (!first?.audioUrl) return;
    didAutoStart.current = true;
    playAyah(first.numberGlobal);
  }, [autoStart, data.ayahs, playAyah]);

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
      <View className="flex-row items-center gap-2">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t("common.back")}
          onPress={onBack}
          className="-ms-2 size-9 items-center justify-center"
        >
          <Text className="text-2xl text-text">‹</Text>
        </Pressable>
        <View className="flex-1 flex-row items-baseline justify-between gap-4">
          <Text variant="display" className="text-2xl text-primary">
            {display.en}
          </Text>
          <Text className="font-quran text-2xl text-text" style={{ writingDirection: "rtl" }}>
            {display.ar}
          </Text>
        </View>
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
      {/* flex-1 wrapper so the status-bar scrim can overlay the list. The screen
          renders edge-to-edge under a transparent status bar (no global top
          SafeAreaView), so without this the surah title collided with the clock/
          battery icons and ayahs bled under them on scroll — same fix as Home. */}
      <View className="flex-1 bg-bg">
      <FlatList<ReaderAyah>
        ref={listRef}
        className="flex-1 bg-bg px-4"
        data={data.ayahs}
        keyExtractor={(a) => String(a.numberGlobal)}
        ListHeaderComponent={header}
        contentContainerStyle={{ paddingTop: insets.top + 12, paddingBottom: dockSpacing }}
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
        {/* Opaque scrim over the status-bar area — hides ayahs scrolled up behind
            the transparent status bar (mirrors app/index.tsx). */}
        <View
          pointerEvents="none"
          className="absolute left-0 right-0 top-0 bg-bg"
          style={{ height: insets.top }}
        />
      </View>

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
