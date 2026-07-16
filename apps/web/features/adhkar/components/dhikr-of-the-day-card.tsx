"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";

import type { Azkar } from "@repo/api/schemas/azkar";
import type { Locale } from "@repo/api/schemas/locale";
import { pickDhikrOfTheDay } from "@repo/shared-core/adhkar/dhikr-of-the-day";

import { Link } from "@/i18n/navigation";
import {
  getDhikrCount,
  recordDhikrCount,
  resetIfNewDay,
} from "@/features/adhkar/lib/adhkar-progress";

interface Props {
  sets: Azkar[];
  locale: Locale;
}

// Home "Dhikr of the day" card — one dhikr item, deterministically picked by
// calendar day from every published Azkar set's items[] (pickDhikrOfTheDay),
// with an inline tap counter. Counting writes to the SAME nour.adhkar.progress
// store the full AdhkarReader uses (same setId + itemIndex), so progress is
// shared between this card and the full set's reader.
//
// Layout mirrors StationCard's absolute-inset-0-link pattern (see
// apps/web/features/radio/components/station-card.tsx) to avoid nesting a
// <button> inside a <Link> (invalid HTML — interactive-in-interactive): the
// Link is an absolute-inset-0 layer under pointer-events-none content, and
// the counter is a normal sibling button at a higher z-index.
export function DhikrOfTheDayCard({ sets, locale }: Props) {
  const t = useTranslations("home");
  const tAdhkar = useTranslations("adhkar");
  const [mounted, setMounted] = useState(false);
  const [count, setCount] = useState(0);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Only computed once mounted, so the server render and the FIRST client
  // render both produce null — no hydration mismatch.
  const picked = useMemo(() => (mounted ? pickDhikrOfTheDay(sets) : null), [mounted, sets]);

  useEffect(() => {
    if (picked == null) return;
    resetIfNewDay();
    setCount(getDhikrCount(picked.setId, picked.itemIndex));
  }, [picked]);

  if (picked == null) return null;

  const { item, setId, itemIndex } = picked;
  const isDone = count >= item.repeat;
  const virtue =
    locale === "ar" ? (item.virtue?.ar ?? item.virtue?.en) : (item.virtue?.en ?? item.virtue?.ar);
  const parentSet = sets.find((s) => s.id === setId);
  const href = parentSet ? `/adhkar/${parentSet[locale].slug}` : "/adhkar";

  const tap = () => {
    if (isDone) return;
    const next = count + 1;
    recordDhikrCount(setId, itemIndex, next);
    setCount(next);
  };

  return (
    <section aria-labelledby="dhikr-of-the-day-heading" className="mt-8">
      <h2 id="dhikr-of-the-day-heading" className="text-lg font-semibold">
        {t("dhikrOfTheDay")}
      </h2>

      <div className="relative mt-3 flex flex-col items-center gap-3 overflow-hidden rounded-2xl border border-border bg-surface p-6 text-center">
        <Link href={href} className="absolute inset-0 z-0" aria-label={t("dhikrOfTheDay")} />

        <p
          dir="rtl"
          className="pointer-events-none relative font-display text-xl leading-relaxed text-text"
        >
          {item.ar}
        </p>
        {item.en ? (
          <p className="pointer-events-none relative text-sm text-text-2">{item.en}</p>
        ) : null}
        {virtue ? (
          <p className="pointer-events-none relative text-xs text-text-2">{virtue}</p>
        ) : null}

        <button
          type="button"
          data-testid="dhikr-of-the-day-counter"
          aria-label={tAdhkar("countLabel")}
          aria-disabled={isDone || undefined}
          onClick={tap}
          className="relative z-10 flex size-14 flex-col items-center justify-center rounded-full border-2 border-primary bg-surface-2 text-text transition-colors hover:bg-primary hover:text-primary-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {isDone ? (
            <span aria-label={tAdhkar("completed")} className="text-lg">
              ✓
            </span>
          ) : (
            <>
              <span className="text-base font-bold tabular-nums">{count}</span>
              <span className="text-xs text-text-2">/ {item.repeat}</span>
            </>
          )}
        </button>
      </div>
    </section>
  );
}
