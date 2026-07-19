"use client";

import { useTranslations } from "next-intl";
import type { PageReader } from "@repo/api/schemas/quran";
import { MushafAyahParagraph } from "./mushaf-page";

export interface MushafPageViewProps {
  page: PageReader;
  activeGlobal: number | null;
  isPlaying: boolean;
  onPlay: (numberGlobal: number) => void;
}

// Cross-surah Madani mushaf page, sourced from GET /api/v1/quran/page/:n
// (packages/shared-core `PageReader`). Unlike MushafPage (a single surah's
// own ayahs grouped client-side), this renders every PageSegment the API
// already split by surah — normally 1, occasionally 2+ when short surahs
// share a page (common in juz 30). Each segment gets its own lightweight
// surah-name banner and, when `showBismillah`, its own Bismillah — the
// static Bismillah chrome above <Reader> only covers the entry surah, never
// a surah that starts mid-page. The Page/Juz footer renders once, using the
// API's `page`/`juz` directly (not any segment's).
export function MushafPageView({ page, activeGlobal, isPlaying, onPlay }: MushafPageViewProps) {
  const t = useTranslations("quran");

  return (
    <div className="border-border border-b py-5">
      {page.segments.map((segment) => (
        <div key={segment.surah.number} className="mb-6 last:mb-0">
          <div className="mb-4 text-center">
            <p dir="rtl" className="font-quran text-primary text-2xl sm:text-3xl">
              {segment.surah.name.ar}
            </p>
            <p className="text-text-2 mt-1 text-sm">
              {segment.surah.name.en} · {segment.surah.meaning}
            </p>
          </div>
          {segment.showBismillah ? (
            <p dir="rtl" className="font-quran text-text mb-4 text-center text-2xl">
              بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ
            </p>
          ) : null}
          <MushafAyahParagraph
            ayahs={segment.ayahs}
            activeGlobal={activeGlobal}
            isPlaying={isPlaying}
            onPlay={onPlay}
          />
        </div>
      ))}
      <div className="text-text-2 mt-4 border-t border-border pt-3 text-center text-sm">
        {t("pageN", { number: page.page })} · {t("juzN", { number: page.juz })}
      </div>
    </div>
  );
}
