import { useEffect, useState } from "react";

import { getBookmarks } from "../lib/quran-progress";
import type { AyahRef } from "../lib/storage";
import { useI18n } from "../lib/i18n";
import { navigate } from "../lib/router";
import { Bookmark, SkipBack } from "./ui/icons";

export function BookmarksList() {
  const { t } = useI18n();
  const [bookmarks, setBookmarks] = useState<AyahRef[]>([]);

  useEffect(() => {
    void getBookmarks().then(setBookmarks);
  }, []);

  return (
    <div className="mx-auto max-w-2xl space-y-5 px-4 py-8">
      <button
        type="button"
        onClick={() => navigate({ view: "quran" })}
        className="inline-flex items-center gap-1.5 text-xs text-text-2 hover:text-primary"
      >
        <SkipBack className="size-3.5 rtl:scale-x-[-1]" />
        {t("quran.title")}
      </button>

      <h1 className="font-display text-2xl font-bold text-primary">{t("quran.bookmarks")}</h1>

      {bookmarks.length === 0 ? (
        <p className="text-center text-sm text-text-2">{t("quran.noBookmarks")}</p>
      ) : (
        <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-surface">
          {bookmarks.map((b) => (
            <li key={`${b.surah}:${b.ayah}`}>
              <button
                type="button"
                onClick={() => navigate({ view: "quran-read", surah: String(b.surah) })}
                className="flex w-full items-center gap-3 px-4 py-3 text-start hover:bg-primary/5 transition-colors"
              >
                <Bookmark className="size-4 shrink-0 text-primary" filled />
                <span className="text-sm font-medium text-text">
                  {b.surahName ?? `Surah ${b.surah}`} · {b.ayah}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
