"use client";

import { useTranslations } from "next-intl";
import { ayahMarker, type AyahPageGroup } from "../lib/page-groups";

export interface MushafPageProps {
  group: AyahPageGroup;
  activeGlobal: number | null;
  isPlaying: boolean;
  onPlay: (numberGlobal: number) => void;
}

// One Mushaf (Safha) page block: the page's ayahs flow as one justified
// Uthmani paragraph with inline U+06DD end-of-ayah markers (ayahMarker),
// instead of AyahRow's one-ayah-per-row list layout. Each ayah span keeps
// the `ayah-${numberGlobal}` id AyahRow uses, so reader.tsx's existing
// scroll-into-view effect works unchanged across both layouts.
//
// The page-level Bismillah is already rendered once, above the Reader, as
// static page chrome (app/[locale]/quran/[surah]/page.tsx, gated on
// `surah.bismillahPre`). Re-rendering it per Mushaf page here would double
// it on the surah's first page, so this component intentionally does not
// render its own Bismillah — smaller diff than mobile's page-scoped one.
export function MushafPage({ group, activeGlobal, isPlaying, onPlay }: MushafPageProps) {
  const t = useTranslations("quran");

  return (
    <div className="border-border border-b py-5">
      <p
        dir="rtl"
        className="font-quran text-text text-justify leading-[2.2]"
        // Font-size slider: scales the ayah text via the --quran-scale var the
        // reader sets on its wrapper (text-3xl base = 1.875rem) — same var
        // ayah-row.tsx reads for list mode.
        style={{ fontSize: "calc(1.875rem * var(--quran-scale, 1))" }}
      >
        {group.ayahs.map((ayah) => (
          <span
            key={ayah.numberGlobal}
            id={`ayah-${ayah.numberGlobal}`}
            data-testid={`mushaf-ayah-${ayah.numberGlobal}`}
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
                ? "text-primary cursor-pointer"
                : "cursor-pointer"
            }
          >
            {ayah.textUthmani}{" "}
            <span className="text-primary mx-1">{ayahMarker(ayah.ayahInSurah)}</span>{" "}
          </span>
        ))}
      </p>
      <div className="text-text-2 mt-4 border-t border-border pt-3 text-center text-sm">
        {t("pageN", { number: group.page })} · {t("juzN", { number: group.juz })}
      </div>
    </div>
  );
}
