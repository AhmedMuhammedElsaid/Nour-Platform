"use client";

import { useTranslations } from "next-intl";

import { cn } from "@repo/ui/lib/utils";

import type { StationView } from "../types";

function PlayIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="size-5" aria-hidden="true">
      <path d="M8 5v14l11-7z" />
    </svg>
  );
}

function PauseIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="size-5" aria-hidden="true">
      <path d="M6 5h4v14H6zM14 5h4v14h-4z" />
    </svg>
  );
}

function StarIcon({ filled }: { filled: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth={2}
      className="size-5"
      aria-hidden="true"
    >
      <path d="M12 2l2.9 6.1 6.6.9-4.8 4.7 1.2 6.6L12 17.9 6.1 21l1.2-6.6L2.5 9.7l6.6-.9L12 2z" />
    </svg>
  );
}

function RadioGlyph() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="size-8" aria-hidden="true">
      <path d="M3.5 8.5 18 3M6 8.5h14a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-9a1 1 0 0 1 1-1z" />
      <circle cx="8" cy="14" r="3" />
      <path d="M16 12.5h2M16 15.5h2" strokeLinecap="round" />
    </svg>
  );
}

interface Props {
  station: StationView;
  isCurrent: boolean;
  isPlaying: boolean;
  isFavorite: boolean;
  onPlay: (station: StationView) => void;
  onToggleFavorite: (slug: string) => void;
}

export function StationCard({
  station,
  isCurrent,
  isPlaying,
  isFavorite,
  onPlay,
  onToggleFavorite,
}: Props) {
  const t = useTranslations("radio");
  const playingNow = isCurrent && isPlaying;

  return (
    <div
      className={cn(
        "flex items-center gap-4 rounded-xl border border-border bg-surface p-4 transition-colors",
        isCurrent && "border-primary/50 bg-primary/5",
      )}
    >
      <div className="flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-primary/10 text-primary">
        {station.image ? (
          // eslint-disable-next-line @next/next/no-img-element -- station art is a small avatar; sizes/fill unneeded and stations may be remote logos
          <img src={station.image} alt="" width={56} height={56} className="size-full object-cover" loading="lazy" />
        ) : (
          <RadioGlyph />
        )}
      </div>

      <div className="min-w-0 flex-1">
        <p className="truncate font-medium text-text">{station.name}</p>
        {station.description ? (
          <p className="mt-0.5 line-clamp-2 text-sm text-text-2">{station.description}</p>
        ) : null}
        <span className="mt-1 inline-flex items-center gap-1.5 text-2xs font-semibold tracking-wide text-danger">
          <span className={cn("size-1.5 rounded-full bg-danger", playingNow && "animate-pulse")} />
          {t("live")}
        </span>
      </div>

      <div className="flex shrink-0 items-center gap-1">
        <button
          type="button"
          onClick={() => onToggleFavorite(station.slug)}
          aria-pressed={isFavorite}
          aria-label={isFavorite ? t("unfavorite") : t("favorite")}
          className={cn(
            "inline-flex size-9 items-center justify-center rounded-full transition-colors hover:bg-surface-2",
            isFavorite ? "text-primary" : "text-text-2",
          )}
        >
          <StarIcon filled={isFavorite} />
        </button>
        <button
          type="button"
          onClick={() => onPlay(station)}
          aria-label={playingNow ? t("pause") : t("play")}
          className="inline-flex size-11 items-center justify-center rounded-full bg-primary text-primary-fg transition-transform hover:scale-105"
        >
          {playingNow ? <PauseIcon /> : <PlayIcon />}
        </button>
      </div>
    </div>
  );
}
