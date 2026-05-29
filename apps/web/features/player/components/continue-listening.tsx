"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { useTranslations } from "next-intl";

import { Link } from "@/i18n/navigation";
import {
  clearRecentlyPlayed,
  readRecentlyPlayed,
  type RecentTrack,
} from "@/features/player/lib/recently-played";

// "Continue listening" shelf — device-local recent plays. Reads localStorage
// after mount (never during SSR) so there's no hydration mismatch; renders
// nothing until there's history to show.
export function ContinueListening() {
  const t = useTranslations("home");
  const [items, setItems] = useState<RecentTrack[] | null>(null);

  useEffect(() => {
    setItems(readRecentlyPlayed());
  }, []);

  if (!items || items.length === 0) return null;

  // Only entries that know their playlist can deep-link back to playback.
  const linkable = items.filter((item) => item.playlistSlug);
  if (linkable.length === 0) return null;

  const handleClear = (): void => {
    clearRecentlyPlayed();
    setItems([]);
  };

  return (
    <section aria-labelledby="continue-heading" className="mt-8">
      <div className="flex items-center justify-between">
        <h2 id="continue-heading" className="text-lg font-semibold">
          {t("continueListening")}
        </h2>
        <button
          type="button"
          onClick={handleClear}
          className="text-sm text-text-2 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm px-2 py-1"
        >
          {t("clearHistory")}
        </button>
      </div>

      <ul className="mt-3 flex gap-4 overflow-x-auto pb-2">
        {linkable.map((item) => {
          // Narrow the stored locale (a plain string) back to the routing union.
          const linkLocale =
            item.locale === "ar" || item.locale === "en"
              ? item.locale
              : undefined;
          return (
            <li key={item.trackId} className="shrink-0 w-40">
            <Link
              href={`/playlists/${item.playlistSlug}`}
              locale={linkLocale}
              className="group block focus-visible:outline-none"
            >
              <div className="relative aspect-square w-40 overflow-hidden rounded-md bg-surface-2">
                {item.coverUrl && (
                  <Image
                    src={item.coverUrl}
                    alt=""
                    fill
                    sizes="160px"
                    className="object-cover transition-transform group-hover:scale-105"
                  />
                )}
              </div>
              <p className="mt-2 truncate text-sm font-medium group-hover:text-primary">
                {item.title}
              </p>
              {item.playlistTitle && (
                <p className="truncate text-xs text-text-2">
                  {item.playlistTitle}
                </p>
              )}
            </Link>
          </li>
          );
        })}
      </ul>
    </section>
  );
}
