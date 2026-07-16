"use client";

import { useEffect, useState } from "react";
import type { QuranSurah } from "@repo/api/schemas/quran";
import { Link } from "@/i18n/navigation";
import { getLastRead } from "../lib/quran-progress";

export function SurahIndex({ surahs }: { surahs: QuranSurah[] }) {
  // Only one surah can carry a progress ring: quran-progress.ts stores a
  // single last-read ayah, not per-surah history, so every other card just
  // shows a plain number badge rather than a fabricated 0%.
  const [progress, setProgress] = useState<{ surah: number; pct: number } | null>(null);

  useEffect(() => {
    const ref = getLastRead();
    if (!ref) return;
    const surah = surahs.find((s) => s.number === ref.surah);
    if (!surah) return;
    setProgress({ surah: ref.surah, pct: Math.min(100, Math.round((ref.ayah / surah.ayahCount) * 100)) });
  }, [surahs]);

  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
      {surahs.map((s) => {
        const pct = progress?.surah === s.number ? progress.pct : null;
        return (
          <Link
            key={s.number}
            href={`/quran/${s.number}?autoplay=1`}
            className="border-border bg-surface hover:border-primary/40 before:content-[''] after:content-[''] before:border-primary/40 after:border-primary/40 relative flex flex-col items-center gap-1 rounded-lg border p-4 pt-5 text-center transition-[transform,box-shadow,border-color] duration-300 before:absolute before:top-2 before:left-2 before:h-3 before:w-3 before:border-t before:border-l after:absolute after:right-2 after:bottom-2 after:h-3 after:w-3 after:border-r after:border-b hover:-translate-y-1 hover:shadow-[0_16px_40px_rgb(0_0_0/25%)]"
          >
            {pct !== null ? (
              <span
                className="mb-1 inline-flex size-11 shrink-0 items-center justify-center rounded-full"
                style={{ background: `conic-gradient(var(--color-primary) ${pct}%, var(--color-border) 0)` }}
              >
                <span className="bg-surface text-primary flex size-9 items-center justify-center rounded-full text-sm font-medium">
                  {s.number}
                </span>
              </span>
            ) : (
              <span className="bg-primary/15 text-primary mb-1 inline-flex size-9 shrink-0 items-center justify-center rounded-full text-sm font-medium">
                {s.number}
              </span>
            )}
            <span dir="rtl" className="font-quran text-primary mb-1.5 text-2xl leading-relaxed">
              {s.name.ar}
            </span>
            <span className="text-text text-sm font-medium">{s.name.en}</span>
            <span className="text-text-2 text-2xs">
              {s.meaning} · {s.ayahCount} ayahs
            </span>
          </Link>
        );
      })}
    </div>
  );
}
