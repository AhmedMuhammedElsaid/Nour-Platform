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
import { buildPageRows, type PageRow } from "@repo/shared-core/quran/page-rows";

import { ChevronLeftIcon, ChevronRightIcon, SettingsIcon } from "@/components/icons/player-icons";
import { Text } from "@/components/ui/text";
import {
  getQuranBookmarks,
  isAyahBookmarked,
  setQuranLastRead,
  toggleQuranBookmark,
  type AyahRef,
  type QuranPrefs,
} from "@/lib/device-local";
import { useTheme } from "@/lib/theme-context";
import { cn } from "@/lib/cn";
import { usePlayerActions, usePlayerTransport } from "@/lib/player-context";
import { useDockSpacing } from "@/lib/use-dock-spacing";
import { ayahTrackId, buildAyahQueue, buildPageQueue, parseAyahTrackId } from "../lib/ayah-queue";
import { countAdvanceGlyphs, fitMushafFontSize } from "../lib/fit-mushaf-font";
import { localizeDigits } from "../lib/page-groups";
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
  // List mode's prev/next surah control (point 5) — mushaf mode pages via
  // onChangePage instead, since a Madani page can span multiple surahs.
  onChangeSurah: (surah: number) => void;
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
// Rows grouped by the surah they belong to. A surah with no rows is simply
// absent from the map, so the lookup below yields `undefined` → `null` — never
// a TRUTHY empty array, which would make MushafSegment render an empty page
// instead of falling back to its reflow path.
const MIN_SURAH = 1;
const MAX_SURAH = 114;

// SVG strokes can't read NativeWind classes (see components/icons/tab-icons.tsx);
// resolved by hand, same pattern as bottom-tab-bar.tsx.
const TEXT_HEX = { dark: "#f0e6cc", light: "#13201a" } as const;
const TEXT_2_HEX = { dark: "#8a7a62", light: "#3f4a44" } as const;

function groupRowsBySurah(pageRows: PageRow[] | null): Map<number, PageRow[]> {
  const bySurah = new Map<number, PageRow[]>();
  for (const row of pageRows ?? []) {
    const own = bySurah.get(row.surahNumber);
    if (own) own.push(row);
    else bySurah.set(row.surahNumber, [row]);
  }
  return bySurah;
}

