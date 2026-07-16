import type { QuranSurah } from "@repo/api/schemas/quran";
import { JUZ_BOUNDARIES, surahsInJuz } from "@repo/shared-core/quran/juz";
import { Link } from "@/i18n/navigation";

// Juz Shelf — one of the 4 design directions prototyped for the surah index
// (Illuminated Grid was picked for the Surah tab; this is for the Juz tab).
// The 30 juz boundaries are fixed/universal (packages/shared-core/src/quran/juz.ts),
// so no extra fetch is needed — surahsInJuz() just slices the already-fetched
// surah list.
export function JuzShelf({ surahs }: { surahs: QuranSurah[] }) {
  const surahByNumber = new Map(surahs.map((s) => [s.number, s]));

  return (
    <div className="relative space-y-6 ps-4">
      <div
        aria-hidden="true"
        className="bg-[repeating-linear-gradient(to_bottom,var(--color-primary)_0_6px,var(--color-border)_6px_14px)] absolute inset-y-1 start-0 w-[3px] rounded-full"
      />
      {JUZ_BOUNDARIES.map((boundary) => {
        const entries = surahsInJuz(boundary.juz, surahs);
        return (
          <section key={boundary.juz}>
            <h2 className="font-display text-primary mb-1 text-lg">Juz {boundary.juz}</h2>
            <div className="divide-border border-border divide-y border-t">
              {entries.map((entry) => {
                const surah = surahByNumber.get(entry.number);
                if (!surah) return null;
                const isPartial = entry.ayahStart > 1 || entry.ayahEnd < surah.ayahCount;
                return (
                  <Link
                    key={entry.number}
                    href={`/quran/${entry.number}?autoplay=1`}
                    className="hover:bg-primary/5 flex items-center gap-3 px-2 py-2.5"
                  >
                    <span className="bg-primary/15 text-primary inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-medium">
                      {entry.number}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="text-text block text-sm font-medium">{surah.name.en}</span>
                      <span className="text-text-2 text-2xs block">
                        {isPartial ? `ayahs ${entry.ayahStart}-${entry.ayahEnd}` : `${surah.ayahCount} ayahs`}
                      </span>
                    </span>
                    <span dir="rtl" className="font-quran text-primary text-lg">
                      {surah.name.ar}
                    </span>
                  </Link>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}
