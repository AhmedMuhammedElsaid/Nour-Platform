"use client";

import { useMemo } from "react";
import { useTranslations } from "next-intl";
import type { PageReader } from "@repo/api/schemas/quran";
import { BISMILLAH_UTHMANI } from "@repo/shared-core/quran/basmala";
import { buildPageRows, type PageRow, type PageRowWord } from "@repo/shared-core/quran/page-rows";
import { cn } from "@repo/ui/lib/utils";
import { MushafAyahParagraph } from "./mushaf-page";
import { ayahMarker } from "../lib/page-groups";

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
//
// Two render paths:
//  - `buildPageRows` succeeds (per-word `line`/`page` layout has been seeded)
//    → line-for-line printed-page layout: ornamental banner, justified lines
//    flush to both margins, the surah's true final line centred.
//  - `buildPageRows` returns null (pre-seed cache, or partial layout data)
//    → the ORIGINAL reflowed-paragraph rendering, unchanged. This fallback
//    must keep working indefinitely, not just until the seed lands somewhere.
export function MushafPageView({ page, activeGlobal, isPlaying, onPlay }: MushafPageViewProps) {
  const t = useTranslations("quran");

  const rows = useMemo(
    () =>
      buildPageRows({
        page: page.page,
        segments: page.segments.map((segment) => ({
          surahNumber: segment.surah.number,
          showBismillah: segment.showBismillah,
          surahAyahCount: segment.surah.ayahCount,
          ayahs: segment.ayahs.map((ayah) => ({
            numberGlobal: ayah.numberGlobal,
            ayahInSurah: ayah.ayahInSurah,
            words: ayah.words.map((word) => ({
              position: word.position,
              arabic: word.arabic,
              line: word.line,
              page: word.page,
            })),
          })),
        })),
      }),
    [page],
  );

  // Row rendering needs each surah's Arabic/English name + meaning, which
  // PageRow deliberately doesn't carry (it's shape-agnostic across surfaces).
  const surahByNumber = useMemo(
    () => new Map(page.segments.map((segment) => [segment.surah.number, segment.surah])),
    [page.segments],
  );

  // An ayah split across two printed lines produces a run on each, but a DOM id
  // must be unique — and `reader.tsx` scrolls to `ayah-${numberGlobal}` via
  // getElementById. Record the first line each ayah appears on; only that run
  // carries the id, so the scroll target is unambiguous and the markup valid.
  const firstLineByAyah = useMemo(() => {
    const first = new Map<number, number>();
    for (const row of rows ?? []) {
      if (row.kind !== "line") continue;
      for (const word of row.words) {
        if (!first.has(word.numberGlobal)) first.set(word.numberGlobal, row.lineNumber);
      }
    }
    return first;
  }, [rows]);

  return (
    <div className="border-border rounded-md border-b px-4 py-5 sm:px-6">
      {rows ? (
        rows.map((row, i) => (
          <PageRowView
            key={`${row.kind}-${i}`}
            row={row}
            surah={surahByNumber.get(row.surahNumber)}
            firstLineByAyah={firstLineByAyah}
            activeGlobal={activeGlobal}
            isPlaying={isPlaying}
            onPlay={onPlay}
          />
        ))
      ) : (
        // Reflow fallback — identical to the pre-layout rendering, kept
        // verbatim so a pre-seed/cached payload never regresses.
        page.segments.map((segment) => (
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
                {BISMILLAH_UTHMANI}
              </p>
            ) : null}
            <MushafAyahParagraph
              ayahs={segment.ayahs}
              activeGlobal={activeGlobal}
              isPlaying={isPlaying}
              onPlay={onPlay}
            />
          </div>
        ))
      )}
      <div className="text-text-2 mt-4 border-t border-border pt-3 text-center text-sm">
        {t("pageN", { number: page.page })} · {t("juzN", { number: page.juz })}
      </div>
    </div>
  );
}

interface PageRowViewProps {
  firstLineByAyah: Map<number, number>;
  row: PageRow;
  surah: PageReader["segments"][number]["surah"] | undefined;
  activeGlobal: number | null;
  isPlaying: boolean;
  onPlay: (numberGlobal: number) => void;
}

function PageRowView({
  row,
  surah,
  firstLineByAyah,
  activeGlobal,
  isPlaying,
  onPlay,
}: PageRowViewProps) {
  if (row.kind === "surah-banner") {
    return <SurahCartouche name={surah?.name.ar ?? ""} englishName={surah?.name.en} meaning={surah?.meaning} />;
  }

  if (row.kind === "bismillah") {
    return (
      <p dir="rtl" className="font-quran text-text mb-4 text-center text-2xl">
        {BISMILLAH_UTHMANI}
      </p>
    );
  }

  return (
    <MushafLine
      row={row}
      firstLineByAyah={firstLineByAyah}
      activeGlobal={activeGlobal}
      isPlaying={isPlaying}
      onPlay={onPlay}
    />
  );
}

