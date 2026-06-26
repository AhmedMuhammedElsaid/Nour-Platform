import { useEffect, useState } from "react";

import {
  fetchEditions,
  fetchReciters,
  fetchSurahReader,
  type QuranEdition,
  type QuranReciter,
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
import { TafsirSheet } from "./tafsir-sheet";
import { Sheet } from "./ui/sheet";
import { Settings, SkipBack } from "./ui/icons";

type Props = {
  surah: string;
  state: PlayerState | null;
  send: (cmd: PlayerCommand) => void;
};

export function QuranReader({ surah, state, send }: Props) {
  const { t } = useI18n();
  const surahNumber = Number(surah);

  const [prefs, setPrefs] = useState<QuranPrefs>(DEFAULT_QURAN_PREFS);
  const [data, setData] = useState<SurahReaderData | null>(null);
  const [editions, setEditions] = useState<QuranEdition[]>([]);
  const [reciters, setReciters] = useState<QuranReciter[]>([]);
  const [bookmarks, setBookmarks] = useState<AyahRef[]>([]);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [tafsirAyah, setTafsirAyah] = useState<{ numberGlobal: number; ref: string } | null>(null);
  const [error, setError] = useState(false);

  // Hydrate prefs + bookmarks + edition/reciter lists once.
  useEffect(() => {
    void get("nour.quran.prefs").then(setPrefs);
    void getBookmarks().then(setBookmarks);
    void fetchEditions().then(setEditions).catch(() => {});
    void fetchReciters().then(setReciters).catch(() => {});
  }, []);

  // (Re)fetch the surah when the number or the translation/reciter changes.
  useEffect(() => {
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
  }, [surahNumber, prefs.translationSlug, prefs.reciterSlug]);

  const audio = useAyahAudio(
    data?.ayahs.map((a) => ({ numberGlobal: a.numberGlobal, audioUrl: a.audioUrl })) ?? [],
    {
      // Pause the offscreen player so the two never overlap.
      onPlaybackStart: () => {
        if (state?.status === "playing") send({ type: "toggle" });
      },
    },
  );

  // Record last-read = first ayah of this surah.
  useEffect(() => {
    const first = data?.ayahs[0];
    if (first && data) {
      void setLastRead({
        surah: first.surah,
        ayah: first.ayahInSurah,
        numberGlobal: first.numberGlobal,
        surahName: data.nameEn,
      });
    }
  }, [data]);

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

  if (!data) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <p className="text-sm text-text-2">{t("common.loading")}</p>
      </div>
    );
  }

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
          <p dir="rtl" className="font-quran text-2xl text-primary">{data.nameAr}</p>
          <p className="text-xs text-text-2">{data.nameEn}</p>
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
