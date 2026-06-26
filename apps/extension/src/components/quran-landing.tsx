import { useEffect, useMemo, useState } from "react";

import { fetchSurahs, type QuranSurahSummary } from "../lib/content";
import { getLastRead } from "../lib/quran-progress";
import type { AyahRef } from "../lib/storage";
import { useI18n } from "../lib/i18n";
import { navigate } from "../lib/router";
import { Search } from "./ui/icons";

export function QuranLanding() {
  const { t } = useI18n();
  const [surahs, setSurahs] = useState<QuranSurahSummary[]>([]);
  const [lastRead, setLastReadState] = useState<AyahRef | null>(null);
  const [q, setQ] = useState("");

  useEffect(() => {
    void fetchSurahs().then(setSurahs).catch(() => {});
    void getLastRead().then(setLastReadState);
  }, []);

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
    <div className="mx-auto max-w-3xl space-y-5 px-4 py-8">
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

      {/* Surah list */}
      <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-surface">
        {filtered.map((s) => (
          <li key={s.number}>
            <button
              type="button"
              onClick={() => navigate({ view: "quran-read", surah: String(s.number) })}
              className="flex w-full items-center gap-3 px-3 py-3 text-start hover:bg-primary/5 transition-colors"
            >
              <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/15 text-sm font-medium text-primary">
                {s.number}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-medium text-text">{s.nameEn}</span>
                <span className="block text-xs text-text-2">
                  {s.meaning} · {s.ayahCount} {t("quran.ayahs")} · {s.revelationPlace}
                </span>
              </span>
              <span dir="rtl" className="font-quran text-xl text-primary">
                {s.nameAr}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
