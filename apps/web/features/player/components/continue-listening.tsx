"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { useTranslations } from "next-intl";

import { Link } from "@/i18n/navigation";
import {
  clearRecentlyPlayed,
  getSavedPosition,
  readRecentlyPlayed,
  type RecentTrack,
} from "@/features/player/lib/recently-played";
import { getCoverEmoji, getCoverGradient } from "@/features/playlists/lib/cover-art";

// "Continue listening" shelf — device-local recent plays. Reads localStorage
// after mount (never during SSR) so there's no hydration mismatch; renders
// nothing until there's history to show.
export function ContinueListening() {
  const t = useTranslations("home");
  const tPlayer = useTranslations("player");
  const [items, setItems] = useState<RecentTrack[] | null>(null);

  useEffect(() => {
    setItems(readRecentlyPlayed());
  }, []);

  if (!items || items.length === 0) return null;

  // Only entries that know their playlist can deep-link back to playback.
  const linkable = items.filter((item) => item.playlistSlug).slice(0, 6);
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

      <ul className="mt-3 flex gap-4 overflow-x-auto pb-2 pt-2">
        {linkable.map((item) => {
          const linkLocale =
            item.locale === "ar" || item.locale === "en"
              ? item.locale
              : undefined;

          const savedPos = getSavedPosition(item.trackId);
          const pct =
            item.duration && item.duration > 0 && savedPos > 0
              ? Math.min(1, savedPos / item.duration)
              : null;
          const pctLabel =
            pct !== null ? tPlayer("percentComplete", { pct: Math.round(pct * 100) }) : null;

          const [gradFrom, gradTo] = getCoverGradient(item.trackId);
          const emoji = getCoverEmoji(item.trackId);

          return (
            <li key={item.trackId} className="shrink-0 w-40">
              <Link
                href={`/playlists/${item.playlistSlug}#${item.trackId}`}
                locale={linkLocale}
                className="group relative rounded-2xl border border-border bg-surface hover:-translate-y-1 hover:z-10 hover:border-primary/30 transition-all duration-200 flex flex-col items-center text-center gap-2 p-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {/* Circle cover */}
                <div className="relative w-[78%] aspect-square rounded-full overflow-hidden">
                  {item.coverUrl ? (
                    <Image
                      src={item.coverUrl}
                      alt=""
                      fill
                      sizes="112px"
                      className="object-cover transition-transform group-hover:scale-105"
                    />
                  ) : (
                    <div
                      className="size-full flex items-center justify-center"
                      style={{
                        background: `linear-gradient(to bottom, ${gradFrom}, ${gradTo})`,
                      }}
                    >
                      <span className="text-3xl select-none" aria-hidden="true">
                        {emoji}
                      </span>
                    </div>
                  )}
                  {/* Dark scrim + gold play circle on hover */}
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-none">
                    <div className="size-8 rounded-full bg-primary/90 flex items-center justify-center">
                      <svg className="size-3.5 text-primary-foreground ms-0.5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                        <path d="M8 5v14l11-7z" />
                      </svg>
                    </div>
                  </div>
                </div>

                {/* Resume progress bar — sits between circle and title */}
                {pct !== null && (
                  <div className="w-[78%] h-[3px] rounded-full bg-primary/20">
                    <div
                      data-testid="resume-bar"
                      className="h-full rounded-full bg-primary"
                      style={{ width: `${Math.round(pct * 100)}%` }}
                    />
                  </div>
                )}

                <p className="truncate text-sm font-medium group-hover:text-primary w-full">
                  {item.title}
                </p>
                {pctLabel !== null ? (
                  <p className="truncate text-xs text-primary/70 w-full">{pctLabel}</p>
                ) : item.playlistTitle ? (
                  <p className="truncate text-xs text-text-2 w-full">{item.playlistTitle}</p>
                ) : null}
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
