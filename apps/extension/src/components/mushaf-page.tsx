import { ayahMarker } from "../lib/quran-page-groups";
import type { PageSegment } from "../lib/content";

// Uthmani Bismillah — Quranic text, not a UI string, so it lives as a module
// constant rather than an i18n key (same literal as apps/web/app/[locale]/
// quran/[surah]/page.tsx and apps/mobile/features/quran/components/
// mushaf-page.tsx).
const BISMILLAH = "بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ";

export type MushafPageProps = {
  segments: PageSegment[];
  /** 0-based index into `segments` — the ONE segment this flip shows. */
  part: number;
  activeGlobal: number | null;
  isPlaying: boolean;
  onPlay: (numberGlobal: number) => void;
};

// One Mushaf (Safha) page, ONE segment ("part") at a time: GET
// /api/v1/quran/page/:n already splits the page into per-surah segments
// server-side (2+ when short surahs share a page, common in juz 30), each
// carrying its own `showBismillah` flag (see fetchPageReader in
// ../lib/content). Rendering every segment at once put a surah's ending and
// another surah's beginning on the same flip, which the owner rejected — the
// reader now paginates by (page, part) via @repo/shared-core/quran/page-parts
// and this component renders exactly the segment at `part`, never the whole
// array. The segment renders a lightweight surah-name banner, its Bismillah
// when showBismillah, then its ayahs as one justified Uthmani paragraph with
// inline U+06DD end-of-ayah markers; the Page/Juz footer (plus part indicator
// when the page has 2+ parts) is added by the caller. Each ayah span keeps
// the `ayah-${numberGlobal}` id AyahRow uses, so quran-reader.tsx's
// scroll-into-view effect works unchanged. Port of
// apps/web/features/quran/components/mushaf-page.tsx.
export function MushafPage({ segments, part, activeGlobal, isPlaying, onPlay }: MushafPageProps) {
  const segment = segments[part];
  if (!segment) return null;

  return (
    <div>
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
  );
}
