import { useEffect, useMemo, useRef, useState } from "react";

import { fetchAdhkarBySlug, type AdhkarDetail } from "../lib/content";
import { loadProgress, saveProgress, today } from "../lib/adhkar-progress";
import type { AzkarProgress } from "../lib/storage";
import { useI18n } from "../lib/i18n";
import { navigate } from "../lib/router";
import { ArrowUp, Check, RotateCw, SkipBack } from "./ui/icons";

type Props = { slug: string };

export function AdhkarReader({ slug }: Props) {
  const { t } = useI18n();
  const [detail, setDetail] = useState<AdhkarDetail | null>(null);
  const [counts, setCounts] = useState<number[]>([]);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [error, setError] = useState(false);
  const progressRef = useRef<AzkarProgress>({ date: today(), sets: {} });
  const cardRefs = useRef<(HTMLElement | null)[]>([]);

  // Load the set + day-fresh progress; seed counts for this set.
  useEffect(() => {
    setDetail(null);
    setError(false);
    void Promise.all([fetchAdhkarBySlug(slug), loadProgress()])
      .then(([d, progress]) => {
        progressRef.current = progress;
        const set = progress.sets[d.id] ?? {};
        setDetail(d);
        setCounts(d.items.map((_, i) => set[String(i)] ?? 0));
      })
      .catch(() => setError(true));
  }, [slug]);

  // "Back to top" affordance after a screenful of scroll.
  useEffect(() => {
    const onScroll = () => setShowScrollTop(window.scrollY > 600);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const repeats = useMemo(() => detail?.items.map((i) => i.repeat) ?? [], [detail]);
  const total = detail?.items.length ?? 0;

  const done = useMemo(
    () => counts.reduce((n, c, i) => n + (c >= (repeats[i] ?? 1) ? 1 : 0), 0),
    [counts, repeats],
  );

  // First not-yet-complete item (total when all done).
  const activeIndex = useMemo(() => {
    const idx = counts.findIndex((c, i) => c < (repeats[i] ?? 1));
    return idx === -1 ? total : idx;
  }, [counts, repeats, total]);

  function persist(next: number[]): void {
    if (!detail) return;
    const set: Record<string, number> = {};
    next.forEach((c, i) => {
      if (c > 0) set[String(i)] = c;
    });
    progressRef.current.sets[detail.id] = set;
    void saveProgress(progressRef.current);
  }

  function tap(i: number): void {
    if (!detail) return;
    const item = detail.items[i];
    if (!item) return;
    const current = counts[i] ?? 0;
    if (current >= item.repeat) return; // clamp

    const next = [...counts];
    next[i] = current + 1;
    setCounts(next);
    persist(next);

    // When the active card completes, scroll to the next unfinished one.
    if (next[i]! >= item.repeat && i === activeIndex) {
      const target = next.findIndex((c, j) => c < (repeats[j] ?? 1));
      if (target !== -1) {
        // Defer a frame so we scroll from the settled post-tap layout, and land
        // the next card just below the sticky header (block:"start" + the card's
        // scroll-mt) instead of centred under it — a smoother "push up to read".
        requestAnimationFrame(() => {
          cardRefs.current[target]?.scrollIntoView({ behavior: "smooth", block: "start" });
        });
      }
    }
  }

  function resetAll(): void {
    if (!detail) return;
    const cleared = detail.items.map(() => 0);
    setCounts(cleared);
    delete progressRef.current.sets[detail.id];
    void saveProgress(progressRef.current);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  if (error) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3">
        <p className="text-sm text-text-2">{t("adhkar.error")}</p>
        <button
          type="button"
          onClick={() => navigate({ view: "adhkar" })}
          className="text-xs text-primary hover:underline"
        >
          {t("adhkar.title")}
        </button>
      </div>
    );
  }

  if (!detail) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <p className="text-sm text-text-2">{t("common.loading")}</p>
      </div>
    );
  }

  const progressValue = total > 0 ? (done / total) * 100 : 0;
  const hasProgress = counts.some((c) => c > 0);

  return (
    <div className="mx-auto max-w-2xl space-y-6 px-4 py-8">
      {/* Back */}
      <button
        type="button"
        onClick={() => navigate({ view: "adhkar" })}
        className="inline-flex items-center gap-1.5 text-xs text-text-2 hover:text-primary"
      >
        <SkipBack className="size-3.5 rtl:scale-x-[-1]" />
        {t("adhkar.title")}
      </button>

      {/* Header: title + progress + reset */}
      <header className="space-y-2">
        <div className="flex items-baseline justify-between gap-4">
          <h1 className="font-display text-2xl font-bold text-primary">{detail.title}</h1>
          <span className="shrink-0 text-sm text-text-2 tabular-nums">
            {done} / {total}
          </span>
        </div>
        <div className="h-1.5 w-full rounded-full bg-primary/15">
          <div
            className="h-full rounded-full bg-primary transition-all"
            style={{ width: `${progressValue}%` }}
          />
        </div>
        <div className="flex justify-end">
          <button
            type="button"
            onClick={resetAll}
            disabled={!hasProgress}
            className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs text-text-2 transition-colors hover:border-primary hover:text-primary disabled:cursor-not-allowed disabled:opacity-50"
          >
            <RotateCw className="size-3.5" />
            {t("adhkar.reset")}
          </button>
        </div>
      </header>

      {/* Dhikr cards */}
      <ol className="flex flex-col gap-4">
        {detail.items.map((item, i) => {
          const count = counts[i] ?? 0;
          const isDone = count >= item.repeat;
          const isActive = i === activeIndex;

          return (
            <li key={i}>
              <article
                ref={(el) => {
                  cardRefs.current[i] = el;
                }}
                className={`flex scroll-mt-20 flex-col items-center gap-4 rounded-xl border bg-surface p-6 text-center transition-colors ${
                  isActive ? "border-primary ring-1 ring-primary/40" : "border-border"
                } ${isDone ? "opacity-60" : ""}`}
              >
                <div className="flex w-full items-center justify-between">
                  <span className="rounded-full bg-surface-2 px-3 py-1 text-sm font-medium text-primary">
                    ×{item.repeat}
                  </span>
                  {isDone ? (
                    <Check className="size-5 text-primary" />
                  ) : null}
                </div>

                <p dir="rtl" className="font-display text-2xl leading-relaxed text-text">
                  {item.ar}
                </p>

                {item.en ? <p className="text-sm text-text-2">{item.en}</p> : null}
                {item.transliteration ? (
                  <p className="text-sm italic text-text-2">{item.transliteration}</p>
                ) : null}
                {item.virtue ? <p className="text-sm text-text-2">{item.virtue}</p> : null}
                {item.source ? <p className="text-xs text-text-2">{item.source}</p> : null}

                <button
                  type="button"
                  aria-label={t("adhkar.countLabel")}
                  aria-disabled={isDone || undefined}
                  onClick={() => tap(i)}
                  className="flex size-16 flex-col items-center justify-center rounded-full border-2 border-primary bg-surface-2 text-text transition-colors hover:bg-primary hover:text-primary-fg disabled:opacity-60"
                  disabled={isDone}
                >
                  <span className="text-xl font-bold tabular-nums">{count}</span>
                  <span className="text-2xs text-text-2">/ {item.repeat}</span>
                </button>
              </article>
            </li>
          );
        })}
      </ol>

      {showScrollTop ? (
        <button
          type="button"
          aria-label={t("adhkar.scrollTop")}
          title={t("adhkar.scrollTop")}
          onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
          className="fixed bottom-6 end-6 z-40 flex size-11 items-center justify-center rounded-full border border-primary bg-surface text-primary shadow-lg transition-colors hover:bg-primary hover:text-primary-fg"
        >
          <ArrowUp className="size-5" />
        </button>
      ) : null}
    </div>
  );
}