interface MushafLineProps {
  row: Extract<PageRow, { kind: "line" }>;
  firstLineByAyah: Map<number, number>;
  activeGlobal: number | null;
  isPlaying: boolean;
  onPlay: (numberGlobal: number) => void;
}

// One printed line, split into runs of consecutive same-ayah words so the
// tappable/highlightable element carries the `ayah-${numberGlobal}` id the
// rest of the reader (scroll-into-view, tap-to-play) depends on — same
// contract as MushafAyahParagraph's one-span-per-ayah, just narrower when an
// ayah is split across lines.
function MushafLine({ row, firstLineByAyah, activeGlobal, isPlaying, onPlay }: MushafLineProps) {
  const runs: { numberGlobal: number; words: PageRowWord[] }[] = [];
  for (const word of row.words) {
    const last = runs[runs.length - 1];
    if (last && last.numberGlobal === word.numberGlobal) {
      last.words.push(word);
    } else {
      runs.push({ numberGlobal: word.numberGlobal, words: [word] });
    }
  }

  return (
    <p
      dir="rtl"
      className={cn(
        "font-quran text-text leading-[1.8] sm:leading-[2.2]",
        row.endsSurah ? "text-center" : "[text-align:justify] [text-align-last:justify]",
      )}
      // Font-size slider: scales the ayah text via the --quran-scale var the
      // reader sets on its wrapper (text-3xl base = 1.875rem) — same var
      // ayah-row.tsx reads for list mode.
      style={{ fontSize: "calc(1.875rem * var(--quran-scale, 1))" }}
    >
      {runs.map((run) => {
        const isActive = activeGlobal === run.numberGlobal && isPlaying;
        // Only the ayah's FIRST line owns the id/testid (see firstLineByAyah).
        const ownsId = firstLineByAyah.get(run.numberGlobal) === row.lineNumber;
        return (
          <span
            key={`${row.lineNumber}-${run.numberGlobal}`}
            {...(ownsId
              ? {
                  id: `ayah-${run.numberGlobal}`,
                  "data-testid": `mushaf-ayah-${run.numberGlobal}`,
                }
              : {})}
            role="button"
            tabIndex={0}
            aria-pressed={isActive}
            onClick={() => onPlay(run.numberGlobal)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onPlay(run.numberGlobal);
              }
            }}
            className={cn("cursor-pointer", isActive && "text-primary")}
          >
            {run.words.map((word, i) => (
              <span key={i}>
                {word.arabic}{" "}
                {word.endsAyah ? (
                  <span className="text-primary mx-1">{ayahMarker(word.ayahInSurah)}</span>
                ) : null}{" "}
              </span>
            ))}
          </span>
        );
      })}
    </p>
  );
}

interface SurahCartoucheProps {
  name: string;
  englishName?: string;
  meaning?: string;
}

// Ornamental surah-name frame: arabesque end-caps flanking a divider on
// either side of the centred Arabic name, in the ornament (muted gold)
// colour — the printed-mushaf equivalent of a chapter heading box. Full
// English name/meaning kept below it (smaller, ink-muted) so the surah
// identity the old banner gave readers isn't lost.
function SurahCartouche({ name, englishName, meaning }: SurahCartoucheProps) {
  return (
    <div className="my-4">
      <div dir="rtl" className="flex items-center gap-3">
        <CartoucheEndcap className="text-primary h-6 w-6 shrink-0" />
        <div className="border-primary/60 h-px flex-1 border-t" />
        <p className="font-quran text-primary shrink-0 px-1 text-2xl sm:text-3xl">{name}</p>
        <div className="border-primary/60 h-px flex-1 border-t" />
        <CartoucheEndcap className="text-primary h-6 w-6 shrink-0 -scale-x-100" />
      </div>
      {englishName ? (
        <p className="text-text-2 mt-1 text-center text-sm">
          {englishName}
          {meaning ? ` · ${meaning}` : ""}
        </p>
      ) : null}
    </div>
  );
}

// Simple arabesque petal/teardrop motif, currentColor so it inherits the
// ornament token. Self-contained inline SVG per repo convention (no lucide).
function CartoucheEndcap({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" aria-hidden="true">
      <path
        d="M12 2c4 3.5 6 7 6 10.5A6 6 0 0 1 12 19a6 6 0 0 1-6-6.5C6 9 8 5.5 12 2Z"
        fill="currentColor"
        opacity="0.85"
      />
      <circle cx="12" cy="12.5" r="2.1" fill="currentColor" />
    </svg>
  );
}
