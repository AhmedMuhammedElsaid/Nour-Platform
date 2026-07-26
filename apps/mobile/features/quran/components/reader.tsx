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
import {
  nextPartCursor,
  prevPartCursor,
  type PendingPart,
} from "@repo/shared-core/quran/page-parts";

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
  // Which of `pageData.segments` is the currently visible flip ("part"). A
  // Madani page can hold 2+ segments when it straddles a surah boundary (or
  // several short surahs share it in juz 30) — the reader shows exactly ONE
  // segment per flip, never a page's ending-surah and beginning-surah at
  // once. Resolved/settled by the screen (app/quran/[surah].tsx), not here:
  // that component survives the remounts <Reader> goes through on every page
  // change, so it's the only place a pending "land on the last segment of
  // the new page" intent can outlive the transition.
  part: number;
  onChangePage: (page: number, part: number | PendingPart) => void;
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
  part,
  onChangePage,
  editions,
  reciters,
  locale,
  prefs,
  onChangePrefs,
  onBack,
  autoStart,
}: ReaderProps) {
  const { t, i18n } = useTranslation();
  // Owner-reported 2026-07-22: the shared useDockSpacing() base gap (8dp,
  // right for the other screens using it) still let the last ayah/mushaf
  // footer sit under the bottom dock here specifically — this reader is the
  // one screen where the last item is routinely a full-width text block, not
  // a short row, so it needs more clearance. Extend locally rather than
  // raising the shared base (that would re-open the doubled-padding bug on
  // every other screen using the hook).
  const dockSpacing = useDockSpacing() + 24;
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
  // created once and read pageData/part/onChangePage through refs so a page
  // swap doesn't require rebuilding the gesture instance mid-lifecycle.
  const pageDataRef = useRef(pageData);
  pageDataRef.current = pageData;
  const partRef = useRef(part);
  partRef.current = part;
  const onChangePageRef = useRef(onChangePage);
  onChangePageRef.current = onChangePage;

  // Shared Prev/Next cursor math (button taps AND swipe) — both funnel
  // through page-parts.ts so the boundary behaviour can't drift between the
  // two triggers. Stable identity (only reads refs / calls the stable
  // setState-like onChangePage prop via its ref) so the PanResponder created
  // once below can close over it safely.
  const goToPart = useCallback((direction: "next" | "prev") => {
    const pd = pageDataRef.current;
    if (!pd) return;
    const cursor = { page: pd.page, part: partRef.current };
    const result =
      direction === "next"
        ? nextPartCursor(cursor, pd.segments.length, pd.nextPage)
        : prevPartCursor(cursor, pd.prevPage);
    if (!result) return; // null = already at the mushaf's start/end, no-op.
    onChangePageRef.current(result.page, result.part);
  }, []);

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
        // Left-to-right drag (positive dx) = forward = next flip; right-to-left
        // (negative dx) = backward = prev flip — fixed regardless of AR/EN
        // locale (see lib/swipe.ts). goToPart no-ops at the mushaf's ends,
        // same boundary the header buttons' `disabled` already respects.
        if (direction === "forward") goToPart("next");
        else if (direction === "backward") goToPart("prev");
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

  // Reset the ayah highlight when the page OR the visible part changes
  // underneath it (a stale selection would otherwise never clear itself,
  // since numberGlobal ids are never reused across pages/segments).
  useEffect(() => {
    setSelectedGlobal(null);
  }, [pageData?.page, part]);

  // Quran recitation plays through the site-wide RNTP player (one engine), so it
  // gets the mini-player + lock-screen controls and keeps playing when you leave
  // the reader. The reader builds a per-ayah queue and reads back the active ayah
  // from player.currentTrack for highlight + scroll.
  const player = usePlayer();

  // The single segment visible on this flip — `part` arrives already
  // resolved/clamped by the screen (app/quran/[surah].tsx) against this exact
  // pageData, so a plain index is always safe here.
  const segment = pageData?.segments[part] ?? null;

  // List mode: one surah's queue (unchanged).
  const listQueue = useMemo(
    () => (data ? buildAyahQueue(data.surah, data.ayahs, data.reciter, locale) : []),
    [data, locale],
  );
  // Mushaf/page mode: scoped to the ONE visible segment now (not the whole
  // page) — a page can hold 2+ segments (short surahs sharing a page, common
  // in juz 30), but only one is ever on screen at a time.
  const pageQueue = useMemo(
    () => (pageData && segment ? buildPageQueue([segment], pageData.reciter, locale) : []),
    [pageData, segment, locale],
  );
  const queue = isMushaf ? pageQueue : listQueue;
  const activeGlobal = parseAyahTrackId(player.currentTrack?.id);

  // Autostart from the first ayah when arriving with autoStart (Readers shelf →
  // Al-Fatiha in the tapped voice). Fires once; RN has no autoplay gesture gate.
  // Index 0 is always correct now: list mode's queue is the whole surah (as
  // before), and mushaf mode's queue is scoped to exactly the entry segment
  // (the screen resolves the entry `part` to the entrySurah's own segment),
  // so there's no longer a "which segment does entrySurah own" search to do.
  const didAutoStart = useRef(false);
  const { loadQueue } = player;
  useEffect(() => {
    if (!autoStart || didAutoStart.current || queue.length === 0) return;
    didAutoStart.current = true;
    loadQueue(queue, 0);
  }, [autoStart, queue, loadQueue]);

  // Reference ayah for "last read" (drives the Home "Continue reading" shelf):
  // list mode = the surah's first ayah; mushaf mode = the visible segment's
  // first ayah (best "where you are" reference for a page that may open
  // mid-surah).
  const referenceAyah = isMushaf ? segment?.ayahs[0] : data?.ayahs[0];
  const referenceSurahName = isMushaf ? segment?.surah.name.en : data?.surah.name.en;
  useEffect(() => {
    if (!referenceAyah) return;
    void setQuranLastRead({
      surah: referenceAyah.surah,
      ayahInSurah: referenceAyah.ayahInSurah,
      numberGlobal: referenceAyah.numberGlobal,
      surahName: referenceSurahName,
    });
  }, [referenceAyah, referenceSurahName]);

  // Auto-fit the mushaf type to the measured reading area so the visible
  // segment's ayahs FILL it — the owner's actual bar, and the thing four
  // rounds of pure layout tweaks never reached (they moved the footer toward
  // the content; this grows the content to meet the footer). Scoped to the
  // ONE visible segment, not the whole page: sizing for text that isn't on
  // screen re-opens the exact "empty space at the bottom" bug fixed in
  // `9254a65`/`c28dca3` on precisely the multi-segment pages this ticket
  // touches. Recomputed per part because text volume swings ~2x between a
  // dense Al-Baqarah page and a juz-30 one.
  const mushafFontSize = useMemo(() => {
    if (!segment) return 0;
    let glyphCount = 0;
    for (const ayah of segment.ayahs) {
      // +3 for the inline end-of-ayah marker and its surrounding spaces.
      glyphCount += countAdvanceGlyphs(ayah.textUthmani) + 3;
    }
    return fitMushafFontSize({
      glyphCount,
      segmentCount: 1,
      bismillahCount: segment.showBismillah ? 1 : 0,
      // The FlatList carries px-4 (16dp each side) inside the measured wrapper,
      // and reserves dockSpacing at the bottom for the mini-player + tab bar.
      width: readingArea.width - 32,
      height: readingArea.height - dockSpacing - 4,
      fontScale: prefs.fontScale,
    });
  }, [segment, readingArea, dockSpacing, prefs.fontScale]);

  const translationDir =
    (isMushaf ? pageData?.translationEdition?.dir : data?.translationEdition?.dir) ??
    (locale === "ar" ? "rtl" : "ltr");

  // Hydrate bookmarks once.
  useEffect(() => {
    void getQuranBookmarks().then(setBookmarks);
  }, []);

  // Scroll the currently-playing ayah into view — list mode scrolls to the
  // ayah's own row; mushaf mode has exactly one segment on screen (index 0
  // of its single-item FlatList), so this only needs to confirm the active
  // ayah actually belongs to it.
  useEffect(() => {
    if (activeGlobal === null) return;
    if (isMushaf) {
      if (!segment) return;
      if (segment.ayahs.some((a) => a.numberGlobal === activeGlobal)) {
        mushafRef.current?.scrollToIndex({ index: 0, animated: true, viewPosition: 0.1 });
      }
      return;
    }
    if (!data) return;
    const idx = data.ayahs.findIndex((a) => a.numberGlobal === activeGlobal);
    if (idx >= 0) {
      listRef.current?.scrollToIndex({ index: idx, animated: true, viewPosition: 0.3 });
    }
  }, [activeGlobal, isMushaf, data, segment]);

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

  // Prev/Next availability now follows the PART cursor, not the raw page
  // pointer: e.g. on a page's first part with a real prevPage, Prev is always
  // enabled (steps back to that page's LAST part); a page's non-final part
  // can always advance without needing a nextPage at all.
  const canGoPrev = pageData
    ? prevPartCursor({ page: pageData.page, part }, pageData.prevPage) !== null
    : false;
  const canGoNext = pageData
    ? nextPartCursor({ page: pageData.page, part }, pageData.segments.length, pageData.nextPage) !== null
    : false;

  // Page/juz label, shared by the header pill row and the footer. Adds a
  // "(part of count)" clause only when this page actually straddles a surah
  // boundary — a single-segment page reads exactly as before.
  const partCount = pageData?.segments.length ?? 1;
  const pageJuzLabel = pageData
    ? [
        t("quran.pageN", { number: localizeDigits(pageData.page, i18n.language) }),
        partCount > 1
          ? t("quran.partOfCount", {
              part: localizeDigits(part + 1, i18n.language),
              total: localizeDigits(partCount, i18n.language),
            })
          : null,
      ]
        .filter(Boolean)
        .join(" ") +
      " · " +
      t("quran.juzN", { number: localizeDigits(pageData.juz, i18n.language) })
    : "";

  // Deliberately minimal, because every dp spent here is a dp the ayahs can't
  // fill: one row of back + Settings, one row of page pills. The surah name /
  // meaning / Bismillah live in MushafSegment, inside the scroll area — hoisting
  // them up here (web's structure) cost ~120dp of permanently-visible chrome and
  // captioned mid-page surahs with the WRONG name, since `segments[0]` is
  // whoever owns the page's first ayah, not the surah you navigated from.
  const mushafHeader = pageData ? (
    <View className="gap-3 pb-3">
      <View className="flex-row items-center gap-2">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t("common.back")}
          onPress={onBack}
          className="-ms-2 size-9 items-center justify-center"
        >
          <Text className="text-2xl text-text">‹</Text>
        </Pressable>
        <View className="flex-1" />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t("quran.settings")}
          onPress={() => setSettingsOpen(true)}
          className="rounded-md border border-border px-3 py-1.5"
        >
          <Text className="text-sm text-text-2">⚙ {t("quran.settings")}</Text>
        </Pressable>
      </View>
      {/* Labelled pills (web parity) rather than bare chevrons. RN defaults
          flexShrink to 0 — unlike web — so the long Arabic labels
          ("الصفحة السابقة"/"الصفحة التالية") would clip off the edges of a
          411dp screen without the explicit shrink + single-line clamp below.
          The centre label is plain muted text, NOT variant="label": that
          variant carries tracking-[3px], which alone adds ~48dp to a 16-char
          Arabic string and blows the row's width budget. */}
      <View className="flex-row items-center justify-center gap-2">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t("quran.prevPage")}
          disabled={!canGoPrev}
          onPress={() => goToPart("prev")}
          className={cn("shrink rounded-md border border-border px-3 py-1.5", !canGoPrev && "opacity-30")}
        >
          <Text className="text-sm text-text" numberOfLines={1}>
            {t("quran.prevPage")}
          </Text>
        </Pressable>
        <Text className="shrink text-center text-xs text-text-2" numberOfLines={1}>
          {pageJuzLabel}
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t("quran.nextPage")}
          disabled={!canGoNext}
          onPress={() => goToPart("next")}
          className={cn("shrink rounded-md border border-border px-3 py-1.5", !canGoNext && "opacity-30")}
        >
          <Text className="text-sm text-text" numberOfLines={1}>
            {t("quran.nextPage")}
          </Text>
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
          pageData && segment ? (
            <>
              {/* Rendered as a fixed sibling, NOT ListHeaderComponent, so it isn't one
                  of the FlatList's own flex-distributed children below — with only the
                  segment and the footer left as siblings, justifyContent: "space-between"
                  puts its one gap exactly where it belongs (between content and footer)
                  instead of also opening a gap here, above the content. */}
              <View className="px-4" style={{ paddingTop: insets.top + 12 }}>
                {mushafHeader}
              </View>
              <Animated.View
                style={{ flex: 1, opacity: pageOpacity }}
                onLayout={(e) => {
                  const { width, height } = e.nativeEvent.layout;
                  setReadingArea((cur) =>
                    cur.width === width && cur.height === height ? cur : { width, height },
                  );
                }}
                {...mushafPanResponder.panHandlers}
              >
                {/* Exactly ONE segment per flip — a Madani page that straddles a
                    surah boundary (e.g. p.293: Al-Israa's tail + Al-Kahf's
                    opening) never shows both at once. Still a FlatList (data is
                    a 1-item array) rather than a plain View so the load-bearing
                    contentContainerStyle/ListFooterComponent/ref plumbing below
                    is untouched. */}
                <FlatList<PageSegment>
                  ref={mushafRef}
                  className="flex-1 bg-bg px-4"
                  data={[segment]}
                  keyExtractor={(s) => `${pageData.page}-${part}-${s.surah.number}`}
                  ListFooterComponent={
                    <View className="items-center border-t border-border pb-6 pt-3">
                      <Text variant="muted">{pageJuzLabel}</Text>
                    </View>
                  }
                  // flexGrow: 1 lets the content grow to at least fill the FlatList's
                  // viewport on a short page; justifyContent: "space-between" then puts
                  // all the leftover space in the one gap between the segment and the
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
                  renderItem={({ item }) => (
                    <MushafSegment
                      segment={item}
                      fontSize={mushafFontSize}
                      activeGlobal={activeGlobal}
                      selectedGlobal={selectedGlobal}
                      onSelectAyah={onSelectAyah}
                    />
                  )}
                />
              </Animated.View>
            </>
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
