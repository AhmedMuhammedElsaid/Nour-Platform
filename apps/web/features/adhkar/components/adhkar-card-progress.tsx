"use client";

import { useEffect, useState } from "react";

import { completedCount, resetIfNewDay } from "@/features/adhkar/lib/adhkar-progress";

interface AdhkarCardProgressProps {
  setId: string;
  repeats: number[];
}

// SSR-safe: reads localStorage only after mount to avoid hydration mismatch.
// Returns null on SSR and zero-state until effect runs.
export function AdhkarCardProgress({ setId, repeats }: AdhkarCardProgressProps) {
  const [mounted, setMounted] = useState(false);
  const [completed, setCompleted] = useState(0);
  const total = repeats.length;

  useEffect(() => {
    resetIfNewDay();
    setCompleted(completedCount(setId, repeats));
    setMounted(true);
  }, [setId, repeats]);

  if (!mounted) {
    return (
      <div className="mt-2 space-y-1">
        <div className="h-1 w-full rounded-full bg-primary/10" />
      </div>
    );
  }

  const pct = total > 0 ? Math.round((completed / total) * 100) : 0;

  return (
    <div className="mt-2 space-y-1">
      <p className="text-xs text-text-2">
        {completed} / {total} today
      </p>
      <div className="h-1 w-full rounded-full bg-primary/15">
        <div
          className="h-full rounded-full bg-primary transition-[width] duration-300"
          style={{ width: `${pct}%` }}
          aria-label={`${pct}% complete`}
        />
      </div>
    </div>
  );
}
