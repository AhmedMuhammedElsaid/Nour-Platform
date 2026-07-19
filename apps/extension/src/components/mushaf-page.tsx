import { useI18n } from "../lib/i18n";
import { ayahMarker } from "../lib/quran-page-groups";
import type { PageSegment } from "../lib/content";

// Uthmani Bismillah — Quranic text, not a UI string, so it lives as a module
// constant rather than an i18n key (same literal as apps/web/app/[locale]/
// quran/[surah]/page.tsx and apps/mobile/features/quran/components/
// mushaf-page.tsx).
const BISMILLAH = "بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ";

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
// grouping needed anymore (see fetchPageReader in ../lib/content). Each
// segment renders a lightweight surah-name banner, its Bismillah when
// showBismillah, then its ayahs as one justified Uthmani paragraph with
// inline U+06DD end-of-ayah markers; ONE Page/Juz footer closes the whole
// page. Each ayah span keeps the `ayah-${numberGlobal}` id AyahRow uses, so
// quran-reader.tsx's scroll-into-view effect works unchanged across both
// layouts. Port of apps/web/features/quran/components/mushaf-page.tsx.
export function MushafPage({ page, juz, segments, activeGlobal, isPlaying, onPlay }: MushafPageProps) {
  const { t } = useI18n();

  return (
    <div className="border-b border-border py-5">
      {segments.map((segment) => (
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
      ))}

      <div className="mt-4 border-t border-border pt-3 text-center text-xs text-text-2">
        {t("quran.pageN", { number: page })} · {t("quran.juzN", { number: juz })}
      </div>
    </div>
  );
}
