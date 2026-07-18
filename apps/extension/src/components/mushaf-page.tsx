import { useI18n } from "../lib/i18n";
import { ayahMarker, type AyahPageGroup } from "../lib/quran-page-groups";

// Uthmani Bismillah — Quranic text, not a UI string, so it lives as a module
// constant rather than an i18n key (same literal as apps/web/app/[locale]/
// quran/[surah]/page.tsx and apps/mobile/features/quran/components/
// mushaf-page.tsx). Unlike web (which renders it once as static page chrome
// above the Reader, for both layouts), this newtab reader has no such header,
// so — like mobile — the first Mushaf page renders it itself.
const BISMILLAH = "بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ";

export type MushafPageProps = {
  group: AyahPageGroup;
  showBismillah: boolean;
  activeGlobal: number | null;
  isPlaying: boolean;
  onPlay: (numberGlobal: number) => void;
};

// One Mushaf (Safha) page block: the page's ayahs flow as one justified
// Uthmani paragraph with inline U+06DD end-of-ayah markers (ayahMarker),
// instead of AyahRow's one-ayah-per-row list layout, plus a Page/Juz footer.
// Each ayah span keeps the `ayah-${numberGlobal}` id AyahRow uses, so
// quran-reader.tsx's existing scroll-into-view effect works unchanged across
// both layouts. Port of apps/web/features/quran/components/mushaf-page.tsx
// (span+role="button", not a real <button>, so it stays inline text flow).
export function MushafPage({ group, showBismillah, activeGlobal, isPlaying, onPlay }: MushafPageProps) {
  const { t } = useI18n();

  return (
    <div className="border-b border-border py-5">
      {showBismillah ? (
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
        {group.ayahs.map((ayah) => (
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

      <div className="mt-4 border-t border-border pt-3 text-center text-xs text-text-2">
        {t("quran.pageN", { number: group.page })} · {t("quran.juzN", { number: group.juz })}
      </div>
    </div>
  );
}
