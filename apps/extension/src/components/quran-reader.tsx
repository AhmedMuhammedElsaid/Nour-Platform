import { useEffect, useMemo, useRef, useState } from "react";

import {
  fetchEditions,
  fetchPageReader,
  fetchReciters,
  fetchSurahReader,
  fetchSurahs,
  type PageReaderData,
  type QuranEdition,
  type QuranReciter,
  type QuranSurahSummary,
  type ReaderAyah,
  type SurahReaderData,
} from "../lib/content";
import {
  getBookmarks,
  isBookmarked as isBookmarkedIn,
  setLastRead,
  toggleBookmark,
} from "../lib/quran-progress";
import { useAyahAudio } from "../lib/use-ayah-audio";
import { get, set, DEFAULT_QURAN_PREFS, type AyahRef, type QuranPrefs } from "../lib/storage";
import type { PlayerCommand, PlayerState } from "../lib/player-state";
import { useI18n } from "../lib/i18n";
import { navigate } from "../lib/router";
import { AyahRow } from "./ayah-row";
import { MushafPage } from "./mushaf-page";
import { TafsirSheet } from "./tafsir-sheet";
import { Sheet } from "./ui/sheet";
import { Settings, SkipBack, SkipForward } from "./ui/icons";

const layoutActive =
  "rounded-md border border-primary/40 bg-primary/15 px-2.5 py-1 text-xs font-semibold text-primary";
const layoutInactive =
  "rounded-md border border-border px-2.5 py-1 text-xs text-text-2 hover:text-text transition-colors";

type Props = {
  surah: string;
  autoplay?: boolean;
  state: PlayerState | null;
  send: (cmd: PlayerCommand) => void;
};

