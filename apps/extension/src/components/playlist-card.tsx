import { getCoverEmoji, getCoverGradient } from "../lib/cover-art";
import type { PlaylistSummary } from "../lib/content";
import type { CategorySummary } from "../lib/content";
import { Play } from "./ui/icons";

type PlaylistCardProps = {
  playlist: PlaylistSummary;
  categories?: CategorySummary[];
  onPlay: (slug: string) => void;
  onOpen?: (slug: string) => void;
};

// Mirrors the web PlaylistCard: circular scholar photo (or gradient+emoji),
// font-display title, scholarName, trackCount badge, up-to-2 category chips.
// Click plays immediately; long-press / separate open handler navigates to detail.
export function PlaylistCard({ playlist, categories, onPlay, onOpen }: PlaylistCardProps) {
  const [gradFrom, gradTo] = getCoverGradient(playlist.id);
  const emoji = getCoverEmoji(playlist.id);

  const chips = categories
    ? categories.filter((c) => playlist.categoryIds.includes(c.id)).slice(0, 2)
    : [];

  return (
    <article
      className="group relative flex flex-col items-center gap-2 rounded-2xl border border-border bg-surface p-3 text-center transition-all duration-200 hover:-translate-y-1 hover:border-primary/30 hover:z-10 focus-within:ring-2 focus-within:ring-primary/50"
    >
      {/* Circular cover */}
      <button
        type="button"
        onClick={() => onPlay(playlist.slug)}
        aria-label={`تشغيل ${playlist.title}`}
        className="relative w-[78%] aspect-square rounded-full overflow-hidden focus-visible:outline-none"
      >
        {playlist.cover ? (
          <img
            src={playlist.cover}
            alt=""
            loading="lazy"
            className="size-full object-cover transition-transform group-hover:scale-105"
          />
        ) : (
          <div
            className="size-full flex items-center justify-center"
            style={{ background: `linear-gradient(to bottom, ${gradFrom}, ${gradTo})` }}
          >
            <span className="text-4xl select-none" aria-hidden="true">{emoji}</span>
          </div>
        )}
        {/* Play scrim on hover */}
        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
          <div className="size-9 rounded-full bg-primary/90 flex items-center justify-center">
            <Play className="size-4 text-primary-fg ms-0.5" />
          </div>
        </div>
      </button>

      {/* Title — opens detail if handler provided, else plays */}
      <button
        type="button"
        onClick={() => (onOpen ?? onPlay)(playlist.slug)}
        className="w-full focus-visible:outline-none"
        aria-label={playlist.title}
      >
        <h3 className="font-display text-sm font-semibold leading-snug text-text line-clamp-2">
          {playlist.title}
        </h3>
        {playlist.scholar ? (
          <p className="mt-0.5 text-xs text-text-2 line-clamp-1">{playlist.scholar}</p>
        ) : null}
      </button>

      {/* Track count badge */}
      {playlist.trackCount > 0 ? (
        <span className="rounded-full border border-primary/30 bg-primary/15 px-2.5 py-0.5 text-xs font-semibold text-primary">
          {playlist.trackCount} مقطع
        </span>
      ) : null}

      {/* Category chips */}
      {chips.length > 0 ? (
        <div className="flex flex-wrap justify-center gap-1.5">
          {chips.map((c) => (
            <span
              key={c.id}
              className="rounded-full border border-border px-2 py-0.5 text-2xs text-text-2"
            >
              {c.arName}
            </span>
          ))}
        </div>
      ) : null}
    </article>
  );
}
