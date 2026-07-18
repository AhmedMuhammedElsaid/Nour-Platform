import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FlatList, Pressable, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import type {
  QuranEdition,
  QuranReciter,
  ReaderAyah,
  SurahReader,
} from "@repo/shared-core/schemas/quran";

import { Text } from "@/components/ui/text";
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
import { ayahTrackId, buildAyahQueue, parseAyahTrackId } from "../lib/ayah-queue";
import { groupAyahsByPage, type AyahPageGroup } from "../lib/page-groups";
import { AyahRow } from "./ayah-row";
import { MushafPage } from "./mushaf-page";
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
  const [selectedGlobal, setSelectedGlobal] = useState<number | null>(null);
  const listRef = useRef<FlatList<ReaderAyah>>(null);
  const mushafRef = useRef<FlatList<AyahPageGroup>>(null);

  // Mushaf (Safha) page layout — groups the same ayahs by their `page` field
  // (1-604, already on every ReaderAyah) instead of one row per ayah.
  const pageGroups = useMemo(() => groupAyahsByPage(data.ayahs), [data.ayahs]);
  const onSelectAyah = useCallback((numberGlobal: number) => {
    setSelectedGlobal((cur) => (cur === numberGlobal ? null : numberGlobal));
  }, []);

  // Quran recitation plays through the site-wide RNTP player (one engine), so it
  // gets the mini-player + lock-screen controls and keeps playing when you leave
  // the reader. The reader builds a per-ayah queue and reads back the active ayah
  // from player.currentTrack for highlight + scroll.
  const player = usePlayer();
  const queue = useMemo(
    () => buildAyahQueue(data.surah, data.ayahs, data.reciter, locale),
    [data.surah, data.ayahs, data.reciter, locale],
  );
  const activeGlobal = parseAyahTrackId(player.currentTrack?.id);

  // Autostart from the first ayah when arriving with autoStart (Readers shelf →
  // Al-Fatiha in the tapped voice). Fires once; RN has no autoplay gesture gate.
  const didAutoStart = useRef(false);
  const { loadQueue } = player;
  useEffect(() => {
    if (!autoStart || didAutoStart.current || queue.length === 0) return;
    didAutoStart.current = true;
    loadQueue(queue, 0);
  }, [autoStart, queue, loadQueue]);

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

  // Scroll the currently-playing ayah into view — list mode scrolls to the
  // ayah's own row; mushaf mode scrolls to the page group that contains it.
  useEffect(() => {
    if (activeGlobal === null) return;
    if (prefs.layout === "mushaf") {
      const idx = pageGroups.findIndex((g) => g.ayahs.some((a) => a.numberGlobal === activeGlobal));
      if (idx >= 0) {
        mushafRef.current?.scrollToIndex({ index: idx, animated: true, viewPosition: 0.1 });
      }
      return;
    }
    const idx = data.ayahs.findIndex((a) => a.numberGlobal === activeGlobal);
    if (idx >= 0) {
      listRef.current?.scrollToIndex({ index: idx, animated: true, viewPosition: 0.3 });
    }
  }, [activeGlobal, data.ayahs, prefs.layout, pageGroups]);

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

  // Same ayah toggles play/pause; a different ayah (re)loads the queue at it.
  const onPlayToggle = useCallback(
    (numberGlobal: number) => {
      if (activeGlobal === numberGlobal) {
        player.toggle();
        return;
      }
      const idx = queue.findIndex((tk) => tk.id === ayahTrackId(numberGlobal));
      if (idx < 0) return;
      player.loadQueue(queue, idx);
    },
    [activeGlobal, queue, player],
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
      {prefs.layout === "mushaf" ? (
      <FlatList<AyahPageGroup>
        ref={mushafRef}
        className="flex-1 bg-bg px-4"
        data={pageGroups}
        keyExtractor={(g) => String(g.page)}
        ListHeaderComponent={header}
        contentContainerStyle={{ paddingTop: insets.top + 12, paddingBottom: dockSpacing }}
        onScrollToIndexFailed={() => undefined}
        renderItem={({ item, index }) => (
          <MushafPage
            group={item}
            fontScale={prefs.fontScale}
            showBismillah={index === 0 && data.surah.bismillahPre && data.surah.number !== 1}
            activeGlobal={activeGlobal}
            selectedGlobal={selectedGlobal}
            onSelectAyah={onSelectAyah}
          />
        )}
      />
      ) : (
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
            isCurrent={activeGlobal === item.numberGlobal}
            isPlaying={player.isPlaying && activeGlobal === item.numberGlobal}
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
      )}
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
