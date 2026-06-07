"use client";

import { useEffect, useState } from "react";
import { Link } from "@/i18n/navigation";
import { getBookmarks, type AyahRef } from "../lib/quran-progress";

export function BookmarksList() {
  const [bookmarks, setBookmarks] = useState<AyahRef[]>([]);
  useEffect(() => setBookmarks(getBookmarks()), []);

  if (bookmarks.length === 0) {
    return (
      <p data-testid="bookmarks-empty" className="text-text-2 py-8 text-center text-sm">
        No bookmarks yet.
      </p>
    );
  }

  const groups = new Map<number, { name: string; items: AyahRef[] }>();
  for (const b of bookmarks) {
    const g = groups.get(b.surah) ?? { name: b.surahName ?? `Surah ${b.surah}`, items: [] };
    g.items.push(b);
    groups.set(b.surah, g);
  }

  return (
    <ul className="divide-border divide-y">
      {[...groups.entries()].map(([surah, g]) => (
        <li key={surah} className="py-3">
          <p className="text-text mb-1 font-medium">{g.name}</p>
          <div className="flex flex-wrap gap-2">
            {g.items.map((b) => (
              <Link
                key={`${b.surah}:${b.ayah}`}
                href={`/quran/${b.surah}#ayah-${b.numberGlobal ?? b.ayah}`}
                className="border-border text-text-2 hover:border-primary hover:text-primary rounded-full border px-3 py-1 text-sm"
              >
                {b.ayah}
              </Link>
            ))}
          </div>
        </li>
      ))}
    </ul>
  );
}