export function QuranReader({ surah, autoplay, state, send }: Props) {
  const { t } = useI18n();
  const surahNumber = Number(surah);

  const [prefs, setPrefs] = useState<QuranPrefs>(DEFAULT_QURAN_PREFS);
  const [hydrated, setHydrated] = useState(false);
  const [data, setData] = useState<SurahReaderData | null>(null);
  const [surahs, setSurahs] = useState<QuranSurahSummary[]>([]);
  const [pageData, setPageData] = useState<PageReaderData | null>(null);
  const [currentPage, setCurrentPage] = useState<number | null>(null);
  const [editions, setEditions] = useState<QuranEdition[]>([]);
  const [reciters, setReciters] = useState<QuranReciter[]>([]);
  const [bookmarks, setBookmarks] = useState<AyahRef[]>([]);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [tafsirAyah, setTafsirAyah] = useState<{ numberGlobal: number; ref: string } | null>(null);
  const [error, setError] = useState(false);

  // Hydrate prefs + bookmarks + edition/reciter/surah lists once.
  useEffect(() => {
    // Mark hydrated only after prefs load so the fetch effects below run ONCE
    // with the stored reciter — never the default. Without this gate, tapping
    // a reader (which writes prefs then opens ?autoplay=1) would race a
    // default-reciter fetch and autoplay the wrong voice.
    void get("nour.quran.prefs").then((p) => {
      setPrefs(p);
      setHydrated(true);
    });
    void getBookmarks().then(setBookmarks);
    void fetchEditions().then(setEditions).catch(() => {});
    void fetchReciters().then(setReciters).catch(() => {});
    // Surah list carries `pageStart`, used to resolve which Mushaf page a
    // surah-number entry point (picker/bookmarks/continue-reading — all link
    // by surah number, unchanged) should open on.
    void fetchSurahs().then(setSurahs).catch(() => {});
  }, []);

  // List layout: (re)fetch the surah when the number or translation/reciter
  // changes. Skipped in Mushaf mode — that layout fetches by PAGE instead.
  useEffect(() => {
    if (!hydrated || prefs.layout !== "list") return;
    if (!Number.isInteger(surahNumber) || surahNumber < 1 || surahNumber > 114) {
      setError(true);
      return;
    }
    setData(null);
    setError(false);
    void fetchSurahReader(surahNumber, {
      translation: prefs.translationSlug,
      reciter: prefs.reciterSlug,
    })
      .then(setData)
      .catch(() => setError(true));
  }, [hydrated, prefs.layout, surahNumber, prefs.translationSlug, prefs.reciterSlug]);

  // Mushaf layout: resolve the entry surah's starting page (via `pageStart`
  // from the surah list) whenever the entry surah or the layout changes.
  // Flipping pages afterwards (Prev/Next) updates `currentPage` directly and
  // does NOT re-run this effect — only a new surah/layout re-anchors the page.
  useEffect(() => {
    if (!hydrated || prefs.layout !== "mushaf") return;
    if (!Number.isInteger(surahNumber) || surahNumber < 1 || surahNumber > 114) {
      setError(true);
      return;
    }
    if (surahs.length === 0) return;
    const target = surahs.find((s) => s.number === surahNumber);
    if (!target) {
      setError(true);
      return;
    }
    setError(false);
    setCurrentPage(target.pageStart);
  }, [hydrated, prefs.layout, surahNumber, surahs]);

  // Mushaf layout: (re)fetch the current page whenever it or the
  // translation/reciter changes.
  useEffect(() => {
    if (!hydrated || prefs.layout !== "mushaf" || currentPage === null) return;
    setPageData(null);
    setError(false);
    void fetchPageReader(currentPage, {
      translation: prefs.translationSlug,
      reciter: prefs.reciterSlug,
    })
      .then(setPageData)
      .catch(() => setError(true));
  }, [hydrated, prefs.layout, currentPage, prefs.translationSlug, prefs.reciterSlug]);

  function goToPage(page: number | null): void {
    if (page === null) return;
    setCurrentPage(page);
  }

  // Flattened, mode-appropriate ayah list for the reader-scoped audio queue —
  // list mode plays one surah; Mushaf mode plays across all of the current
  // page's segments (2+ when short surahs share a page), reusing each ayah's
  // already-resolved audioUrl.
  const audioAyahs = useMemo(() => {
    if (prefs.layout === "mushaf") {
      return pageData
        ? pageData.segments.flatMap((s) =>
            s.ayahs.map((a) => ({ numberGlobal: a.numberGlobal, audioUrl: a.audioUrl })),
          )
        : [];
    }
    return data ? data.ayahs.map((a) => ({ numberGlobal: a.numberGlobal, audioUrl: a.audioUrl })) : [];
  }, [prefs.layout, pageData, data]);

  const audio = useAyahAudio(audioAyahs, {
    // Pause the offscreen player so the two never overlap.
    onPlaybackStart: () => {
      if (state?.status === "playing") send({ type: "toggle" });
    },
  });

  // Autostart playback from the first ayah when opened via ?autoplay=1 (tapping
  // a reader on the home shelf → Al-Fatiha in that voice). Fires once, after
  // the surah/page data (with the chosen reciter's audio) has loaded.
  const didAutoplay = useRef(false);
  const { playAyah } = audio;
  useEffect(() => {
    if (!autoplay || didAutoplay.current) return;
    const first =
      prefs.layout === "mushaf" ? pageData?.segments[0]?.ayahs[0] : data?.ayahs[0];
    if (!first?.audioUrl) return;
    didAutoplay.current = true;
    playAyah(first.numberGlobal);
  }, [autoplay, data, pageData, prefs.layout, playAyah]);

  // Record last-read = first ayah currently loaded (surah's first ayah in
  // list mode; the page's first segment's first ayah in Mushaf mode — the
  // page may open mid-surah when flipped into an adjacent one).
  useEffect(() => {
    if (prefs.layout === "mushaf") {
      const segment = pageData?.segments[0];
      const first = segment?.ayahs[0];
      if (first && segment) {
        void setLastRead({
          surah: first.surah,
          ayah: first.ayahInSurah,
          numberGlobal: first.numberGlobal,
          surahName: segment.surahNameEn,
        });
      }
      return;
    }
    const first = data?.ayahs[0];
    if (first && data) {
      void setLastRead({
        surah: first.surah,
        ayah: first.ayahInSurah,
        numberGlobal: first.numberGlobal,
        surahName: data.nameEn,
      });
    }
  }, [data, pageData, prefs.layout]);

  // Scroll the currently-playing ayah into view.
  useEffect(() => {
    if (audio.currentGlobal === null) return;
    document
      .getElementById(`ayah-${audio.currentGlobal}`)
      ?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [audio.currentGlobal]);

  function updatePrefs(patch: Partial<QuranPrefs>): void {
    setPrefs((prev) => {
      const next = { ...prev, ...patch };
      void set("nour.quran.prefs", next);
      return next;
    });
  }

  function onPlayToggle(numberGlobal: number): void {
    if (audio.currentGlobal === numberGlobal) audio.toggle();
    else audio.playAyah(numberGlobal);
  }

  async function onToggleBookmark(ayah: ReaderAyah): Promise<void> {
    if (!data) return;
    const next = await toggleBookmark({
      surah: ayah.surah,
      ayah: ayah.ayahInSurah,
      numberGlobal: ayah.numberGlobal,
      surahName: data.nameEn,
    });
    setBookmarks(next);
  }

  if (error) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3">
        <p className="text-sm text-text-2">{t("quran.error")}</p>
        <button
          type="button"
          onClick={() => navigate({ view: "quran" })}
          className="text-xs text-primary hover:underline"
        >
          {t("quran.title")}
        </button>
      </div>
    );
  }

  if (prefs.layout === "mushaf" ? !pageData : !data) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <p className="text-sm text-text-2">{t("common.loading")}</p>
      </div>
    );
  }

  // Header title: the entry surah in list mode; the current page's leading
  // segment (updates as Prev/Next crosses surah boundaries) in Mushaf mode.
  const headerNameAr =
    prefs.layout === "mushaf" ? (pageData?.segments[0]?.surahNameAr ?? "") : (data?.nameAr ?? "");
  const headerNameEn =
    prefs.layout === "mushaf" ? (pageData?.segments[0]?.surahNameEn ?? "") : (data?.nameEn ?? "");

  return (
    <div
      className="mx-auto max-w-2xl px-4 py-6"
      style={{ ["--quran-scale" as string]: prefs.fontScale }}
    >
      {/* Header */}
      <div className="mb-4 flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => navigate({ view: "quran" })}
          className="inline-flex items-center gap-1.5 text-xs text-text-2 hover:text-primary"
        >
          <SkipBack className="size-3.5 rtl:scale-x-[-1]" />
          {t("quran.title")}
        </button>
        <div className="text-center">
          <p dir="rtl" className="font-quran text-2xl text-primary">{headerNameAr}</p>
          <p className="text-xs text-text-2">{headerNameEn}</p>
        </div>
        <button
          type="button"
          aria-label={t("quran.settings")}
          onClick={() => setSettingsOpen(true)}
          className="inline-flex size-9 items-center justify-center rounded text-text-2 hover:bg-surface-2 hover:text-text"
        >
          <Settings className="size-4" />
        </button>
      </div>

      {/* Ayahs */}
      {prefs.layout === "mushaf" && pageData ? (
        <div>
          <div className="mb-3 flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => goToPage(pageData.prevPage)}
              disabled={pageData.prevPage === null}
              className="inline-flex items-center gap-1.5 text-xs text-text-2 hover:text-primary disabled:pointer-events-none disabled:opacity-40"
            >
              <SkipForward className="size-3.5 rtl:scale-x-[-1]" />
              {t("quran.prevPage")}
            </button>
            <button
              type="button"
              onClick={() => goToPage(pageData.nextPage)}
              disabled={pageData.nextPage === null}
              className="inline-flex items-center gap-1.5 text-xs text-text-2 hover:text-primary disabled:pointer-events-none disabled:opacity-40"
            >
              {t("quran.nextPage")}
              <SkipBack className="size-3.5 rtl:scale-x-[-1]" />
            </button>
          </div>
          <MushafPage
            page={pageData.page}
            juz={pageData.juz}
            segments={pageData.segments}
            activeGlobal={audio.currentGlobal}
            isPlaying={audio.isPlaying}
            onPlay={onPlayToggle}
          />
        </div>
      ) : data ? (
        <div>
          {data.ayahs.map((ayah) => (
            <AyahRow
              key={ayah.numberGlobal}
              ayah={ayah}
              showTranslation={prefs.showTranslation}
              translationDir={data.translationDir}
              showWordByWord={prefs.showWordByWord}
              isCurrent={audio.currentGlobal === ayah.numberGlobal}
              isPlaying={audio.isPlaying}
              isBookmarked={isBookmarkedIn(bookmarks, { surah: ayah.surah, ayah: ayah.ayahInSurah })}
              onPlay={onPlayToggle}
              onToggleBookmark={(a) => void onToggleBookmark(a)}
              onOpenTafsir={(a) =>
                setTafsirAyah({ numberGlobal: a.numberGlobal, ref: `${a.surah}:${a.ayahInSurah}` })
              }
            />
          ))}
        </div>
      ) : null}

      {/* Settings sheet */}
      <Sheet open={settingsOpen} onClose={() => setSettingsOpen(false)} title={t("quran.settings")}>
        <div className="space-y-5">
          <label className="flex items-center justify-between text-sm text-text">
            {t("quran.showTranslation")}
            <input
              type="checkbox"
              checked={prefs.showTranslation}
              onChange={(e) => updatePrefs({ showTranslation: e.target.checked })}
              className="size-4 accent-[var(--color-primary)]"
            />
          </label>

          <label className="flex items-center justify-between text-sm text-text">
            {t("quran.wordByWord")}
            <input
              type="checkbox"
              checked={prefs.showWordByWord}
              onChange={(e) => updatePrefs({ showWordByWord: e.target.checked })}
              className="size-4 accent-[var(--color-primary)]"
            />
          </label>

          <label className="flex flex-col gap-2 text-sm text-text">
            {t("quran.fontSize")}
            <input
              type="range"
              min={0.8}
              max={1.6}
              step={0.1}
              value={prefs.fontScale}
              onChange={(e) => updatePrefs({ fontScale: Number(e.target.value) })}
              className="h-1 accent-[var(--color-primary)]"
            />
          </label>

          <label className="flex items-center justify-between gap-3 text-sm text-text">
            {t("quran.repeatAyah")}
            <input
              type="checkbox"
              checked={audio.repeatAyah}
              onChange={(e) => audio.setRepeatAyah(e.target.checked)}
              className="size-4 accent-[var(--color-primary)]"
            />
          </label>

          <div className="flex items-center justify-between gap-3 text-sm text-text">
            {t("quran.layout")}
            <div className="flex items-center gap-1.5" role="group" aria-label={t("quran.layout")}>
              <button
                type="button"
                aria-pressed={prefs.layout === "list"}
                onClick={() => updatePrefs({ layout: "list" })}
                className={prefs.layout === "list" ? layoutActive : layoutInactive}
              >
                {t("quran.layoutList")}
              </button>
              <button
                type="button"
                aria-pressed={prefs.layout === "mushaf"}
                onClick={() => updatePrefs({ layout: "mushaf" })}
                className={prefs.layout === "mushaf" ? layoutActive : layoutInactive}
              >
                {t("quran.layoutMushaf")}
              </button>
            </div>
          </div>

          {editions.length > 0 ? (
            <label className="flex flex-col gap-1.5 text-sm text-text">
              {t("quran.translation")}
              <select
                value={prefs.translationSlug}
                onChange={(e) => updatePrefs({ translationSlug: e.target.value })}
                className="rounded-md border border-border bg-surface px-2 py-1.5 text-sm text-text"
              >
                {editions.map((ed) => (
                  <option key={ed.slug} value={ed.slug}>{ed.name}</option>
                ))}
              </select>
            </label>
          ) : null}

          {reciters.length > 0 ? (
            <label className="flex flex-col gap-1.5 text-sm text-text">
              {t("quran.reciter")}
              <select
                value={prefs.reciterSlug}
                onChange={(e) => updatePrefs({ reciterSlug: e.target.value })}
                className="rounded-md border border-border bg-surface px-2 py-1.5 text-sm text-text"
              >
                {reciters.map((r) => (
                  <option key={r.slug} value={r.slug}>{r.name}</option>
                ))}
              </select>
            </label>
          ) : null}
        </div>
      </Sheet>

      <TafsirSheet ayah={tafsirAyah} onClose={() => setTafsirAyah(null)} />
    </div>
  );
}
