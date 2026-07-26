"use client";

import { useTranslations } from "next-intl";
import type { PageReader } from "@repo/api/schemas/quran";
import { MushafAyahParagraph } from "./mushaf-page";

export interface MushafPageViewProps {
  page: PageReader;
  /** 0-based index into `page.segments` — the segment currently on screen. */
  part: number;
  activeGlobal: number | null;
  isPlaying: boolean;
  onPlay: (numberGlobal: number) => void;
}

// Cross-surah Madani mushaf page, sourced from GET /api/v1/quran/page/:n
// (packages/shared-core `PageReader`). A page can straddle a surah boundary
// (e.g. p.293 = end of Al-Israa + start of Al-Kahf) and the API already
// splits that into 2+ PageSegments — but the owner wants one flip to show
// EITHER a surah's ending OR another's beginning, never both. So only the
// segment at `part` renders here; Prev/Next in the parent (Reader) paginate
// by (page, part) via packages/shared-core/quran/page-parts, keeping the
// standard 604-page numbering intact. The segment keeps its own lightweight
// surah-name banner and, when `showBismillah`, its own Bismillah — never
// hoisted to page level, or a page-level banner would caption a mid-page
// surah with the preceding surah's name. The footer uses the API's
// `page`/`juz` directly (not the segment's) and adds a "(N of total)" part
// indicator whenever the page has more than one part.
export function MushafPageView({ page, part, activeGlobal, isPlaying, onPlay }: MushafPageViewProps) {
  const t = useTranslations("quran");
  const partCount = page.segments.length;
  const segment = page.segments[Math.min(Math.max(part, 0), partCount - 1)] ?? page.segments[0];

  if (!segment) return null;

  return (
    <div className="border-border border-b py-5">
      <div className="mb-6">
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
            بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ
          </p>
        ) : null}
        <MushafAyahParagraph
          ayahs={segment.ayahs}
          activeGlobal={activeGlobal}
          isPlaying={isPlaying}
          onPlay={onPlay}
        />
      </div>
      <div className="text-text-2 mt-4 border-t border-border pt-3 text-center text-sm">
        {t("pageN", { number: page.page })}
        {partCount > 1 ? ` ${t("pagePart", { number: part + 1, total: partCount })}` : ""} ·{" "}
        {t("juzN", { number: page.juz })}
      </div>
    </div>
  );
}