export function Reader({
  data,
  pageData,
  entrySurah,
  onChangePage,
  onChangeSurah,
  editions,
  reciters,
  locale,
  prefs,
  onChangePrefs,
  onBack,
  autoStart,
}: ReaderProps) {
  const { t, i18n } = useTranslation();
  const { theme } = useTheme();
  const textColor = TEXT_HEX[theme];
  const text2Color = TEXT_2_HEX[theme];
  // The local `+24` this screen carried is gone: it was compensating for the
  // OLD useDockSpacing() flat-8dp base, which under-covered the real tab-bar
  // (+ mini-player, when ayah audio has a queue loaded) height everywhere, not
  // just here. The hook now computes that real height directly (2026-08-02).
  const dockSpacing = useDockSpacing();
  const insets = useSafeAreaInsets();
  const isMushaf = prefs.layout === "mushaf";
  const [bookmarks, setBookmarks] = useState<AyahRef[]>([]);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [tafsirAyah, setTafsirAyah] = useState<{ numberGlobal: number; ref: string } | null>(null);
  const [selectedGlobal, setSelectedGlobal] = useState<number | null>(null);
  const listRef = useRef<FlatList<ReaderAyah>>(null);
  const mushafRef = useRef<FlatList<PageSegment>>(null);
  // Measured mushaf reading area (the Animated.View wrapping the FlatList).
  // Zero until first layout — fitMushafFontSize falls back to its floor, so the
  // first frame renders legible text rather than nothing.
  const [readingArea, setReadingArea] = useState({ width: 0, height: 0 });

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
  // continuity cue, not required for correctness. Also resets scroll to the
  // top (point 5): a page turn should always land the reader at the START of
  // the new page, not wherever the previous page happened to be scrolled to.
  // List mode needs no equivalent here — its surah nav goes through
  // onChangeSurah, which replaces the route param, remounting this whole
  // screen with a fresh (already-zero) FlatList.
  useEffect(() => {
    if (!isMushaf) return;
    pageOpacity.setValue(0);
    Animated.timing(pageOpacity, { toValue: 1, duration: 160, useNativeDriver: true }).start();
    mushafRef.current?.scrollToOffset({ offset: 0, animated: false });
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
  // Transport + actions only: the reader highlights/scrolls from currentTrack
  // and issues play commands, but never reads the queue array or the prefs
  // (rate/volume/sleep-timer), so it must not re-render when those change.
  const transport = usePlayerTransport();
  const actions = usePlayerActions();
  const player = useMemo(() => ({ ...transport, ...actions }), [transport, actions]);

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

  // Line-for-line printed layout, page-level (mirrors apps/web/features/quran/
  // components/mushaf-page-view.tsx): one buildPageRows() call across every
  // segment on the page, since a segment with ayahs but no usable per-word
  // line data bails the WHOLE page to the reflow fallback, not just its own
  // segment. Each MushafSegment then gets its own slice, filtered by surah
  // number, below.
  const pageRows = useMemo(
    () =>
      pageData
        ? buildPageRows({
            page: pageData.page,
            segments: pageData.segments.map((segment) => ({
              surahNumber: segment.surah.number,
              showBismillah: segment.showBismillah,
              surahAyahCount: segment.surah.ayahCount,
              ayahs: segment.ayahs.map((ayah) => ({
                numberGlobal: ayah.numberGlobal,
                ayahInSurah: ayah.ayahInSurah,
                words: ayah.words.map((word) => ({
                  position: word.position,
                  arabic: word.arabic,
                  line: word.line,
                  page: word.page,
                })),
              })),
            })),
          })
        : null,
    [pageData],
  );

  // Grouped once per page so each <MushafSegment> receives a STABLE rows array.
  // Filtering inline in renderItem produced a fresh array every render, which
  // changed identity all the way down and defeated the per-line memoisation in
  // mushaf-page.tsx (an ayah tap re-rendered the entire page's word tree).
  const rowsBySurah = useMemo(() => groupRowsBySurah(pageRows), [pageRows]);

  // Auto-fit the mushaf type to the measured reading area so the page's ayahs
  // FILL it — the owner's actual bar, and the thing four rounds of pure layout
  // tweaks never reached (they moved the footer toward the content; this grows
  // the content to meet the footer). Recomputed per page because text volume
  // swings ~2x between a dense Al-Baqarah page and a juz-30 one.
  const mushafFontSize = useMemo(() => {
    if (!pageData) return 0;
    let glyphCount = 0;
    let bismillahCount = 0;
    for (const segment of pageData.segments) {
      if (segment.showBismillah) bismillahCount += 1;
      for (const ayah of segment.ayahs) {
        // +3 for the inline end-of-ayah marker and its surrounding spaces.
        glyphCount += countAdvanceGlyphs(ayah.textUthmani) + 3;
      }
    }
    return fitMushafFontSize({
      glyphCount,
      segmentCount: pageData.segments.length,
      bismillahCount,
      // The FlatList carries px-4 (16dp each side) inside the measured wrapper.
      // Deliberately NOT subtracting dockSpacing here (a prior version did) —
      // the FlatList's contentContainerStyle already applies dockSpacing as
      // paddingBottom, and because this content is flexGrow:1 +
      // justifyContent:"space-between" (fills the viewport, THEN padding adds
      // on top of that), subtracting it a second time here reserved the same
      // space twice: once by under-sizing the fitted content, and again via
      // the padding. With the old flat ~8dp dockSpacing the double-count was
      // ~16dp and invisible; once dockSpacing became the real dock height
      // (~150dp+, see use-dock-spacing.ts) it showed up as a large empty gap
      // between the footer and the mini-player — owner-reported 2026-08-02.
      width: readingArea.width - 32,
      height: readingArea.height - 4,
      fontScale: prefs.fontScale,
      // The page's REAL printed line count, when the layout data is there — a
      // fixed number of rows is strictly better information than estimating
      // lines from glyphCount/charsPerLine (that estimate assumes reflow to
      // the measured width, which is only what the FALLBACK path does).
      lineCount: pageRows?.filter((row) => row.kind === "line").length,
    });
  }, [pageData, pageRows, readingArea, prefs.fontScale]);

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

  const renderMushafSegment = useCallback(
    ({ item }: { item: PageSegment }) => (
      <MushafSegment
        segment={item}
        rows={rowsBySurah.get(item.surah.number) ?? null}
        fontSize={mushafFontSize}
        activeGlobal={activeGlobal}
        selectedGlobal={selectedGlobal}
        onSelectAyah={onSelectAyah}
      />
    ),
    [rowsBySurah, mushafFontSize, activeGlobal, selectedGlobal, onSelectAyah],
  );

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

  // ---------------------------------------------------------------------
  // Chrome — "edge chevrons + centre chip" (owner-picked concept A3 from the
  // design review). One fixed top row (back · juz chip · settings, ~44dp) is
  // shared by both modes; page/surah turning moves OFF the top row entirely
  // and onto large edge-pinned chevrons over the reading area itself, closer
  // to a real page-corner tap. The old mushaf header's second pill row is
  // gone — every dp it used to cost is now available to the ayahs. Surah
  // identity (name/meaning/ayah count) and the Bismillah stay inside the
  // scroll area for the same reason the old comment gave: hoisting them into
  // fixed chrome costs ~120dp and, in mushaf mode, can caption the WRONG
  // surah (segments[0] is whoever owns the page's first ayah, not the one
  // navigated from).
  const topJuz = isMushaf ? pageData?.juz : data?.ayahs[0]?.juz;
  const topBar = (
    <View className="flex-row items-center gap-2">
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t("common.back")}
        onPress={onBack}
        className="-ms-2 size-9 items-center justify-center"
      >
        <ChevronLeftIcon color={textColor} size={22} />
      </Pressable>
      <View className="flex-1 items-center">
        {topJuz != null && (
          <View className="rounded-full border border-border px-2.5 py-1">
            <Text className="text-xs text-text-2" numberOfLines={1}>
              {t("quran.juzN", { number: localizeDigits(topJuz, i18n.language) })}
            </Text>
          </View>
        )}
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t("quran.settings")}
        onPress={() => setSettingsOpen(true)}
        className="-me-1 size-9 items-center justify-center"
      >
        <SettingsIcon color={text2Color} size={20} />
      </Pressable>
    </View>
  );

  // Surah identity block — scrolls away with the rest of list-mode content
  // (it's the FlatList's ListHeaderComponent), unlike topBar above it.
  const listContentHeader = data ? (
    <View className="gap-1.5 pb-4">
      <View className="flex-row items-baseline justify-between gap-4">
        <Text variant="display" className="text-2xl text-primary">
          {data.surah.name.en}
        </Text>
        <Text className="font-quran text-2xl text-text" style={{ writingDirection: "rtl" }}>
          {data.surah.name.ar}
        </Text>
      </View>
      <Text variant="muted">
        {data.surah.meaning} · {data.surah.ayahCount} {t("quran.ayahs")}
      </Text>
    </View>
  ) : null;

  // Edge-pinned chevron pair, absolutely positioned over the reading area
  // (a sibling of the FlatList inside a `position: relative` wrapper — see
  // the two call sites below). `disabled` mirrors the old pill row's bounds
  // logic exactly (mushaf: page 1 / the last page; list: surah 1 / 114).
  //
  // History: this shipped TWICE with the button fully functional (correct
  // tap target per the accessibility tree, correct navigation) but painting
  // NOTHING — first with a NativeWind `top-1/2 -mt-[18px]` combo, then with
  // an inline `top: "50%"` + translateY transform. Neither is used now.
  // Instead: a full-height strip (top:0, bottom:0 — both anchors, no
  // percentage-of-self or transform math for Yoga to get wrong) centers the
  // button via plain flexbox (justifyContent/alignItems), the same proven
  // centering mechanism used everywhere else in this app. If a THIRD attempt
  // is ever needed, suspect something other than the positioning technique.
  function EdgeNav({
    onPrev,
    onNext,
    prevDisabled,
    nextDisabled,
    prevLabel,
    nextLabel,
  }: {
    onPrev: () => void;
    onNext: () => void;
    prevDisabled: boolean;
    nextDisabled: boolean;
    prevLabel: string;
    nextLabel: string;
  }) {
    return (
      <>
        <View
          pointerEvents="box-none"
          style={{ position: "absolute", top: 0, bottom: 0, insetInlineStart: 4, justifyContent: "center" }}
        >
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={prevLabel}
            disabled={prevDisabled}
            onPress={onPrev}
            className={cn(
              "size-9 items-center justify-center rounded-full bg-surface/90",
              prevDisabled && "opacity-0",
            )}
          >
            <ChevronLeftIcon color={textColor} size={20} />
          </Pressable>
        </View>
        <View
          pointerEvents="box-none"
          style={{ position: "absolute", top: 0, bottom: 0, insetInlineEnd: 4, justifyContent: "center" }}
        >
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={nextLabel}
            disabled={nextDisabled}
            onPress={onNext}
            className={cn(
              "size-9 items-center justify-center rounded-full bg-surface/90",
              nextDisabled && "opacity-0",
            )}
          >
            <ChevronRightIcon color={textColor} size={20} />
          </Pressable>
        </View>
      </>
    );
  }

  return (
    <>
      {/* flex-1 wrapper so the status-bar scrim can overlay the list. The screen
          renders edge-to-edge under a transparent status bar (no global top
          SafeAreaView), so without this the surah title collided with the clock/
          battery icons and ayahs bled under them on scroll — same fix as Home. */}
      <View className="flex-1 bg-bg">
        {isMushaf ? (
          pageData ? (
            <>
              {/* Rendered as a fixed sibling, NOT ListHeaderComponent, so it isn't one
                  of the FlatList's own flex-distributed children below — with only the
                  segment(s) and the footer left as siblings, justifyContent: "space-between"
                  puts its one gap exactly where it belongs (between content and footer)
                  instead of also opening a gap here, above the content. */}
              <View className="px-4" style={{ paddingTop: insets.top + 12 }}>
                {topBar}
              </View>
              <Animated.View
                style={{ flex: 1, opacity: pageOpacity, position: "relative" }}
                onLayout={(e) => {
                  const { width, height } = e.nativeEvent.layout;
                  setReadingArea((cur) =>
                    cur.width === width && cur.height === height ? cur : { width, height },
                  );
                }}
                {...mushafPanResponder.panHandlers}
              >
                <FlatList<PageSegment>
                  ref={mushafRef}
                  className="flex-1 bg-bg px-4"
                  data={pageData.segments}
                  keyExtractor={(s) => `${pageData.page}-${s.surah.number}`}
                  ListFooterComponent={
                    <View className="items-center border-t border-primary/30 pb-6 pt-3">
                      <Text className="text-sm text-text-2">
                        {t("quran.pageN", { number: localizeDigits(pageData.page, i18n.language) })} ·{" "}
                        {t("quran.juzN", { number: localizeDigits(pageData.juz, i18n.language) })}
                      </Text>
                    </View>
                  }
                  // flexGrow: 1 lets the content grow to at least fill the FlatList's
                  // viewport on a short page; justifyContent: "space-between" then puts
                  // all the leftover space in the one gap between the segment(s) and the
                  // footer, pinning the footer to the bottom (RN's Yoga does NOT reliably
                  // support margin: "auto" on the main axis the way CSS flexbox does on
                  // web — tried first, confirmed via adb+logcat to have no on-device
                  // effect, before switching to this).
                  contentContainerStyle={{
                    flexGrow: 1,
                    justifyContent: "space-between",
                    paddingTop: 4,
                    paddingBottom: dockSpacing,
                  }}
                  onScrollToIndexFailed={() => undefined}
                  renderItem={renderMushafSegment}
                />
                <EdgeNav
                  onPrev={() => pageData.prevPage !== null && onChangePage(pageData.prevPage)}
                  onNext={() => pageData.nextPage !== null && onChangePage(pageData.nextPage)}
                  prevDisabled={pageData.prevPage === null}
                  nextDisabled={pageData.nextPage === null}
                  prevLabel={t("quran.prevPage")}
                  nextLabel={t("quran.nextPage")}
                />
              </Animated.View>
            </>
          ) : null
        ) : data ? (
          <>
            <View className="px-4" style={{ paddingTop: insets.top + 12 }}>
              {topBar}
            </View>
            <View style={{ flex: 1, position: "relative" }}>
              <FlatList<ReaderAyah>
                ref={listRef}
                className="flex-1 bg-bg px-4"
                data={data.ayahs}
                keyExtractor={(a) => String(a.numberGlobal)}
                ListHeaderComponent={listContentHeader}
                ListFooterComponent={
                  <View className="items-center border-t border-primary/30 pb-6 pt-3">
                    <Text className="text-sm text-text-2">
                      {t("quran.surahNOfTotal", {
                        number: localizeDigits(data.surah.number, i18n.language),
                        total: localizeDigits(MAX_SURAH, i18n.language),
                      })}
                    </Text>
                  </View>
                }
                // Plain scroll, unlike the mushaf FlatList below — list mode has
                // no "fill the page" mandate (that's specific to the printed-page
                // mushaf illusion), so there is no reason to flexGrow+space-between
                // pin the footer to the viewport bottom. Doing that on a SHORT
                // surah (e.g. Al-Fatihah) stretched the content to fill the
                // viewport and then ADDED dockSpacing padding on top of that
                // already-filled height, double-reserving space and showing as a
                // large empty gap above the mini-player — same bug as the mushaf
                // fit model's now-removed `- dockSpacing` term, different cause.
                contentContainerStyle={{ paddingTop: 4, paddingBottom: dockSpacing }}
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
              <EdgeNav
                onPrev={() =>
                  data.surah.number > MIN_SURAH && onChangeSurah(data.surah.number - 1)
                }
                onNext={() =>
                  data.surah.number < MAX_SURAH && onChangeSurah(data.surah.number + 1)
                }
                prevDisabled={data.surah.number <= MIN_SURAH}
                nextDisabled={data.surah.number >= MAX_SURAH}
                prevLabel={t("quran.prevSurah")}
                nextLabel={t("quran.nextSurah")}
              />
            </View>
          </>
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
