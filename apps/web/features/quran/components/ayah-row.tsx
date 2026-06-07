"use client";

import type { ReaderAyah } from "@repo/api/schemas/quran";
import { WordByWord } from "./word-by-word";
import { TranslationBlock } from "./translation-block";

export interface AyahRowProps {
  ayah: ReaderAyah;
  showTranslation: boolean;
  translationDir: "rtl" | "ltr";
  showWordByWord: boolean;
  isCurrent: boolean;
  isBookmarked: boolean;
  onPlay: (numberGlobal: number) => void;
  onToggleBookmark: (ayah: ReaderAyah) => void;
  onOpenTafsir: (numberGlobal: number) => void;
}

export function AyahRow({
  ayah,
  showTranslation,
  translationDir,
  showWordByWord,
  isCurrent,
  isBookmarked,
  onPlay,
  onToggleBookmark,
  onOpenTafsir,
}: AyahRowProps) {
  return (
    <article
      id={`ayah-${ayah.numberGlobal}`}
      data-current={isCurrent || undefined}
      className={`border-border border-b py-5 transition-colors ${
        isCurrent ? "bg-primary/10" : ""
      }`}
    >
      <div className="text-text-2 mb-3 flex items-center gap-2">
        <span className="bg-primary/15 text-primary inline-flex h-7 min-w-7 items-center justify-center rounded-full px-2 text-sm font-medium">
          {ayah.ayahInSurah}
        </span>
        <div className="ms-auto flex items-center gap-1">
          <button
            type="button"
            aria-label="Play ayah"
            onClick={() => onPlay(ayah.numberGlobal)}
            disabled={!ayah.audioUrl}
            className="hover:text-primary rounded p-1.5 disabled:opacity-40"
          >
            ▶
          </button>
          <button
            type="button"
            aria-label={isBookmarked ? "Remove bookmark" : "Add bookmark"}
            aria-pressed={isBookmarked}
            onClick={() => onToggleBookmark(ayah)}
            className={`rounded p-1.5 ${isBookmarked ? "text-primary" : "hover:text-primary"}`}
          >
            ★
          </button>
          <button
            type="button"
            aria-label="Tafsir"
            onClick={() => onOpenTafsir(ayah.numberGlobal)}
            className="hover:text-primary rounded p-1.5"
          >
            📖
          </button>
        </div>
      </div>

      {showWordByWord ? (
        <WordByWord words={ayah.words} />
      ) : (
        <p
          dir="rtl"
          className="font-quran text-text leading-[2.2]"
          // Font-size slider: scales the ayah text via the --quran-scale var the
          // reader sets on its wrapper (text-3xl base = 1.875rem).
          style={{ fontSize: "calc(1.875rem * var(--quran-scale, 1))" }}
        >
          {ayah.textUthmani}
          <span className="text-primary mx-1 align-middle text-xl">
            ۝{ayah.ayahInSurah}
          </span>
        </p>
      )}

      {showTranslation && ayah.translation ? (
        <TranslationBlock text={ayah.translation} dir={translationDir} />
      ) : null}
    </article>
  );
}
