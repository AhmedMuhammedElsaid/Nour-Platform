import { useEffect, useRef, useState } from "react";

import { getJson } from "../lib/api";
import { getCoverEmoji, getCoverGradient } from "../lib/cover-art";
import { useI18n } from "../lib/i18n";
import { navigate } from "../lib/router";
import type { PlayerCommand, PlayerState } from "../lib/player-state";
import { buildPlaylistQueue, recordRecent } from "../lib/content";
import { Search } from "./ui/icons";

type PlaylistHit = { id: string; title: string; slug: string; coverMediaId?: string };
type TrackHit = { id: string; title: string; playlistId: string; playlistSlug: string; playlistTitle: string };
type SearchResult = { playlists: PlaylistHit[]; tracks: TrackHit[] };

type Props = {
  initialQ: string;
  state: PlayerState | null;
  send: (cmd: PlayerCommand) => void;
};

export function SearchView({ initialQ, state: _state, send }: Props) {
  const { t, locale } = useI18n();
  const [q, setQ] = useState(initialQ);
  const [result, setResult] = useState<SearchResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Autofocus the input when the view mounts.
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Sync the hash so the back/forward works with the typed query.
  useEffect(() => {
    const trimmed = q.trim();
    const hashQ = trimmed ? encodeURIComponent(trimmed) : "";
    const next = hashQ ? `#/search?q=${hashQ}` : "#/search";
    if (window.location.hash !== next) window.location.hash = next.slice(1);
  }, [q]);

  // Debounced live search — fires 350ms after the user stops typing.
  useEffect(() => {
    const trimmed = q.trim();
    if (trimmed.length < 1) {
      setResult(null);
      setError(false);
      return;
    }
    setLoading(true);
    setError(false);
    const id = setTimeout(() => {
      void getJson<SearchResult>("/search", { q: trimmed, locale })
        .then((r) => {
          setResult(r);
          setLoading(false);
        })
        .catch(() => {
          setError(true);
          setLoading(false);
        });
    }, 350);
    return () => clearTimeout(id);
  }, [q, locale]);

  async function playTrack(playlistSlug: string, trackId: string): Promise<void> {
    const { queue, recent } = await buildPlaylistQueue(playlistSlug);
    if (queue.length === 0) return;
    const index = queue.findIndex((item) => item.id === trackId);
    send({ type: "load", queue, index: index >= 0 ? index : 0 });
    await recordRecent(recent);
  }

  const hasResults =
    result && (result.playlists.length > 0 || result.tracks.length > 0);
  const isEmpty = result && !hasResults;

  return (
    <div className="mx-auto max-w-2xl space-y-6 px-4 py-8">
      {/* Search input */}
      <div className="relative">
        <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-text-2" />
        <input
          ref={inputRef}
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={t("search.placeholder")}
          aria-label={t("common.search")}
          className="h-11 w-full rounded-xl border border-border bg-surface ps-10 pe-4 text-sm text-text outline-none placeholder:text-text-2 focus-visible:ring-2 focus-visible:ring-primary/50"
          dir="auto"
        />
        {loading ? (
          <span className="absolute end-3 top-1/2 -translate-y-1/2 text-xs text-text-2">
            …
          </span>
        ) : null}
      </div>

      {/* Error */}
      {error ? (
        <p className="text-center text-sm text-danger">{t("search.error")}</p>
      ) : null}

      {/* Empty */}
      {isEmpty ? (
        <p className="text-center text-sm text-text-2">{t("search.noResults")}</p>
      ) : null}

      {/* Playlist hits */}
      {result && result.playlists.length > 0 ? (
        <section className="space-y-2">
          <h2 className="text-xs font-semibold uppercase tracking-[0.08em] text-text-2">
            {t("search.playlists")}
          </h2>
          <ul className="space-y-1">
            {result.playlists.map((p) => {
              const [gradFrom, gradTo] = getCoverGradient(p.id);
              const emoji = getCoverEmoji(p.id);
              return (
                <li key={p.id}>
                  <button
                    type="button"
                    onClick={() => navigate({ view: "playlist", slug: p.slug })}
                    className="flex w-full items-center gap-3 rounded-xl border border-border bg-surface px-3 py-2.5 text-start hover:bg-surface-2 transition-colors"
                  >
                    <div
                      className="flex size-9 shrink-0 items-center justify-center rounded-full text-base"
                      style={{ background: `linear-gradient(to bottom, ${gradFrom}, ${gradTo})` }}
                    >
                      <span aria-hidden="true">{emoji}</span>
                    </div>
                    <span className="truncate text-sm font-medium text-text">{p.title}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      {/* Track hits */}
      {result && result.tracks.length > 0 ? (
        <section className="space-y-2">
          <h2 className="text-xs font-semibold uppercase tracking-[0.08em] text-text-2">
            {t("search.tracks")}
          </h2>
          <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-surface">
            {result.tracks.map((track) => (
              <li key={track.id}>
                <button
                  type="button"
                  onClick={() => void playTrack(track.playlistSlug, track.id)}
                  className="flex w-full flex-col gap-0.5 px-4 py-3 text-start hover:bg-surface-2 transition-colors"
                >
                  <span className="truncate text-sm font-medium text-text">{track.title}</span>
                  <span className="truncate text-xs text-text-2">{track.playlistTitle}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
