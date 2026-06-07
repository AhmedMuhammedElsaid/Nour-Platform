"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";

import { Progress } from "@repo/ui/primitives/progress";

import {
  getDhikrCount,
  recordDhikrCount,
  resetIfNewDay,
  resetSet,
} from "@/features/adhkar/lib/adhkar-progress";
import type { SerializedAzkar } from "@/features/adhkar/types";

interface Props {
  azkar: SerializedAzkar;
}

export function AdhkarReader({ azkar }: Props) {
  const t = useTranslations("adhkar");
  const { id, title, items, locale } = azkar;
  const total = items.length;

  // Required repeats per item — keyed on azkar.id so identity is stable when the
  // parent passes a referentially-new prop object with the same underlying data.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const repeats = useMemo(() => items.map((i) => i.repeat), [azkar.id]);

  const [counts, setCounts] = useState<number[]>(() => items.map(() => 0));
  const [showScrollTop, setShowScrollTop] = useState(false);
  const cardRefs = useRef<(HTMLElement | null)[]>([]);

  // On mount (per set): drop stale-day progress, then seed counts from the store.
  useEffect(() => {
    resetIfNewDay();
    setCounts(repeats.map((_, i) => getDhikrCount(id, i)));
  }, [id, repeats]);

  // Reveal the "back to top" affordance once the user has scrolled past a
  // screenful, so a long set of dhikr cards is quick to climb back up.
  useEffect(() => {
    const onScroll = () => setShowScrollTop(window.scrollY > 600);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const scrollToTop = useCallback(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  // Clear this set's counts and start over from the first dhikr.
  const resetAll = useCallback(() => {
    resetSet(id);
    setCounts(items.map(() => 0));
    scrollToTop();
  }, [id, items, scrollToTop]);

  const done = useMemo(
    () => counts.reduce((n, c, i) => n + (c >= (repeats[i] ?? 1) ? 1 : 0), 0),
    [counts, repeats],
  );

  // The active card = first item not yet at its repeat target (total when all done).
  const activeIndex = useMemo(() => {
    const idx = counts.findIndex((c, i) => c < (repeats[i] ?? 1));
    return idx === -1 ? total : idx;
  }, [counts, repeats, total]);

  const tap = useCallback(
    (i: number) => {
      const item = items[i];
      if (!item) return;
      const current = counts[i] ?? 0;
      if (current >= item.repeat) return; // clamp — ignore over-count

      const next = current + 1;
      recordDhikrCount(id, i, next);

      const nextCounts = [...counts];
      nextCounts[i] = next;
      setCounts((prev) => {
        const updated = [...prev];
        updated[i] = next;
        return updated;
      });

      // When the *active* card completes, smooth-scroll to the next unfinished one.
      if (next >= item.repeat && i === activeIndex) {
        const target = nextCounts.findIndex((c, j) => c < (repeats[j] ?? 1));
        if (target !== -1) {
          cardRefs.current[target]?.scrollIntoView({
            behavior: "smooth",
            block: "center",
          });
        }
      }
    },
    [counts, id, items, repeats, activeIndex],
  );

  const progressValue = total > 0 ? (done / total) * 100 : 0;
  const hasProgress = counts.some((c) => c > 0);

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <div className="flex items-baseline justify-between gap-4">
          <h1 className="font-display text-2xl font-bold text-primary">
            {title}
          </h1>
          <span className="shrink-0 text-sm text-text-2">
            {done} / {total}
          </span>
        </div>
        <Progress value={progressValue} />
        <div className="flex justify-end">
          <button
            type="button"
            data-testid="reset-all"
            onClick={resetAll}
            disabled={!hasProgress}
            className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-sm text-text-2 transition-colors hover:border-primary hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:border-border disabled:hover:text-text-2"
          >
            <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="size-4"
            >
              <path d="M3 12a9 9 0 1 0 3-6.7L3 8" />
              <path d="M3 3v5h5" />
            </svg>
            {t("reset")}
          </button>
        </div>
      </header>

      <ol className="flex flex-col gap-4">
        {items.map((item, i) => {
          const count = counts[i] ?? 0;
          const isDone = count >= item.repeat;
          const isActive = i === activeIndex;
          const hasVirtue = Boolean(item.virtue?.ar ?? item.virtue?.en);
          const hasSource = Boolean(item.source?.ar ?? item.source?.en);
          return (
            <li key={i}>
              <article
                ref={(el) => {
                  cardRefs.current[i] = el;
                }}
                data-testid="dhikr-card"
                data-index={i}
                data-active={isActive || undefined}
                data-done={isDone || undefined}
                className={[
                  "flex flex-col items-center gap-4 rounded-lg border bg-surface p-6 text-center transition-colors",
                  isActive ? "border-primary shadow-up-3" : "border-border",
                  isDone ? "opacity-60 pointer-events-none" : "",
                ].join(" ")}
              >
                <div className="flex w-full items-center justify-between">
                  <span className="rounded-full bg-surface-2 px-3 py-1 text-sm font-medium text-primary">
                    ×{item.repeat}
                  </span>
                  {isDone ? (
                    <span className="text-primary" aria-label={t("completed")}>
                      ✓
                    </span>
                  ) : null}
                </div>

                <p
                  dir="rtl"
                  className="font-display text-2xl leading-relaxed text-text"
                >
                  {item.ar}
                </p>

                {item.en ? (
                  <p className="text-base text-text-2">{item.en}</p>
                ) : null}
                {item.transliteration ? (
                  <p className="text-sm italic text-text-2">
                    {item.transliteration}
                  </p>
                ) : null}
                {hasVirtue ? (
                  <p className="text-sm text-text-2">
                    {locale === "ar"
                      ? (item.virtue?.ar ?? item.virtue?.en)
                      : (item.virtue?.en ?? item.virtue?.ar)}
                  </p>
                ) : null}
                {hasSource ? (
                  <p className="text-xs text-text-2">
                    {locale === "ar"
                      ? (item.source?.ar ?? item.source?.en)
                      : (item.source?.en ?? item.source?.ar)}
                  </p>
                ) : null}
                {item.audioUrl ? (
                  <audio controls src={item.audioUrl} className="w-full">
                    <track kind="captions" />
                  </audio>
                ) : null}

                <button
                  type="button"
                  data-testid="counter"
                  aria-label={t("countLabel")}
                  aria-disabled={isDone || undefined}
                  onClick={() => tap(i)}
                  className="flex size-16 flex-col items-center justify-center rounded-full border-2 border-primary bg-surface-2 text-text transition-colors hover:bg-primary hover:text-primary-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <span className="text-xl font-bold tabular-nums">{count}</span>
                  <span className="text-xs text-text-2">/ {item.repeat}</span>
                </button>
              </article>
            </li>
          );
        })}
      </ol>

      {showScrollTop ? (
        <button
          type="button"
          data-testid="scroll-top"
          aria-label={t("scrollTop")}
          title={t("scrollTop")}
          onClick={scrollToTop}
          className="fixed bottom-6 end-6 z-40 flex size-12 items-center justify-center rounded-full border border-primary bg-surface text-primary shadow-up-3 transition-colors hover:bg-primary hover:text-primary-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="size-6"
          >
            <path d="M12 19V5" />
            <path d="m5 12 7-7 7 7" />
          </svg>
        </button>
      ) : null}
    </div>
  );
}
