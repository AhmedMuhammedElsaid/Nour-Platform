import Link from "next/link";

import type { SerializedPlaylist } from "@/features/playlists/types";

interface PlaylistCardProps {
  playlist: SerializedPlaylist;
}

export function PlaylistCard({ playlist }: PlaylistCardProps) {
  const trackCount = playlist.trackIds.length;

  return (
    <Link
      href={`/playlists/${playlist.slug}`}
      className="rounded-xl border border-border bg-surface hover:bg-surface-2 transition-colors p-5 flex flex-col gap-2"
    >
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-display text-lg font-semibold leading-tight">
          {playlist.title}
        </h2>
        {playlist.status === "published" && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-success/10 px-2 py-0.5 text-xs font-medium text-success">
            <span
              aria-hidden="true"
              className="size-1.5 rounded-full bg-success"
            />
            Published
          </span>
        )}
      </div>

      {playlist.description != null && (
        <p className="text-sm text-text-2 line-clamp-2">
          {playlist.description}
        </p>
      )}

      <p className="text-xs text-text-2 mt-auto">
        {trackCount} {trackCount === 1 ? "track" : "tracks"}
      </p>
    </Link>
  );
}
