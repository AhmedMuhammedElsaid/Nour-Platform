import { useEffect, useRef, useState } from "react";

import { getCoverEmoji, getCoverGradient } from "../lib/cover-art";
import { Skeleton } from "./skeleton";
import {
  buildPlaylistQueue,
  fetchPlaylistDetail,
  recordRecent,
  type CategorySummary,
  type PlaylistDetailData,
} from "../lib/content";
import { navigate } from "../lib/router";
import { useI18n } from "../lib/i18n";
import { get } from "../lib/storage";
import type { PlayerState } from "../lib/player-state";
import type { PlayerCommand } from "../lib/player-state";
import { currentItem } from "../lib/player-state";
import { Pause, Play, SkipBack } from "./ui/icons";

function fmt(sec: number): string {
  const s = Math.round(sec);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

type Props = {
  slug: string;
  startTrackId?: string;
  state: PlayerState | null;
  send: (cmd: PlayerCommand) => void;
  categories: CategorySummary[];
};

export function PlaylistDetail({ slug, startTrackId, state, send, categories }: Props) {
  const { t } = useI18n();
  const [detail, setDetail] = useState<PlaylistDetailData | null>(null);
  const [positions, setPositions] = useState<Record<string, { t: number }>>({});
  const [error, setError] = useState(false);
  const startedRef = useRef(false);

  useEffect(() => {
    setDetail(null);
    setError(false);
    startedRef.current = false;
    void Promise.all([
      fetchPlaylistDetail(slug),
      get("nour.player.positions"),
    ]).then(([d, pos]) => {
      setDetail(d);
      setPositions(pos);
    }).catch(() => setError(true));
  }, [slug]);

  // Auto-start at a specific track when deep-linking from continue-listening.
  useEffect(() => {
    if (!detail || startedRef.current) return;
    startedRef.current = true;
    void (async () => {
      const { queue, recent } = await buildPlaylistQueue(slug);
      if (queue.length === 0) return;
      let index = 0;
      if (startTrackId) {
        const found = queue.findIndex((q) => q.id === startTrackId);
        if (found >= 0) index = found;
      }
      send({ type: "load", queue, index });
      await recordRecent(recent);
    })();
  // Only run when detail first loads (slug + startTrackId drive it).
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [detail]);

  const playingItem = state ? currentItem(state) : null;
  const isThisPlaylist =
    state && detail
      ? state.queue.some((q) => q.artist === detail.title || q.slug === detail.slug)
      : false;

  async function playFrom(trackId: string): Promise<void> {
    const { queue, recent } = await buildPlaylistQueue(slug);
    if (queue.length === 0) return;
    const index = queue.findIndex((q) => q.id === trackId);
    send({ type: "load", queue, index: index >= 0 ? index : 0 });
    await recordRecent(recent);
  }

  async function playAll(): Promise<void> {
    const { queue, recent } = await buildPlaylistQueue(slug);
    if (queue.length === 0) return;
    send({ type: "load", queue, index: 0 });
    await recordRecent(recent);
  }

  // ── Loading / error ────────────────────────────────────────────────────────

  if (error) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3">
        <p className="text-sm text-text-2">{t("playlist.error")}</p>
        <button
          type="button"
          onClick={() => navigate({ view: "home" })}
          className="text-xs text-primary hover:underline"
        >
          {t("playlist.back")}
        </button>
      </div>
    );
  }

  if (!detail) {
    return (
      <div className="mx-auto max-w-3xl space-y-6 px-4 py-8" aria-hidden="true">
        <Skeleton className="h-48 w-full rounded-xl sm:h-64" />
        <Skeleton className="h-8 w-2/3" />
        <Skeleton className="h-4 w-1/2" />
        <div className="space-y-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4 py-2">
              <Skeleton className="h-4 w-6" />
              <Skeleton className="h-4 flex-1" />
              <Skeleton className="h-4 w-10" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  const [gradFrom, gradTo] = getCoverGradient(detail.id);
  const emoji = getCoverEmoji(detail.id);
  const chips = categories.filter((c) => detail.categoryIds.includes(c.id));

  return (
    <div className="mx-auto max-w-3xl space-y-8 px-4 py-8">
      {/* Back */}
      <button
        type="button"
        onClick={() => navigate({ view: "home" })}
        className="inline-flex items-center gap-1.5 text-xs text-text-2 hover:text-primary"
        aria-label={t("common.back")}
      >
        <SkipBack className="size-3.5 rtl:scale-x-[-1]" />
        {t("playlist.back")}
      </button>

      {/* Hero */}
      <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start sm:gap-6">
        <div className="relative size-40 shrink-0 overflow-hidden rounded-full">
          {detail.cover ? (
            <img
              src={detail.cover}
              alt=""
              className="size-full object-cover"
            />
          ) : (
            <div
              className="size-full flex items-center justify-center"
              style={{ background: `linear-gradient(to bottom, ${gradFrom}, ${gradTo})` }}
            >
              <span className="text-5xl select-none" aria-hidden="true">{emoji}</span>
            </div>
          )}
        </div>

        <div className="flex-1 space-y-3 text-center sm:text-start">
          <h1 className="font-display text-2xl font-bold text-text">{detail.title}</h1>
          {detail.scholar ? (
            <p className="text-sm font-medium text-text-2">{detail.scholar}</p>
          ) : null}
          {detail.description ? (
            <p className="text-sm leading-relaxed text-text-2 line-clamp-4">{detail.description}</p>
          ) : null}

          {chips.length > 0 ? (
            <div className="flex flex-wrap justify-center gap-1.5 sm:justify-start">
              {chips.map((c) => (
                <span
                  key={c.id}
                  className="rounded-full border border-border px-2.5 py-0.5 text-xs text-text-2"
                >
                  {c.arName} · {c.enName}
                </span>
              ))}
            </div>
          ) : null}

          <button
            type="button"
            onClick={() => void playAll()}
            className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2 text-sm font-semibold text-primary-fg hover:opacity-90 transition-opacity"
          >
            <Play className="size-4" />
            {t("playlist.playAll")}
          </button>
        </div>
      </div>

      {/* Track list */}
      <ol className="divide-y divide-border rounded-xl border border-border bg-surface">
        {detail.tracks.map((track, idx) => {
          const isCurrent = isThisPlaylist && playingItem?.id === track.id;
          const isPlaying = isCurrent && state?.status === "playing";
          const savedT = positions[track.id]?.t ?? 0;
          const pct =
            track.durationSecs && track.durationSecs > 0 && savedT > 0
              ? Math.min(1, savedT / track.durationSecs)
              : null;

          const rowInner = (
            <>
              {/* Play/pause glyph (presentational — the whole row is the control) or track number */}
              {track.hasAudio ? (
                <span
                  aria-hidden="true"
                  className={`flex size-8 shrink-0 items-center justify-center rounded-full transition-colors ${
                    isCurrent
                      ? "bg-primary text-primary-fg"
                      : "text-text-2 group-hover:bg-surface-2 group-hover:text-primary"
                  }`}
                >
                  {isPlaying ? <Pause className="size-3.5" /> : <Play className="size-3.5 ms-0.5" />}
                </span>
              ) : (
                <span className="flex size-8 shrink-0 items-center justify-end text-sm text-muted">
                  {idx + 1}
                </span>
              )}

              {/* Title + resume bar */}
              <div className="min-w-0 flex-1">
                <p className={`truncate text-sm ${isCurrent ? "font-semibold text-primary" : "text-text"}`}>
                  {track.title}
                </p>
                {pct !== null ? (
                  <div className="mt-1 h-0.5 w-full rounded-full bg-primary/20">
                    <div
                      className="h-full rounded-full bg-primary"
                      style={{ width: `${Math.round(pct * 100)}%` }}
                    />
                  </div>
                ) : null}
              </div>

              {/* Duration */}
              <span className="shrink-0 font-mono text-xs text-text-2">
                {track.durationSecs != null ? fmt(track.durationSecs) : "—"}
              </span>
            </>
          );

          return (
            <li key={track.id}>
              {track.hasAudio ? (
                // Entire row is clickable to play (or toggle if it's the current track).
                <button
                  type="button"
                  aria-label={isPlaying ? `${t("player.pause")} ${track.title}` : `${t("player.play")} ${track.title}`}
                  onClick={() => {
                    if (isCurrent) {
                      send({ type: "toggle" });
                    } else {
                      void playFrom(track.id);
                    }
                  }}
                  className={`group flex w-full cursor-pointer items-center gap-3 px-4 py-3 text-start transition-colors ${
                    isCurrent ? "bg-primary/5" : "hover:bg-surface-2"
                  }`}
                >
                  {rowInner}
                </button>
              ) : (
                <div className="flex items-center gap-3 px-4 py-3">{rowInner}</div>
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
