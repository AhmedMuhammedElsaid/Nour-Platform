import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Animated, FlatList, PanResponder, Pressable, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import type {
  PageReader,
  PageSegment,
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
import { cn } from "@/lib/cn";
import { usePlayer } from "@/lib/player-context";
import { useDockSpacing } from "@/lib/use-dock-spacing";
import { ayahTrackId, buildAyahQueue, buildPageQueue, parseAyahTrackId } from "../lib/ayah-queue";
import { MUSHAF_SWIPE_THRESHOLD, resolveSwipeDirection } from "../lib/swipe";
import { AyahRow } from "./ayah-row";
import { MushafSegment } from "./mushaf-page";
import { ReaderSettingsSheet } from "./reader-settings-sheet";
import { TafsirSheet } from "./tafsir-sheet";

export interface ReaderProps {
  // List mode payload — non-null iff prefs.layout === "list" (screen only
  // mounts <Reader> once its active query has data).
  data: SurahReader | null;
  // Mushaf/page mode payload — non-null iff prefs.layout === "mushaf".
  pageData: PageReader | null;
  // The surah number this reader was opened from (route param) — used to pick
  // the right autoplay offset within a page that spans multiple surahs.
  entrySurah: number;
  onChangePage: (page: number) => void;
  editions: QuranEdition[];
  reciters: QuranReciter[];
  locale: string;
  prefs: QuranPrefs;
  onChangePrefs: (next: QuranPrefs) => void;
  onBack: () => void;
  // Auto-start playback from the first ayah on mount (home Readers shelf →
  // Al-Fatiha in the tapped reciter's voice; surah/juz taps → autoplay=1).
  autoStart?: boolean;
}

// RN port of apps/web/features/quran/components/reader.tsx. The screen owns
// prefs + which query is active (list = one surah; mushaf = one Madani mushaf
// page, GET /quran/page/:n, which may span multiple surahs). This component
// owns bookmarks, ayah audio, the settings + tafsir sheets, and current-ayah
// scroll for BOTH modes. It also owns the single themed header (back + title
// + settings/repeat) — the Stack header is hidden to avoid the duplicate-title
// white bar (point 25).
export function Reader({
  data,
  pageData,
  entrySurah,
  onChangePage,
  editions,
  reciters,
  locale,
  prefs,
  onChangePrefs,
  onBack,
  autoStart,
}: ReaderProps) {
  const { t } = useTranslation();
  const dockSpacing = useDockSpacing();
  const insets = useSafeAreaInsets();
  const isMushaf = prefs.layout === "mushaf";
  const [bookmarks, setBookmarks] = useState<AyahRef[]>([]);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [tafsirAyah, setTafsirAyah] = useState<{ numberGlobal: number; ref: string } | null>(null);
  const [selectedGlobal, setSelectedGlobal] = useState<number | null>(null);
  const listRef = useRef<FlatList<ReaderAyah>>(null);
  const mushafRef = useRef<FlatList<PageSegment>>(null);

  // Swipe-to-turn-page (Mushaf mode only) — additive to the header Prev/Next
  // buttons, same onChangePage target. Built on RN core's PanResponder (no
  // react-native-gesture-handler in this workspace; see slider.tsx for the
  // existing PanResponder precedent). The responder + its handlers are
  // created once and read pageData/onChangePage through refs so a page swap
  // doesn't require rebuilding the gesture instance mid-lifecycle.
  const pageDataRef = useRef(pageData);
  pageDataRef.current = pageData;
  const onChangePageRef = useRef(onChangePage);
  onChangePageRef.current = onChangePage;
  const pageOpacity = useRef(new Animated.Value(1)).current;
  const mushafPanResponder = useRef(
    PanResponder.create({
      // Never claim on touch-start — only once the drag proves itself
      // horizontal, so taps (ayah selection) and vertical scrolls (a page
      // whose 2 segments overflow the viewport) are left untouched.
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_evt, gesture) =>
        Math.abs(gesture.dx) > Math.abs(gesture.dy) && Math.abs(gesture.dx) > MUSHAF_SWIPE_THRESHOLD,
      onPanResponderRelease: (_evt, gesture) => {
        const direction = resolveSwipeDirection(gesture.dx, gesture.dy);
        const pd = pageDataRef.current;
        if (!direction || !pd) return;
        // Left-to-right drag (positive dx) = forward = next page; right-to-left
        // (negative dx) = backward = prev page — fixed regardless of AR/EN
        // locale (see lib/swipe.ts). null at the mushaf's ends = no-op, same
        // boundary the header buttons' `disabled` already respects.
        if (direction === "forward" && pd.nextPage !== null) {
          onChangePageRef.current(pd.nextPage);
        } else if (direction === "backward" && pd.prevPage !== null) {
          onChangePageRef.current(pd.prevPage);
        }
      },
    }),
  ).current;

  // Brief fade-in whenever the page changes (swipe or button) — cheap visual
  // continuity cue, not required for correctness.
  useEffect(() => {
    if (!isMushaf) return;
    pageOpacity.setValue(0);
    Animated.timing(pageOpacity, { toValue: 1, duration: 160, useNativeDriver: true }).start();
  }, [pageData?.page, isMushaf, pageOpacity]);

  const onSelectAyah = useCallback((numberGlobal: number) => {
    setSelectedGlobal((cur) => (cur === numberGlobal ? null : numberGlobal));
  }, []);

  // Reset the ayah highlight when the page changes underneath it (a stale
  // selection would otherwise never clear itself, since numberGlobal ids are
  // never reused across pages).
  useEffect(() => {
    setSelectedGlobal(null);
  }, [pageData?.page]);

  // Quran recitation plays through the site-wide RNTP player (one engine), so it
  // gets the mini-player + lock-screen controls and keeps playing when you leave
  // the reader. The reader builds a per-ayah queue and reads back the active ayah
  // from player.currentTrack for highlight + scroll.
  const player = usePlayer();

  // List mode: one surah's queue (unchanged).
  const listQueue = useMemo(
    () => (data ? buildAyahQueue(data.surah, data.ayahs, data.reciter, locale) : []),
    [data, locale],
  );
  // Mushaf/page mode: a page can hold 2+ segments (short surahs sharing a
  // page, common in juz 30) — buildPageQueue concatenates one per-segment
  // queue per page so playback flows across the segment boundary.
  const pageQueue = useMemo(
    () => (pageData ? buildPageQueue(pageData.segments, pageData.reciter, locale) : []),
    [pageData, locale],
  );
  const queue = isMushaf ? pageQueue : listQueue;
  const activeGlobal = parseAyahTrackId(player.currentTrack?.id);

  // Where autoStart should begin: list mode always starts at the surah's first
  // ayah (index 0). Mushaf mode's page may open mid-surah or lead with the
  // tail of a preceding surah, so autoplay must find the entry surah's own
  // segment on this page rather than always starting at track 0.
  const autoStartIndex = useMemo(() => {
    if (!isMushaf || !pageData) return 0;
    const segment = pageData.segments.find((s) => s.surah.number === entrySurah);
    const firstAyah = segment?.ayahs[0];
    if (!firstAyah) return 0;
    const idx = queue.findIndex((tk) => tk.id === ayahTrackId(firstAyah.numberGlobal));
    return idx >= 0 ? idx : 0;
  }, [isMushaf, pageData, entrySurah, queue]);

  // Autostart from the first ayah when arriving with autoStart (Readers shelf →
  // Al-Fatiha in the tapped voice). Fires once; RN has no autoplay gesture gate.
  const didAutoStart = useRef(false);
  const { loadQueue } = player;
  useEffect(() => {
    if (!autoStart || didAutoStart.current || queue.length === 0) return;
    didAutoStart.current = true;
    loadQueue(queue, autoStartIndex);
  }, [autoStart, queue, autoStartIndex, loadQueue]);

  // Reference ayah for "last read" (drives the Home "Continue reading" shelf):
  // list mode = the surah's first ayah; mushaf mode = the current page's first
  // segment's first ayah (best "where you are" reference for a page that may
  // open mid-surah).
  const referenceAyah = isMushaf ? pageData?.segments[0]?.ayahs[0] : data?.ayahs[0];
  const referenceSurahName = isMushaf ? pageData?.segments[0]?.surah.name.en : data?.surah.name.en;
  useEffect(() => {
    if (!referenceAyah) return;
    void setQuranLastRead({
      surah: referenceAyah.surah,
      ayahInSurah: referenceAyah.ayahInSurah,
      numberGlobal: referenceAyah.numberGlobal,
      surahName: referenceSurahName,
    });
  }, [referenceAyah, referenceSurahName]);

  const translationDir =
    (isMushaf ? pageData?.translationEdition?.dir : data?.translationEdition?.dir) ??
    (locale === "ar" ? "rtl" : "ltr");

  // Hydrate bookmarks once.
  useEffect(() => {
    void getQuranBookmarks().then(setBookmarks);
  }, []);

  // Scroll the currently-playing ayah into view — list mode scrolls to the
  // ayah's own row; mushaf mode scrolls to the segment that contains it.
  useEffect(() => {
    if (activeGlobal === null) return;
    if (isMushaf) {
      if (!pageData) return;
      const idx = pageData.segments.findIndex((s) => s.ayahs.some((a) => a.numberGlobal === activeGlobal));
      if (idx >= 0) {
        mushafRef.current?.scrollToIndex({ index: idx, animated: true, viewPosition: 0.1 });
      }
      return;
    }
    if (!data) return;
    const idx = data.ayahs.findIndex((a) => a.numberGlobal === activeGlobal);
    if (idx >= 0) {
      listRef.current?.scrollToIndex({ index: idx, animated: true, viewPosition: 0.3 });
    }
  }, [activeGlobal, isMushaf, data, pageData]);

  const onToggleBookmark = useCallback(
    (ayah: ReaderAyah) => {
      void toggleQuranBookmark({
        surah: ayah.surah,
        ayahInSurah: ayah.ayahInSurah,
        numberGlobal: ayah.numberGlobal,
        surahName: data?.surah.name.en,
      }).then(setBookmarks);
    },
    [data],
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

  const listHeader = data ? (
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
            {data.surah.name.en}
          </Text>
          <Text className="font-quran text-2xl text-text" style={{ writingDirection: "rtl" }}>
            {data.surah.name.ar}
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
  ) : null;

  const mushafHeader = pageData ? (
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
        <Text variant="display" className="flex-1 text-lg text-text-2">
          {t("quran.title")}
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t("quran.settings")}
          onPress={() => setSettingsOpen(true)}
          className="rounded-md border border-border px-3 py-1.5"
        >
          <Text className="text-sm text-text-2">⚙ {t("quran.settings")}</Text>
        </Pressable>
      </View>
      <View className="flex-row items-center justify-center gap-4">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t("quran.prevPage")}
          disabled={pageData.prevPage === null}
          onPress={() => pageData.prevPage !== null && onChangePage(pageData.prevPage)}
          className={cn("size-9 items-center justify-center", pageData.prevPage === null && "opacity-30")}
        >
          <Text className="text-2xl text-text">‹</Text>
        </Pressable>
        <Text variant="label">
          {t("quran.pageN", { number: pageData.page })} · {t("quran.juzN", { number: pageData.juz })}
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t("quran.nextPage")}
          disabled={pageData.nextPage === null}
          onPress={() => pageData.nextPage !== null && onChangePage(pageData.nextPage)}
          className={cn("size-9 items-center justify-center", pageData.nextPage === null && "opacity-30")}
        >
          <Text className="text-2xl text-text">›</Text>
        </Pressable>
      </View>
    </View>
  ) : null;

  return (
    <>
      {/* flex-1 wrapper so the status-bar scrim can overlay the list. The screen
          renders edge-to-edge under a transparent status bar (no global top
          SafeAreaView), so without this the surah title collided with the clock/
          battery icons and ayahs bled under them on scroll — same fix as Home. */}
      <View className="flex-1 bg-bg">
        {isMushaf ? (
          pageData ? (
            <Animated.View style={{ flex: 1, opacity: pageOpacity }} {...mushafPanResponder.panHandlers}>
              <FlatList<PageSegment>
                ref={mushafRef}
                className="flex-1 bg-bg px-4"
                data={pageData.segments}
                keyExtractor={(s) => `${pageData.page}-${s.surah.number}`}
                ListHeaderComponent={mushafHeader}
                ListFooterComponent={
                  <View className="mt-2 items-center border-t border-border pb-6 pt-3">
                    <Text variant="muted">
                      {t("quran.pageN", { number: pageData.page })} · {t("quran.juzN", { number: pageData.juz })}
                    </Text>
                  </View>
                }
                contentContainerStyle={{ paddingTop: insets.top + 12, paddingBottom: dockSpacing }}
                onScrollToIndexFailed={() => undefined}
                renderItem={({ item }) => (
                  <MushafSegment
                    segment={item}
                    fontScale={prefs.fontScale}
                    activeGlobal={activeGlobal}
                    selectedGlobal={selectedGlobal}
                    onSelectAyah={onSelectAyah}
                  />
                )}
              />
            </Animated.View>
          ) : null
        ) : data ? (
          <FlatList<ReaderAyah>
            ref={listRef}
            className="flex-1 bg-bg px-4"
            data={data.ayahs}
            keyExtractor={(a) => String(a.numberGlobal)}
            ListHeaderComponent={listHeader}
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
        ) : null}
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
