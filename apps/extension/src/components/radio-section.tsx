import { useEffect, useState } from "react";

import { fetchStations, buildStationQueue, type RadioStationSummary } from "../lib/content";
import { currentItem, type PlayerCommand, type PlayerState } from "../lib/player-state";
import { useI18n } from "../lib/i18n";

function PlayIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="size-4" aria-hidden="true">
      <path d="M8 5v14l11-7z" />
    </svg>
  );
}

function PauseIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="size-4" aria-hidden="true">
      <path d="M6 5h4v14H6zM14 5h4v14h-4z" />
    </svg>
  );
}

function RadioGlyph() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="size-7" aria-hidden="true">
      <path d="M3.5 8.5 18 3M6 8.5h14a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-9a1 1 0 0 1 1-1z" />
      <circle cx="8" cy="14" r="3" />
      <path d="M16 12.5h2M16 15.5h2" strokeLinecap="round" />
    </svg>
  );
}

// Home "Radio" shelf. Fetches live stations and loads a tapped station as a
// one-item live queue into the shared player engine. LIVE UI (no seek) is
// handled by PlayerBar via QueueItem.isLive.
export function RadioSection({
  state,
  send,
}: {
  state: PlayerState | null;
  send: (command: PlayerCommand) => void;
}) {
  const { t } = useI18n();
  const [stations, setStations] = useState<RadioStationSummary[]>([]);

  useEffect(() => {
    void fetchStations()
      .then(setStations)
      .catch(() => {});
  }, []);

  if (stations.length === 0) return null;

  const currentId = state ? (currentItem(state)?.id ?? null) : null;
  const playing = state?.status === "playing";

  const handlePlay = (station: RadioStationSummary) => {
    const id = `radio:${station.slug}`;
    if (currentId === id) {
      send({ type: "toggle" });
      return;
    }
    send({ type: "load", queue: buildStationQueue(station), index: 0 });
  };

  return (
    <section className="space-y-3">
      <h2 className="text-xs font-semibold uppercase tracking-[0.08em] text-text-2">{t("home.radio")}</h2>
      <ul className="grid gap-3 sm:grid-cols-2">
        {stations.map((station) => {
          const isCurrent = currentId === `radio:${station.slug}`;
          const playingNow = isCurrent && playing;
          return (
            <li
              key={station.slug}
              className={`flex items-center gap-3 rounded-xl border bg-surface p-3 transition-colors ${
                isCurrent ? "border-primary/50 bg-primary/5" : "border-border"
              }`}
            >
              <div className="flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-primary/10 text-primary">
                {station.image ? (
                  <img src={station.image} alt="" loading="lazy" className="size-full object-cover" />
                ) : (
                  <RadioGlyph />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-text">{station.title}</p>
                <span className="mt-0.5 inline-flex items-center gap-1.5 text-2xs font-semibold tracking-wide text-danger">
                  <span className={`size-1.5 rounded-full bg-danger ${playingNow ? "animate-pulse" : ""}`} />
                  {t("radio.live")}
                </span>
              </div>
              <button
                type="button"
                onClick={() => handlePlay(station)}
                aria-label={playingNow ? t("player.pause") : t("player.play")}
                className="inline-flex size-10 shrink-0 items-center justify-center rounded-full bg-primary text-primary-fg transition-transform hover:scale-105"
              >
                {playingNow ? <PauseIcon /> : <PlayIcon />}
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
