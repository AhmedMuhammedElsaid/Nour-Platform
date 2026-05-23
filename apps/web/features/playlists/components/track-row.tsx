import type { SerializedTrack } from "@/features/playlists/types";

interface TrackRowProps {
  track: SerializedTrack;
  index: number;
}

function formatDuration(secs: number): string {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function TrackRow({ track, index }: TrackRowProps) {
  return (
    <li
      className="flex items-center gap-4 py-3 border-b border-border last:border-0"
      data-track-id={track.id}
    >
      <span className="w-6 text-right text-sm text-text-2 shrink-0">
        {index}
      </span>
      <span className="flex-1 font-medium">{track.title}</span>
      <span className="text-sm text-text-2 shrink-0">
        {track.durationSecs != null ? formatDuration(track.durationSecs) : "—"}
      </span>
    </li>
  );
}
