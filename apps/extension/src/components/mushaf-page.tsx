import { useMemo } from "react";
import { BISMILLAH_UTHMANI } from "@repo/shared-core/quran/basmala";

import { useI18n } from "../lib/i18n";
import { ayahMarker } from "../lib/quran-page-groups";
import { buildPageRows, type PageRow, type PageRowWord } from "@repo/shared-core/quran/page-rows";
import type { PageSegment } from "../lib/content";

// Uthmani Bismillah — Quranic text, not a UI string, so it lives as a module
// constant rather than an i18n key (same literal as apps/web/app/[locale]/
// quran/[surah]/page.tsx and apps/mobile/features/quran/components/
// mushaf-page.tsx).
export const BISMILLAH = BISMILLAH_UTHMANI;

export type MushafPageProps = {
  page: number;
  juz: number;
  segments: PageSegment[];
  activeGlobal: number | null;
  isPlaying: boolean;
  onPlay: (numberGlobal: number) => void;
};

// One Mushaf (Safha) page: GET /api/v1/quran/page/:n already splits the page
// into per-surah segments server-side (2+ when short surahs share a page,
// common in juz 30), each carrying its own `showBismillah` flag — no client
// grouping needed. Port of apps/web/features/quran/components/
// mushaf-page-view.tsx, adapted to the extension's FLAT `PageSegment`
// (`segment.surahNumber`/`surahNameAr`/`surahNameEn` instead of web's nested
// `segment.surah.*`).
//
// Two render paths:
//  - `buildPageRows` succeeds (per-word `line`/`page` layout has been seeded)
//    → line-for-line printed-page layout: ornamental banner, justified lines
//    flush to both margins, the surah's true final line centred.
//  - `buildPageRows` returns null (pre-seed cache, or partial layout data)
//    → the ORIGINAL reflowed-paragraph rendering, unchanged. This fallback
//    must keep working indefinitely, not just until the seed lands somewhere.
export function MushafPage({ page, juz, segments, activeGlobal, isPlaying, onPlay }: MushafPageProps) {
  const { t } = useI18n();

  const rows = useMemo(
    () =>
      buildPageRows({
        page,
        segments: segments.map((segment) => ({
          surahNumber: segment.surahNumber,
          showBismillah: segment.showBismillah,
          surahAyahCount: segment.surahAyahCount,
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
    [page, segments],
  );

  // Row rendering needs each surah's Arabic/English name, which PageRow
  // deliberately doesn't carry (it's shape-agnostic across surfaces).
  const segmentByNumber = useMemo(
    () => new Map(segments.map((segment) => [segment.surahNumber, segment])),
    [segments],
  );

  // An ayah split across two printed lines produces a run on each, but a DOM id
  // must be unique — and quran-reader.tsx scrolls to `ayah-${numberGlobal}` via
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
    <div className="mushaf-page border-b border-border px-4 py-5">
      {rows ? (
        rows.map((row, i) => (
          <PageRowView
            key={`${row.kind}-${i}`}
            row={row}
            segment={segmentByNumber.get(row.surahNumber)}
            firstLineByAyah={firstLineByAyah}
            activeGlobal={activeGlobal}
            isPlaying={isPlaying}
            onPlay={onPlay}
          />
        ))
      ) : (
        // Reflow fallback — identical to the pre-layout rendering, kept
        // verbatim so a pre-seed/cached payload never regresses.
        segments.map((segment) => (
          <div key={segment.surahNumber} className="mb-5 last:mb-0">
            <p className="mb-2 text-center text-xs font-semibold uppercase tracking-[0.08em] text-text-2">
              {segment.surahNameAr} · {segment.surahNameEn}
            </p>

            {segment.showBismillah ? (
              <p
                dir="rtl"
                className="mb-3 text-center font-quran text-text"
                style={{ fontSize: "calc(1.5rem * var(--quran-scale, 1))" }}
              >
                {BISMILLAH}
              </p>
            ) : null}

            <p
              dir="rtl"
              className="text-justify font-quran leading-[2.2] text-text"
              style={{ fontSize: "calc(1.875rem * var(--quran-scale, 1))" }}
            >
              {segment.ayahs.map((ayah) => (
                <span
                  key={ayah.numberGlobal}
                  id={`ayah-${ayah.numberGlobal}`}
                  role="button"
                  tabIndex={0}
                  aria-pressed={activeGlobal === ayah.numberGlobal && isPlaying}
                  onClick={() => onPlay(ayah.numberGlobal)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      onPlay(ayah.numberGlobal);
                    }
                  }}
                  className={
                    activeGlobal === ayah.numberGlobal && isPlaying
                      ? "cursor-pointer text-primary"
                      : "cursor-pointer"
                  }
                >
                  {ayah.textUthmani}{" "}
                  <span className="mx-1 text-primary">{ayahMarker(ayah.ayahInSurah)}</span>{" "}
                </span>
              ))}
            </p>
          </div>
        ))
      )}

      <div className="mt-4 border-t border-border pt-3 text-center text-xs text-text-2">
        {t("quran.pageN", { number: page })} · {t("quran.juzN", { number: juz })}
      </div>
    </div>
  );
}

interface PageRowViewProps {
  firstLineByAyah: Map<number, number>;
  row: PageRow;
  segment: PageSegment | undefined;
  activeGlobal: number | null;
  isPlaying: boolean;
  onPlay: (numberGlobal: number) => void;
}

function PageRowView({ row, segment, firstLineByAyah, activeGlobal, isPlaying, onPlay }: PageRowViewProps) {
  if (row.kind === "surah-banner") {
    return <SurahCartouche nameAr={segment?.surahNameAr ?? ""} nameEn={segment?.surahNameEn} />;
  }

  if (row.kind === "bismillah") {
    return (
      <p
        dir="rtl"
        className="mb-4 text-center font-quran text-mushaf-ink"
        style={{ fontSize: "calc(1.5rem * var(--quran-scale, 1))" }}
      >
        {BISMILLAH}
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
// contract as the reflow fallback's one-span-per-ayah, just narrower when an
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
      className={
        row.endsSurah
          ? "text-center font-quran leading-[2.2] text-mushaf-ink"
          : "font-quran leading-[2.2] text-mushaf-ink [text-align:justify] [text-align-last:justify]"
      }
      // Font-size slider: scales the ayah text via the --quran-scale var the
      // reader sets on its wrapper (text-3xl base = 1.875rem).
      style={{ fontSize: "calc(1.875rem * var(--quran-scale, 1))" }}
    >
      {runs.map((run) => {
        const isActive = activeGlobal === run.numberGlobal && isPlaying;
        // Only the ayah's FIRST line owns the id (see firstLineByAyah).
        const ownsId = firstLineByAyah.get(run.numberGlobal) === row.lineNumber;
        return (
          <span
            key={`${row.lineNumber}-${run.numberGlobal}`}
            {...(ownsId ? { id: `ayah-${run.numberGlobal}` } : {})}
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
            className={isActive ? "cursor-pointer text-primary" : "cursor-pointer"}
          >
            {run.words.map((word, i) => (
              <span key={i}>
                {word.arabic}{" "}
                {word.endsAyah ? (
                  <span className="mx-1 text-mushaf-ornament">{ayahMarker(word.ayahInSurah)}</span>
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
  nameAr: string;
  nameEn?: string;
}

// Ornamental surah-name frame: arabesque end-caps flanking a divider on
// either side of the centred Arabic name, in the ornament (muted gold)
// colour — the printed-mushaf equivalent of a chapter heading box. Port of
// apps/web/features/quran/components/mushaf-page-view.tsx SurahCartouche.
function SurahCartouche({ nameAr, nameEn }: SurahCartoucheProps) {
  return (
    <div className="my-4">
      <div dir="rtl" className="flex items-center gap-3">
        <CartoucheEndcap className="h-6 w-6 shrink-0 text-mushaf-ornament" />
        <div className="h-px flex-1 border-t border-mushaf-ornament/60" />
        <p className="shrink-0 px-1 font-quran text-2xl text-mushaf-ornament">{nameAr}</p>
        <div className="h-px flex-1 border-t border-mushaf-ornament/60" />
        <CartoucheEndcap className="h-6 w-6 shrink-0 -scale-x-100 text-mushaf-ornament" />
      </div>
      {nameEn ? <p className="mt-1 text-center text-xs text-mushaf-ink/70">{nameEn}</p> : null}
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
