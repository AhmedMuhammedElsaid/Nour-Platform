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
  isPlaying: boolean;
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
  isPlaying,
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
            aria-label={isCurrent && isPlaying ? "Pause ayah" : "Play ayah"}
            aria-pressed={isCurrent && isPlaying}
            onClick={() => onPlay(ayah.numberGlobal)}
            disabled={!ayah.audioUrl}
            className="hover:text-primary rounded p-1.5 disabled:opacity-40"
          >
            {isCurrent && isPlaying ? (
              <svg viewBox="0 0 24 24" className="size-4" fill="currentColor" aria-hidden="true">
                <path d="M7 5h4v14H7zm6 0h4v14h-4z" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" className="size-4" fill="currentColor" aria-hidden="true">
                <path d="M8 5v14l11-7z" />
              </svg>
            )}
          </button>
          <button
            type="button"
            aria-label={isBookmarked ? "Remove bookmark" : "Add bookmark"}
            aria-pressed={isBookmarked}
            onClick={() => onToggleBookmark(ayah)}
            className={`rounded p-1.5 ${isBookmarked ? "text-primary" : "hover:text-primary"}`}
          >
            <svg
              viewBox="0 0 24 24"
              className="size-4"
              fill={isBookmarked ? "currentColor" : "none"}
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M6 3h12a1 1 0 0 1 1 1v17l-7-4-7 4V4a1 1 0 0 1 1-1z" />
            </svg>
          </button>
          <button
            type="button"
            aria-label="Tafsir"
            onClick={() => onOpenTafsir(ayah.numberGlobal)}
            className="hover:text-primary rounded p-1.5"
          >
            <svg
              viewBox="0 0 24 24"
              className="size-4"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
              <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
            </svg>
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
