import { useEffect, useState } from "react";

import { fetchAdhkarList, type AdhkarKind, type AdhkarSummary } from "../lib/content";
import { completedCount, loadProgress } from "../lib/adhkar-progress";
import type { AzkarProgress } from "../lib/storage";
import { useI18n } from "../lib/i18n";
import { navigate } from "../lib/router";

const KIND_EMOJI: Record<AdhkarKind, string> = {
  morning: "🌅",
  evening: "🌙",
  other: "📿",
};

export function AdhkarLanding() {
  const { t, locale } = useI18n();
  const [sets, setSets] = useState<AdhkarSummary[]>([]);
  const [progress, setProgress] = useState<AzkarProgress | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    void fetchAdhkarList()
      .then(setSets)
      .catch(() => setError(true));
    void loadProgress().then(setProgress);
  }, []);

  return (
    <section className="mx-auto max-w-6xl px-6 py-16">
      {/* Hero — mirrors apps/web/app/[locale]/adhkar/page.tsx */}
      <div className="mb-8">
        <p className="mb-2 text-xs font-semibold uppercase tracking-[3px] text-primary">
          {locale === "ar" ? "ذكر الله" : "Dhikr"}
        </p>
        <h1 className="font-display text-4xl font-bold tracking-tight text-text">
          {t("adhkar.title")}
        </h1>
        <p className="mt-2 text-sm text-text-2">{t("adhkar.subtitle")}</p>
      </div>

      <hr className="my-8 border-border" />

      {error ? (
        <p className="text-center text-sm text-danger">{t("adhkar.error")}</p>
      ) : sets.length === 0 ? (
        <p className="text-text-2">
          {locale === "ar" ? "لا توجد أذكار منشورة" : "No adhkar published yet."}
        </p>
      ) : (
      <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {sets.map((s) => {
          const done = progress ? completedCount(progress, s.id, s.repeats) : 0;
          const pct = s.itemCount > 0 ? (done / s.itemCount) * 100 : 0;
          const isComplete = done >= s.itemCount && s.itemCount > 0;

          return (
            <li key={s.id}>
              <button
                type="button"
                onClick={() => navigate({ view: "adhkar-read", slug: s.slug })}
                className="group relative flex w-full flex-col gap-3 rounded-2xl border border-border bg-surface p-4 text-start transition-all duration-200 hover:-translate-y-1 hover:z-10 hover:border-primary/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <div className="flex size-12 items-center justify-center rounded-xl bg-primary/10">
                  <span className="text-2xl select-none" aria-hidden="true">
                    {KIND_EMOJI[s.kind]}
                  </span>
                </div>

                <h2 className="font-display text-base font-semibold leading-snug text-text group-hover:text-primary transition-colors">
                  {s.title}
                </h2>

                <span className="self-start rounded-full border border-primary/30 bg-primary/15 px-2.5 py-0.5 text-xs font-semibold text-primary">
                  {s.itemCount} {t("adhkar.items")}
                </span>

                {/* Daily progress */}
                <div className="mt-2 space-y-1">
                  <div className="h-1 w-full rounded-full bg-primary/15">
                    <div
                      className="h-full rounded-full bg-primary transition-[width] duration-300"
                      style={{ width: `${pct}%` }}
                      aria-label={`${Math.round(pct)}% complete`}
                    />
                  </div>
                  <p className="text-xs text-text-2">
                    {isComplete ? t("adhkar.completed") : `${done} / ${s.itemCount}`}
                  </p>
                </div>
              </button>
            </li>
          );
        })}
      </ul>
      )}
    </section>
  );
}
