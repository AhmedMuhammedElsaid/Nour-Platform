"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import type { PageReader, QuranReciter, ReaderAyah, SurahReader } from "@repo/api/schemas/quran";
import { usePlayer } from "@repo/ui/blocks/player-context";
import { AyahRow } from "./ayah-row";
import { MushafPage } from "./mushaf-page";
import { MushafPageView } from "./mushaf-page-view";
import { ReaderSettingsSheet } from "./reader-settings-sheet";
import { TafsirSheet } from "./tafsir-sheet";
import { useAyahAudio } from "../hooks/use-ayah-audio";
import { groupAyahsByPage } from "../lib/page-groups";
import { loadPrefs, type QuranPrefs } from "../lib/quran-prefs";
import {
  getBookmarks,
  toggleBookmark,
  setLastRead,
  type AyahRef,
} from "../lib/quran-progress";

export function Reader({
  data,
  reciters,
  translationDir,
  locale,
}: {
  data: SurahReader;
  reciters: QuranReciter[];
  translationDir: "rtl" | "ltr";
  locale: string;
}) {
  const t = useTranslations("quran");
  const [prefs, setPrefs] = useState<QuranPrefs>(loadPrefs);
  const [bookmarks, setBookmarks] = useState<AyahRef[]>([]);
  const searchParams = useSearchParams();
  const didAutoplay = useRef(false);
  const [tafsirAyah, setTafsirAyah] = useState<{ numberGlobal: number; ref: string } | null>(null);

  // Mushaf (Safha) cross-surah page state. `currentPage` starts at this
  // surah's own first page and can move ±1 (respecting the mushaf's ends)
  // independently of which surah the route was entered on — flipping a page
  // can cross into a neighbouring surah. `pageData` is fetched client-side
  // (GET /api/v1/quran/page/:n) once we know `prefs.layout === "mushaf"`;
  // until it resolves (or if the fetch fails), MushafPage renders the
  // surah-scoped fallback grouped from the RSC-fetched `data.ayahs` — this
  // keeps SSR/initial paint (search engines get sensible content; they never
  // carry a `mushaf` localStorage pref anyway) and avoids an empty flash.
  const [currentPage, setCurrentPage] = useState(data.surah.pageStart);
  const [pageData, setPageData] = useState<PageReader | null>(null);
  const [pageStatus, setPageStatus] = useState<"idle" | "loading" | "error">("idle");
  const [retryToken, setRetryToken] = useState(0);

  // A different surah was routed to (surah-list/bookmark/search links all
  // still link by surah number) — reset paging to that surah's own start.
  useEffect(() => {
    setCurrentPage(data.surah.pageStart);
    setPageData(null);
  }, [data.surah.number, data.surah.pageStart]);

  // Client-side fetch of the cross-surah page reader whenever Mushaf layout
  // is active and the requested page/edition changes.
  useEffect(() => {
    if (prefs.layout !== "mushaf") return;
    let cancelled = false;
    setPageStatus("loading");
    const params = new URLSearchParams({ locale });
    if (prefs.translationSlug) params.set("translation", prefs.translationSlug);
    if (prefs.reciterSlug) params.set("reciter", prefs.reciterSlug);
    fetch(`/api/v1/quran/page/${currentPage}?${params.toString()}`)
      .then((r) => {
        if (!r.ok) throw new Error(String(r.status));
        return r.json() as Promise<PageReader>;
      })
      .then((json) => {
        if (!cancelled) {
          setPageData(json);
          setPageStatus("idle");
        }
      })
      .catch(() => {
        if (!cancelled) setPageStatus("error");
      });
    return () => {
      cancelled = true;
    };
  }, [prefs.layout, currentPage, locale, prefs.translationSlug, prefs.reciterSlug, retryToken]);

  const onPrevPage = useCallback(() => {
    if (pageData?.prevPage != null) setCurrentPage(pageData.prevPage);
  }, [pageData]);
  const onNextPage = useCallback(() => {
    if (pageData?.nextPage != null) setCurrentPage(pageData.nextPage);
  }, [pageData]);

  // The playback queue spans whatever is actually on screen: the resolved
  // cross-surah page (segments can hold 2+ surahs' ayahs when short surahs
  // share a page) once loaded, else the surah-scoped fallback/list-mode data.
  // Per-ayah audioUrl is already resolved server-side on ReaderAyah, so no
  // extra per-track surah metadata is needed to flatten segments into a queue.
  const queueAyahs = useMemo(
    () =>
      prefs.layout === "mushaf" && pageData
        ? pageData.segments.flatMap((s) =>
            s.ayahs.map((a) => ({ numberGlobal: a.numberGlobal, audioUrl: a.audioUrl })),
          )
        : data.ayahs.map((a) => ({ numberGlobal: a.numberGlobal, audioUrl: a.audioUrl })),
    [prefs.layout, pageData, data.ayahs],
  );

  // The reader's ayah audio and the site-wide player are independent
  // HTMLAudioElements — coordinate them so they never play simultaneously.
  const player = usePlayer();
  const audio = useAyahAudio(queueAyahs, {
    onPlaybackStart: () => {
      if (player.isPlaying) player.pause();
    },
  });

  // Reverse direction: starting the site-wide player stops the ayah audio.
  const { isPlaying: ayahPlaying, stop: stopAyah } = audio;
  useEffect(() => {
    if (player.isPlaying && ayahPlaying) stopAyah();
  }, [player.isPlaying, ayahPlaying, stopAyah]);

  // Hydrate prefs + bookmarks client-side (avoids SSR/client mismatch).
  useEffect(() => {
    setPrefs(loadPrefs());
    setBookmarks(getBookmarks());
  }, []);

  // Autostart playback from the first ayah when arriving with ?autoplay=1
  // (e.g. tapping a reciter on the home "Readers" shelf → Al-Fatiha in that
  // voice). Runs once; the click on the shelf is the user gesture that satisfies
  // the browser's autoplay policy. Strip the param so a refresh doesn't replay.
  useEffect(() => {
    if (didAutoplay.current) return;
    if (searchParams.get("autoplay") !== "1") return;
    const first = data.ayahs[0];
    if (!first?.audioUrl) return;
    didAutoplay.current = true;
    audio.playAyah(first.numberGlobal);
    const url = new URL(window.location.href);
    url.searchParams.delete("autoplay");
    window.history.replaceState(null, "", url.pathname + url.search);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Record last-read = the first ayah currently on screen: the current
  // Mushaf page's first segment once resolved, else this surah's own first
  // ayah (list mode, or Mushaf before the page fetch resolves).
  useEffect(() => {
    const firstSegment = prefs.layout === "mushaf" ? pageData?.segments[0] : undefined;
    let first: ReaderAyah | undefined = data.ayahs[0];
    let surahName = data.surah.name.en;
    if (firstSegment?.ayahs[0]) {
      first = firstSegment.ayahs[0];
      surahName = firstSegment.surah.name.en;
    }
    if (first) {
      setLastRead({
        surah: first.surah,
        ayah: first.ayahInSurah,
        numberGlobal: first.numberGlobal,
        surahName,
      });
    }
  }, [prefs.layout, pageData, data.ayahs, data.surah.name.en]);

  // Scroll the currently-playing ayah into view.
  useEffect(() => {
    if (audio.currentGlobal === null) return;
    document
      .getElementById(`ayah-${audio.currentGlobal}`)
      ?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [audio.currentGlobal]);

  const onToggleBookmark = (ayah: ReaderAyah) => {
    const next = toggleBookmark({
      surah: ayah.surah,
      ayah: ayah.ayahInSurah,
      numberGlobal: ayah.numberGlobal,
      surahName: data.surah.name.en,
    });
    setBookmarks(next);
  };
  const isBookmarked = (ayah: ReaderAyah) =>
    bookmarks.some((b) => b.surah === ayah.surah && b.ayah === ayah.ayahInSurah);

  // Clicking the same ayah toggles play/pause; a different ayah starts fresh.
  const onPlayToggle = (numberGlobal: number) => {
    if (audio.currentGlobal === numberGlobal) {
      audio.toggle();
    } else {
      audio.playAyah(numberGlobal);
    }
  };

  const editions = data.translationEdition ? [data.translationEdition] : [];

  // Surah-scoped Mushaf fallback groups (SSR + pre-fetch) — the same ayahs by
  // their `page` field (1-604, already on every ReaderAyah) instead of one
  // row per ayah. Only ONE group (the one matching `currentPage`) is ever
  // rendered as the fallback — see `fallbackGroup` below — never the whole
  // list, or a long surah (e.g. Al-Baqarah, ~48 pages) would flash a
  // scrolling multi-page view before the client page-fetch swaps in
  // MushafPageView, violating the "paginated, not scroll" requirement.
  const pageGroups = useMemo(() => groupAyahsByPage(data.ayahs), [data.ayahs]);
  const fallbackGroup =
    pageGroups.find((g) => g.page === currentPage) ?? pageGroups[0] ?? null;

  // Font scale applies to the Arabic ayah column via a CSS var the rows inherit.
  return (
    <div style={{ ["--quran-scale" as string]: prefs.fontScale }}>
      <div className="mb-4 flex items-center justify-between gap-2">
        {prefs.layout === "mushaf" ? (
          <div className="flex items-center gap-2">
            <button
              type="button"
              aria-label={t("prevPage")}
              onClick={onPrevPage}
              disabled={!pageData || pageData.prevPage === null || pageStatus === "loading"}
              className="border-border text-text-2 hover:text-primary rounded-md border px-3 py-1.5 text-sm disabled:cursor-not-allowed disabled:opacity-40"
            >
              {t("prevPage")}
            </button>
            <span className="text-text-2 text-sm">
              {t("pageN", { number: pageData?.page ?? currentPage })}
            </span>
            <button
              type="button"
              aria-label={t("nextPage")}
              onClick={onNextPage}
              disabled={!pageData || pageData.nextPage === null || pageStatus === "loading"}
              className="border-border text-text-2 hover:text-primary rounded-md border px-3 py-1.5 text-sm disabled:cursor-not-allowed disabled:opacity-40"
            >
              {t("nextPage")}
            </button>
          </div>
        ) : (
          <div />
        )}
        <ReaderSettingsSheet
          prefs={prefs}
          onChange={setPrefs}
          editions={editions}
          reciters={reciters}
        />
      </div>
      {prefs.layout === "mushaf" ? (
        pageData ? (
          <MushafPageView
            page={pageData}
            activeGlobal={audio.currentGlobal}
            isPlaying={audio.isPlaying}
            onPlay={onPlayToggle}
          />
        ) : pageStatus === "error" ? (
          <div className="border-border flex flex-col items-center gap-3 rounded-md border py-10 text-center">
            <p className="text-text-2 text-sm">{t("pageLoadError")}</p>
            <button
              type="button"
              onClick={() => setRetryToken((n) => n + 1)}
              className="border-border text-text-2 hover:text-primary rounded-md border px-3 py-1.5 text-sm"
            >
              {t("retry")}
            </button>
          </div>
        ) : (
          fallbackGroup && (
            <MushafPage
              key={fallbackGroup.page}
              group={fallbackGroup}
              activeGlobal={audio.currentGlobal}
              isPlaying={audio.isPlaying}
              onPlay={onPlayToggle}
            />
          )
        )
      ) : (
        data.ayahs.map((ayah) => (
          <AyahRow
            key={ayah.numberGlobal}
            ayah={ayah}
            showTranslation={prefs.showTranslation}
            translationDir={translationDir}
            showWordByWord={prefs.showWordByWord}
            isCurrent={audio.currentGlobal === ayah.numberGlobal}
            isPlaying={audio.isPlaying}
            isBookmarked={isBookmarked(ayah)}
            onPlay={onPlayToggle}
            onToggleBookmark={onToggleBookmark}
            onOpenTafsir={(ng) => {
              const a = data.ayahs.find((x) => x.numberGlobal === ng);
              if (a) setTafsirAyah({ numberGlobal: ng, ref: `${a.surah}:${a.ayahInSurah}` });
            }}
          />
        ))
      )}
      <TafsirSheet ayah={tafsirAyah} locale={locale} onClose={() => setTafsirAyah(null)} />
    </div>
  );
}
