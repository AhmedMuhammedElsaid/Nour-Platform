"use client";

import { useEffect, useState } from "react";
import { Link } from "@/i18n/navigation";
import { getLastRead, type AyahRef } from "../lib/quran-progress";

// Shared by the `/quran` landing page (which knows every surah name up
// front and reserves a bottom margin before its own list) and the home
// route's shelf (no margin — the shelf's own layout spaces it, and it falls
// back to the ayah ref's own `surahName` since it has no name lookup table).
// Previously two near-identical components (`continue-reading-shelf.tsx`);
// merged during the Phase 2.3 bundle-trim pass (CLAUDE.md §4 — no duplicate
// components for what is one presentational unit).
export function ContinueReading({
  surahNames = {},
  className,
}: {
  surahNames?: Record<number, string>;
  className?: string;
}) {
  const [ref, setRef] = useState<AyahRef | null>(null);
  useEffect(() => setRef(getLastRead()), []);
  if (!ref) return null;
  const name = ref.surahName ?? surahNames[ref.surah] ?? `Surah ${ref.surah}`;
  return (
    <Link
      href={`/quran/${ref.surah}#ayah-${ref.numberGlobal ?? ref.ayah}`}
      className={`border-border bg-surface hover:border-primary flex items-center justify-between rounded-lg border p-4 ${className ?? ""}`}
    >
      <span>
        <span className="text-text-2 block text-xs">Continue reading</span>
        <span className="text-text font-medium">
          {name} · Ayah {ref.ayah}
        </span>
      </span>
      <span className="text-primary">→</span>
    </Link>
  );
}
