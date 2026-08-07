import { useEffect, useMemo, useRef, useState } from "react";

import { BISMILLAH_UTHMANI } from "@repo/shared-core/quran/basmala";

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
import { Skeleton } from "./skeleton";
import { Settings, SkipBack, SkipForward } from "./ui/icons";

const FONT_MIN = 0.8;
const FONT_MAX = 1.6;
const FONT_STEP = 0.1;

// Purely presentational base for the live preview's Arabic size — demonstrates
// relative scaling as fontScale moves, not a prediction of the reader's own
// on-page size (mirrors the mobile/web sheets' PREVIEW_BASE_SIZE rationale).
const PREVIEW_BASE_SIZE = 24;

function Selectable({
  label,
  selected,
  onClick,
}: {
  label: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={
        selected
          ? "rounded-full border border-primary bg-primary/10 px-3 py-1.5 text-sm text-primary"
          : "rounded-full border border-border px-3 py-1.5 text-sm text-text-2 hover:text-text"
      }
    >
      {label}
    </button>
  );
}

// The "grouped cards" concept ported from mobile's redesign (`4f60f8c`, later
// ported to web `2e607dc`) — one card per related cluster of settings instead
// of a flat checkbox/select stack.
function SettingsCard({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2 rounded-lg bg-surface-2 p-3">
      <span className="text-xs uppercase tracking-wide text-text-2">{label}</span>
      {children}
    </div>
  );
}

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
  // Settings sheet draft — staged separately from the committed `prefs` so
  // the live preview can restyle on every tap without applying anything
  // (translation/reciter changes trigger a refetch) until Save. Cancel just
  // closes the sheet, leaving `prefs` untouched. Ported from the mobile
  // (`4f60f8c`) / web (`2e607dc`) redesign.
  const [settingsDraft, setSettingsDraft] = useState<QuranPrefs>(prefs);
  useEffect(() => {
    if (settingsOpen) setSettingsDraft(prefs);
  }, [settingsOpen, prefs]);
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

  function updateDraft(patch: Partial<QuranPrefs>): void {
    setSettingsDraft((d) => ({ ...d, ...patch }));
  }

  function setDraftFont(delta: number): void {
    const next = Math.min(
      FONT_MAX,
      Math.max(FONT_MIN, Math.round((settingsDraft.fontScale + delta) * 10) / 10),
    );
    updateDraft({ fontScale: next });
  }

  function saveSettings(): void {
    updatePrefs(settingsDraft);
    setSettingsOpen(false);
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
      <div className="mx-auto max-w-2xl space-y-4 px-4 py-8" aria-hidden="true">
        <Skeleton className="mx-auto h-9 w-48" />
        <Skeleton className="mx-auto h-4 w-40" />
        <div className="space-y-3 pt-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-6 w-full" />
          ))}
        </div>
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

      {/* Settings sheet — grouped cards + live preview + Save/Cancel staging,
          ported from mobile (`4f60f8c`) / web (`2e607dc`). Everything below
          reads/writes `settingsDraft`, not `prefs` — nothing applies until
          Save. `repeatAyah` is the one deliberate deviation from mobile/web:
          it applies immediately (not staged) and stays in the sheet, because
          on this surface the reader's own local `useAyahAudio` hook is the
          ONLY repeat-single-ayah mechanism — mobile/web dropped their
          equivalent row because a shared player's repeat-one mode already
          covers it there, which has no counterpart in the extension's
          architecture (see the file header for the two engines). */}
      <Sheet open={settingsOpen} onClose={() => setSettingsOpen(false)} title={t("quran.settings")}>
        <div className="flex flex-col gap-3">
          {/* Live preview — reads the DRAFT, so it restyles on every tap and
              reverts for free if the user backs out with Cancel. */}
          <div className="flex flex-col items-center gap-2 rounded-lg border border-border bg-bg px-4 py-4">
            <p
              dir="rtl"
              className="text-center font-quran text-text"
              style={{ fontSize: PREVIEW_BASE_SIZE * settingsDraft.fontScale }}
            >
              {BISMILLAH_UTHMANI}
            </p>
            {settingsDraft.showTranslation ? (
              <p className="text-center text-xs text-text-2">
                {t("quran.settingsPreviewTranslation")}
              </p>
            ) : null}
          </div>

          <SettingsCard label={t("quran.display")}>
            <label className="flex items-center justify-between text-sm text-text">
              {t("quran.showTranslation")}
              <input
                type="checkbox"
                checked={settingsDraft.showTranslation}
                onChange={(e) => updateDraft({ showTranslation: e.target.checked })}
                className="size-4 accent-[var(--color-primary)]"
              />
            </label>
            <label className="flex items-center justify-between text-sm text-text">
              {t("quran.wordByWord")}
              <input
                type="checkbox"
                checked={settingsDraft.showWordByWord}
                onChange={(e) => updateDraft({ showWordByWord: e.target.checked })}
                className="size-4 accent-[var(--color-primary)]"
              />
            </label>
            <div className="flex items-center justify-between gap-3 text-sm text-text">
              {t("quran.fontSize")}
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  aria-label={t("quran.fontSmaller")}
                  onClick={() => setDraftFont(-FONT_STEP)}
                  className="size-8 rounded-full border border-border text-lg"
                >
                  −
                </button>
                <span className="w-10 text-center text-sm tabular-nums">
                  {Math.round(settingsDraft.fontScale * 100)}%
                </span>
                <button
                  type="button"
                  aria-label={t("quran.fontLarger")}
                  onClick={() => setDraftFont(FONT_STEP)}
                  className="size-8 rounded-full border border-border text-lg"
                >
                  ＋
                </button>
              </div>
            </div>
            <label className="flex items-center justify-between text-sm text-text">
              {t("quran.repeatAyah")}
              <input
                type="checkbox"
                checked={audio.repeatAyah}
                onChange={(e) => audio.setRepeatAyah(e.target.checked)}
                className="size-4 accent-[var(--color-primary)]"
              />
            </label>
          </SettingsCard>

          <SettingsCard label={t("quran.layout")}>
            <div className="flex flex-wrap gap-2">
              <Selectable
                label={t("quran.layoutList")}
                selected={settingsDraft.layout === "list"}
                onClick={() => updateDraft({ layout: "list" })}
              />
              <Selectable
                label={t("quran.layoutMushaf")}
                selected={settingsDraft.layout === "mushaf"}
                onClick={() => updateDraft({ layout: "mushaf" })}
              />
            </div>
          </SettingsCard>

          {editions.length > 0 ? (
            <SettingsCard label={t("quran.translation")}>
              <div className="flex flex-wrap gap-2">
                {editions.map((ed) => (
                  <Selectable
                    key={ed.slug}
                    label={ed.name}
                    selected={settingsDraft.translationSlug === ed.slug}
                    onClick={() => updateDraft({ translationSlug: ed.slug })}
                  />
                ))}
              </div>
            </SettingsCard>
          ) : null}

          {reciters.length > 0 ? (
            <SettingsCard label={t("quran.reciter")}>
              <div className="flex flex-wrap gap-2">
                {reciters.map((r) => (
                  <Selectable
                    key={r.slug}
                    label={r.name}
                    selected={settingsDraft.reciterSlug === r.slug}
                    onClick={() => updateDraft({ reciterSlug: r.slug })}
                  />
                ))}
              </div>
            </SettingsCard>
          ) : null}

          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={() => setSettingsOpen(false)}
              className="flex-1 rounded-md border border-border px-4 py-2 text-sm text-text"
            >
              {t("common.cancel")}
            </button>
            <button
              type="button"
              onClick={saveSettings}
              className="flex-1 rounded-md bg-primary px-4 py-2 text-sm font-medium text-bg"
            >
              {t("common.save")}
            </button>
          </div>
        </div>
      </Sheet>

      <TafsirSheet ayah={tafsirAyah} onClose={() => setTafsirAyah(null)} />
    </div>
  );
}
