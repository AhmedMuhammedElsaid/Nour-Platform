"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import type { PageReader, QuranReciter, ReaderAyah, SurahReader } from "@repo/api/schemas/quran";
import { usePlayer } from "@repo/ui/blocks/player-context";
import { AyahRow } from "./ayah-row";
import { MushafPage } from "./mushaf-page";
import { MushafPageView } from "./mushaf-page-view";
import { ReaderChrome } from "./reader-chrome";
import { ReaderSettingsSheet } from "./reader-settings-sheet";
import { TafsirSheet } from "./tafsir-sheet";
import { Link } from "@/i18n/navigation";
import { useAyahAudio } from "../hooks/use-ayah-audio";
import { groupAyahsByPage } from "../lib/page-groups";
import { loadPrefs, type QuranPrefs } from "../lib/quran-prefs";
import {
  getBookmarks,
  toggleBookmark,
  setLastRead,
  type AyahRef,
} from "../lib/quran-progress";

const MIN_SURAH = 1;
const MAX_SURAH = 114;

export function Reader({
  data,
  reciters,
  translationDir,
  locale,
  heading,
  details,
}: {
  data: SurahReader;
  reciters: QuranReciter[];
  translationDir: "rtl" | "ltr";
  locale: string;
  heading: ReactNode;
  details: ReactNode;
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

  // Chrome — "edge chevrons + centre chip" (concept A3, owner-picked from the
  // same design gallery as mobile's reader-controls redesign, `4f60f8c`/
  // `a7f9b4e`). A single top row (back · juz chip · settings) replaces the
  // old two-row layout; page/surah turning moves onto large edge-pinned
  // chevrons over the reading area, with a quiet footer label. Ported to web
  // as the FULL concept (including the edge chevrons mobile itself later
  // dropped for swipe-only, `8e9d14a`) — mobile's objection was that floating
  // buttons "read like a web app, not native"; that reasoning doesn't apply
  // here, and web has no swipe gesture to fall back to. Applies at every
  // viewport width (owner call), not just small screens.
  const topJuz = prefs.layout === "mushaf" ? pageData?.juz : data.ayahs[0]?.juz;
  const prevSurah = data.surah.number > MIN_SURAH ? data.surah.number - 1 : null;
  const nextSurah = data.surah.number < MAX_SURAH ? data.surah.number + 1 : null;

  const isMushaf = prefs.layout === "mushaf";
  const prevDisabled = isMushaf
    ? !pageData || pageData.prevPage === null || pageStatus === "loading"
    : prevSurah === null;
  const nextDisabled = isMushaf
    ? !pageData || pageData.nextPage === null || pageStatus === "loading"
    : nextSurah === null;

  const EdgeButton = ({
    direction,
    onClick,
    href,
    disabled,
  }: {
    direction: "prev" | "next";
    onClick?: () => void;
    href?: string;
    disabled: boolean;
  }) => {
    const label = direction === "prev" ? t("prevPage") : t("nextPage");
    // Fixed to the VIEWPORT (not the content block) so the button stays
    // reachable while scrolling a long List-mode surah (e.g. Al-Baqara's 286
    // ayahs) — an `absolute` position relative to the content would only
    // appear once, near the top, and vanish on scroll. Horizontally it still
    // aligns to the reading column's edge, not the raw browser edge, because
    // the parent wrapper mirrors the page's own `mx-auto max-w-2xl` width.
    // Light theme: surface is near-white, so the default surface/text-2
    // combo barely registers against the page. Flip to a solid dark chip
    // (bg-text/text-bg, i.e. the light theme's near-black text color as the
    // fill) just in light mode via the `[data-theme=light]` ancestor variant
    // — dark theme already contrasts fine and is left untouched.
    const className =
      "border-border bg-surface text-text-2 hover:text-primary [[data-theme=light]_&]:bg-text [[data-theme=light]_&]:text-bg [[data-theme=light]_&]:border-text [[data-theme=light]_&]:hover:opacity-90 pointer-events-auto absolute top-1/2 z-10 flex size-11 -translate-y-1/2 items-center justify-center rounded-full border shadow-3 disabled:pointer-events-none disabled:opacity-40" +
      (direction === "prev" ? " start-1" : " end-1");
    const icon = (
      <svg
        viewBox="0 0 24 24"
        className="size-4 rtl:rotate-180"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d={direction === "prev" ? "M15 18l-6-6 6-6" : "M9 18l6-6-6-6"} />
      </svg>
    );
    if (href && !disabled) {
      return (
        <Link href={href} aria-label={label} className={className}>
          {icon}
        </Link>
      );
    }
    return (
      <button type="button" aria-label={label} onClick={onClick} disabled={disabled} className={className}>
        {icon}
      </button>
    );
  };

  // Mushaf mode: MushafPageView/MushafPage already render their own
  // "Page N · Juz N" footer inline with the page content — a second one here
  // would duplicate it. Only List mode needs this quiet footer, since it has
  // no equivalent per-content indicator.
  const footerLabel = isMushaf
    ? null
    : t("surahNOfTotal", { number: data.surah.number, total: MAX_SURAH });

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
      <div className="mb-2 flex items-center justify-between gap-2">
        <Link
          href="/quran"
          aria-label={t("back")}
          className="text-text-2 hover:text-primary -ms-2 inline-flex size-9 items-center justify-center"
        >
          <svg
            viewBox="0 0 24 24"
            className="size-5 rtl:rotate-180"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </Link>
        {topJuz != null ? (
          <span className="border-border text-text-2 rounded-full border px-2.5 py-1 text-xs">
            {t("juzN", { number: topJuz })}
          </span>
        ) : (
          <span />
        )}
        <ReaderSettingsSheet
          prefs={prefs}
          onChange={setPrefs}
          editions={editions}
          reciters={reciters}
        />
      </div>
      <ReaderChrome heading={heading} details={details} />
      <div className="pointer-events-none fixed inset-0 z-10">
        <div className="relative mx-auto h-full max-w-2xl px-4">
          <EdgeButton direction="prev" onClick={onPrevPage} href={!isMushaf && prevSurah ? `/quran/${prevSurah}` : undefined} disabled={prevDisabled} />
          <EdgeButton direction="next" onClick={onNextPage} href={!isMushaf && nextSurah ? `/quran/${nextSurah}` : undefined} disabled={nextDisabled} />
        </div>
      </div>
      <div>
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
      </div>
      {footerLabel ? (
        <p className="text-text-2 mt-4 text-center text-xs tabular-nums">{footerLabel}</p>
      ) : null}
      <TafsirSheet ayah={tafsirAyah} locale={locale} onClose={() => setTafsirAyah(null)} />
    </div>
  );
}
