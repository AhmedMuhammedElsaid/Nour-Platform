import { useEffect, useMemo, useState } from "react";

import { Skeleton } from "./skeleton";
import { fetchSurahs, type QuranSurahSummary } from "../lib/content";
import { computeSurahProgress, getLastRead } from "../lib/quran-progress";
import type { AyahRef } from "../lib/storage";
import { useI18n } from "../lib/i18n";
import { navigate } from "../lib/router";
import { Search } from "./ui/icons";

export function QuranLanding() {
  const { t } = useI18n();
  const [surahs, setSurahs] = useState<QuranSurahSummary[]>([]);
  const [lastRead, setLastReadState] = useState<AyahRef | null>(null);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void fetchSurahs()
      .then(setSurahs)
      .catch(() => {})
      .finally(() => setLoading(false));
    void getLastRead().then(setLastReadState);
  }, []);

  const progress = useMemo(() => computeSurahProgress(lastRead, surahs), [lastRead, surahs]);

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    if (!query) return surahs;
    return surahs.filter(
      (s) =>
        s.nameEn.toLowerCase().includes(query) ||
        s.meaning.toLowerCase().includes(query) ||
        s.nameAr.includes(query) ||
        String(s.number) === query,
    );
  }, [surahs, q]);

  return (
    <div className="mx-auto max-w-6xl space-y-5 px-4 py-8">
      <h1 className="font-display text-2xl font-bold text-primary">{t("quran.title")}</h1>

      {/* Continue reading */}
      {lastRead ? (
        <button
          type="button"
          onClick={() => navigate({ view: "quran-read", surah: String(lastRead.surah) })}
          className="flex w-full items-center justify-between rounded-xl border border-border bg-surface p-4 text-start transition-colors hover:border-primary"
        >
          <span>
            <span className="block text-xs text-text-2">{t("quran.continueReading")}</span>
            <span className="font-medium text-text">
              {lastRead.surahName ?? `Surah ${lastRead.surah}`} · {lastRead.ayah}
            </span>
          </span>
          <span className="text-primary rtl:scale-x-[-1]">→</span>
        </button>
      ) : null}

      {/* Search */}
      <div className="relative">
        <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-text-2" />
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={t("quran.searchSurah")}
          className="h-10 w-full rounded-xl border border-border bg-surface ps-10 pe-3 text-sm text-text outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
          dir="auto"
        />
      </div>

      {/* Surah grid — mirrors apps/web/features/quran/components/surah-index.tsx */}
      {loading ? (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: 9 }).map((_, i) => (
            <div key={i} className="space-y-2 rounded-lg border border-border bg-surface p-4">
              <Skeleton className="mx-auto size-9 rounded-full" />
              <Skeleton className="mx-auto h-4 w-3/4" />
            </div>
          ))}
        </div>
      ) : (
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {filtered.map((s) => {
          const pct = progress?.surah === s.number ? progress.pct : null;
          return (
            <button
              key={s.number}
              type="button"
              onClick={() =>
                navigate({ view: "quran-read", surah: String(s.number), autoplay: true })
              }
              className="before:content-[''] after:content-[''] before:border-primary/40 after:border-primary/40 relative flex flex-col items-center gap-1 rounded-lg border border-border bg-surface p-4 pt-5 text-center transition-[transform,box-shadow,border-color] duration-300 before:absolute before:top-2 before:left-2 before:h-3 before:w-3 before:border-t before:border-l after:absolute after:right-2 after:bottom-2 after:h-3 after:w-3 after:border-r after:border-b hover:-translate-y-1 hover:border-primary/40 hover:shadow-[0_16px_40px_rgb(0_0_0/25%)]"
            >
              {pct !== null ? (
                <span
                  className="mb-1 inline-flex size-11 shrink-0 items-center justify-center rounded-full"
                  style={{ background: `conic-gradient(var(--color-primary) ${pct}%, var(--color-border) 0)` }}
                >
                  <span className="flex size-9 items-center justify-center rounded-full bg-surface text-sm font-medium text-primary">
                    {s.number}
                  </span>
                </span>
              ) : (
                <span className="mb-1 inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/15 text-sm font-medium text-primary">
                  {s.number}
                </span>
              )}
              <span dir="rtl" className="font-quran mb-1.5 text-2xl leading-relaxed text-primary">
                {s.nameAr}
              </span>
              <span className="text-sm font-medium text-text">{s.nameEn}</span>
              <span className="text-2xs text-text-2">
                {s.meaning} · {s.ayahCount} {t("quran.ayahs")}
              </span>
            </button>
          );
        })}
      </div>
      )}
    </div>
  );
}
