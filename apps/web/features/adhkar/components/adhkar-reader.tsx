"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";

import { Button } from "@repo/ui/primitives/button";
import { Progress } from "@repo/ui/primitives/progress";

import {
  completedCount,
  getDhikrCount,
  recordDhikrCount,
  resetIfNewDay,
} from "@/features/adhkar/lib/adhkar-progress";
import type { SerializedAzkar } from "@/features/adhkar/types";

interface Props {
  azkar: SerializedAzkar;
}

export function AdhkarReader({ azkar }: Props) {
  const t = useTranslations("adhkar");
  const { id, title, items, locale } = azkar;
  const total = items.length;

  // Required repeats per item — keyed on azkar.id so identity is stable when the parent
  // passes a referentially-new prop object with the same underlying data.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const repeats = useMemo(() => items.map((i) => i.repeat), [azkar.id]);

  const [index, setIndex] = useState(0);
  const [count, setCount] = useState(0);
  const [done, setDone] = useState(0);

  // On mount (per set): drop stale-day progress, then seed from the store.
  useEffect(() => {
    resetIfNewDay();
    setIndex(0);
    setCount(getDhikrCount(id, 0));
    setDone(completedCount(id, repeats));
  }, [id, repeats]);

  const goTo = useCallback(
    (next: number) => {
      const clamped = Math.min(Math.max(next, 0), total - 1);
      setIndex(clamped);
      setCount(getDhikrCount(id, clamped));
    },
    [id, total],
  );

  const tap = useCallback(() => {
    const item = items[index];
    if (!item) return;
    // Already at the repeat target (e.g. the last dhikr, which has no next item
    // to auto-advance to) — ignore further taps so the count can't overshoot.
    if (count >= item.repeat) return;
    const next = count + 1;
    recordDhikrCount(id, index, next);
    setDone(completedCount(id, repeats));

    if (next >= item.repeat && index < total - 1) {
      // Advance synchronously so React re-renders the next dhikr in one pass.
      const nextIndex = index + 1;
      setIndex(nextIndex);
      setCount(getDhikrCount(id, nextIndex));
    } else {
      setCount(next);
    }
  }, [count, id, index, items, repeats, total]);

  const current = items[index];
  if (!current) return null;

  const progressValue = total > 0 ? (done / total) * 100 : 0;

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <div className="flex items-baseline justify-between gap-4">
          <h1 className="font-display text-2xl font-bold text-primary">
            {title}
          </h1>
          <span className="text-sm text-text-2 shrink-0">
            {done} / {total}
          </span>
        </div>
        <Progress value={progressValue} />
      </header>

      <article className="flex flex-col items-center gap-5 rounded-lg border border-border bg-surface p-6 text-center">
        <span className="rounded-full bg-surface-2 px-3 py-1 text-sm font-medium text-primary">
          ×{current.repeat}
        </span>

        <p dir="rtl" className="font-display text-3xl leading-relaxed text-text">
          {current.ar}
        </p>

        {current.en ? (
          <p className="text-base text-text-2">{current.en}</p>
        ) : null}

        {current.transliteration ? (
          <p className="text-sm italic text-text-2">
            {current.transliteration}
          </p>
        ) : null}

        {current.virtue && (current.virtue.ar ?? current.virtue.en) ? (
          <p className="text-sm text-text-2">
            {locale === "ar"
              ? (current.virtue.ar ?? current.virtue.en)
              : (current.virtue.en ?? current.virtue.ar)}
          </p>
        ) : null}

        {current.source && (current.source.ar ?? current.source.en) ? (
          <p className="text-xs text-text-2">
            {locale === "ar"
              ? (current.source.ar ?? current.source.en)
              : (current.source.en ?? current.source.ar)}
          </p>
        ) : null}

        {current.audioUrl ? (
          <audio controls src={current.audioUrl} className="w-full">
            <track kind="captions" />
          </audio>
        ) : null}

        <button
          type="button"
          data-testid="counter"
          aria-label={t("countLabel")}
          onClick={tap}
          className="flex size-40 flex-col items-center justify-center rounded-full border-2 border-primary bg-surface-2 text-text transition-colors hover:bg-primary hover:text-primary-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <span className="text-4xl font-bold tabular-nums">{count}</span>
          <span className="text-sm text-text-2">/ {current.repeat}</span>
        </button>
      </article>

      <nav className="flex items-center justify-between gap-4">
        <Button
          variant="outline"
          size="sm"
          onClick={() => goTo(index - 1)}
          disabled={index === 0}
        >
          <span aria-hidden className="me-1 inline-block rtl:scale-x-[-1]">
            ‹
          </span>
          {t("previous")}
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => goTo(index + 1)}
          disabled={index === total - 1}
        >
          {t("next")}
          <span aria-hidden className="ms-1 inline-block rtl:scale-x-[-1]">
            ›
          </span>
        </Button>
      </nav>
    </div>
  );
}
