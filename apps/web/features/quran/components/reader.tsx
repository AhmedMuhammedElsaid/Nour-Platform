"use client";

import { useEffect, useState } from "react";
import type { QuranReciter, ReaderAyah, SurahReader } from "@repo/api/schemas/quran";
import { AyahRow } from "./ayah-row";
import { ReaderSettingsSheet } from "./reader-settings-sheet";
import { TafsirSheet } from "./tafsir-sheet";
import { useAyahAudio } from "../hooks/use-ayah-audio";
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
  const [prefs, setPrefs] = useState<QuranPrefs>(loadPrefs);
  const [bookmarks, setBookmarks] = useState<AyahRef[]>([]);
  const [tafsirAyah, setTafsirAyah] = useState<{ numberGlobal: number; ref: string } | null>(null);
  const audio = useAyahAudio(
    data.ayahs.map((a) => ({ numberGlobal: a.numberGlobal, audioUrl: a.audioUrl })),
  );

  // Hydrate prefs + bookmarks client-side (avoids SSR/client mismatch).
  useEffect(() => {
    setPrefs(loadPrefs());
    setBookmarks(getBookmarks());
  }, []);

  // Record last-read = first ayah of this surah on mount.
  useEffect(() => {
    const first = data.ayahs[0];
    if (first) {
      setLastRead({
        surah: first.surah,
        ayah: first.ayahInSurah,
        numberGlobal: first.numberGlobal,
        surahName: data.surah.name.en,
      });
    }
  }, [data.ayahs, data.surah.name.en]);

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

  // Font scale applies to the Arabic ayah column via a CSS var the rows inherit.
  return (
    <div style={{ ["--quran-scale" as string]: prefs.fontScale }}>
      <div className="mb-4 flex justify-end">
        <ReaderSettingsSheet
          prefs={prefs}
          onChange={setPrefs}
          editions={editions}
          reciters={reciters}
        />
      </div>
      {data.ayahs.map((ayah) => (
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
      ))}
      <TafsirSheet ayah={tafsirAyah} locale={locale} onClose={() => setTafsirAyah(null)} />
    </div>
  );
}
