import type { ReaderAyah } from "../lib/content";
import { useI18n } from "../lib/i18n";
import { Bookmark, FileText, Pause, Play } from "./ui/icons";

type AyahRowProps = {
  ayah: ReaderAyah;
  showTranslation: boolean;
  translationDir: "rtl" | "ltr";
  showWordByWord: boolean;
  isCurrent: boolean;
  isPlaying: boolean;
  isBookmarked: boolean;
  onPlay: (numberGlobal: number) => void;
  onToggleBookmark: (ayah: ReaderAyah) => void;
  onOpenTafsir: (ayah: ReaderAyah) => void;
};

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
  const { t } = useI18n();
  return (
    <article
      id={`ayah-${ayah.numberGlobal}`}
      className={`border-b border-border py-5 transition-colors ${isCurrent ? "bg-primary/10" : ""}`}
    >
      <div className="mb-3 flex items-center gap-2 text-text-2">
        <span className="inline-flex h-7 min-w-7 items-center justify-center rounded-full bg-primary/15 px-2 text-sm font-medium text-primary">
          {ayah.ayahInSurah}
        </span>
        <div className="ms-auto flex items-center gap-1">
          <button
            type="button"
            aria-label={isCurrent && isPlaying ? t("ayah.pause") : t("ayah.play")}
            aria-pressed={isCurrent && isPlaying}
            onClick={() => onPlay(ayah.numberGlobal)}
            disabled={!ayah.audioUrl}
            className="rounded p-1.5 hover:text-primary disabled:opacity-40"
          >
            {isCurrent && isPlaying ? <Pause className="size-4" /> : <Play className="size-4" />}
          </button>
          <button
            type="button"
            aria-label={isBookmarked ? t("ayah.unbookmark") : t("ayah.bookmark")}
            aria-pressed={isBookmarked}
            onClick={() => onToggleBookmark(ayah)}
            className={`rounded p-1.5 ${isBookmarked ? "text-primary" : "hover:text-primary"}`}
          >
            <Bookmark className="size-4" filled={isBookmarked} />
          </button>
          <button
            type="button"
            aria-label={t("ayah.tafsir")}
            onClick={() => onOpenTafsir(ayah)}
            className="rounded p-1.5 hover:text-primary"
          >
            <FileText className="size-4" />
          </button>
        </div>
      </div>

      {showWordByWord ? (
        <div dir="rtl" className="flex flex-wrap gap-x-4 gap-y-3">
          {ayah.words.map((w) => (
            <span key={w.position} className="flex flex-col items-center text-center">
              <span
                className="font-quran leading-loose"
                style={{ fontSize: "calc(1.5rem * var(--quran-scale, 1))" }}
              >
                {w.arabic}
              </span>
              {w.glossEn ? (
                <span dir="ltr" className="text-xs text-text-2">{w.glossEn}</span>
              ) : null}
            </span>
          ))}
        </div>
      ) : (
        <p
          dir="rtl"
          className="font-quran leading-[2.2] text-text"
          style={{ fontSize: "calc(1.875rem * var(--quran-scale, 1))" }}
        >
          {ayah.textUthmani}
          <span className="mx-1 align-middle text-xl text-primary">۝{ayah.ayahInSurah}</span>
        </p>
      )}

      {showTranslation && ayah.translation ? (
        <p dir={translationDir} className="mt-2 text-base leading-relaxed text-text-2">
          {ayah.translation}
        </p>
      ) : null}
    </article>
  );
}
