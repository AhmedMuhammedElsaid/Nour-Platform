"use client";

import { useEffect, useState } from "react";
import { Link } from "@/i18n/navigation";
import { getLastRead, type AyahRef } from "../lib/quran-progress";

export function ContinueReadingShelf() {
  const [ref, setRef] = useState<AyahRef | null>(null);
  useEffect(() => setRef(getLastRead()), []);
  if (!ref) return null;
  const name = ref.surahName ?? `Surah ${ref.surah}`;
  return (
    <Link
      href={`/quran/${ref.surah}#ayah-${ref.numberGlobal ?? ref.ayah}`}
      className="border-border bg-surface hover:border-primary flex items-center justify-between rounded-lg border p-4"
    >
      <span>
        <span className="text-text-2 block text-xs">Continue reading</span>
        <span className="text-text font-medium">{name} · Ayah {ref.ayah}</span>
      </span>
      <span className="text-primary">→</span>
    </Link>
  );
}
