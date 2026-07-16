import type { RadioStationSummary } from "../lib/content";
import { useI18n } from "../lib/i18n";

function PlayIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="size-3.5" aria-hidden="true">
      <path d="M8 5v14l11-7z" />
    </svg>
  );
}

function PauseIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="size-3.5" aria-hidden="true">
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
      className="size-4"
      aria-hidden="true"
    >
      <path d="M12 2l2.9 6.1 6.6.9-4.8 4.7 1.2 6.6L12 17.9 6.1 21l1.2-6.6L2.5 9.7l6.6-.9L12 2z" />
    </svg>
  );
}

function RadioGlyph() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="size-6" aria-hidden="true">
      <path d="M3.5 8.5 18 3M6 8.5h14a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-9a1 1 0 0 1 1-1z" />
      <circle cx="8" cy="14" r="3" />
      <path d="M16 12.5h2M16 15.5h2" strokeLinecap="round" />
    </svg>
  );
}

// The lone geometric ornament (khatam/8-point star) — used once, as a divider
// next to the live label, not as decoration elsewhere.
function Star8Icon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="size-2.5 shrink-0 text-primary/80" aria-hidden="true">
      <path d="M12 0l2.2 7.6L20 4l-3.6 6.4L24 12l-7.6 1.6L20 20l-6.4-3.6L12 24l-1.6-7.6L4 20l3.6-6.4L0 12l7.6-1.6L4 4l6.4 3.6z" />
    </svg>
  );
}

// Three bars next to "مباشر" — idle/grey until this exact card is playing,
// then animates (respects prefers-reduced-motion via `motion-safe:`).
function WaveformMini({ playing }: { playing: boolean }) {
  return (
    <span className="flex h-[9px] items-end gap-[1.5px]" aria-hidden="true">
      {[0, 150, 300].map((delay) => (
        <span
          key={delay}
          style={playing ? { animationDelay: `${delay}ms` } : undefined}
          className={`h-[3px] w-[2px] rounded-[1px] transition-colors duration-200 ${
            playing ? "motion-safe:animate-[radio-wave-bar_1.1s_ease-in-out_infinite] bg-primary" : "bg-text-2"
          }`}
        />
      ))}
    </span>
  );
}

interface Props {
  station: RadioStationSummary;
  isCurrent: boolean;
  isPlaying: boolean;
  isFavorite: boolean;
  onPlay: (station: RadioStationSummary) => void;
  onToggleFavorite: (slug: string) => void;
}

// Lantern-tile radio card — arch shape, sun-glow-while-playing, star+waveform
// LIVE badge. Same design as the web/mobile StationCard, plus a favorite star
// overlay. Used by both the home "Radio" shelf (radio-section.tsx) and the
// full /radio page (radio-page.tsx).
export function StationCard({ station, isCurrent, isPlaying, isFavorite, onPlay, onToggleFavorite }: Props) {
  const { t } = useI18n();
  const playingNow = isCurrent && isPlaying;

  return (
    <div
      className={`group relative overflow-hidden rounded-t-[22px] rounded-b-[14px] border bg-surface px-4 pt-[22px] pb-6 text-center transition-[transform,box-shadow,border-color] duration-300 hover:-translate-y-1 hover:shadow-[0_16px_40px_rgb(0_0_0/35%)] ${
        playingNow
          ? "border-[rgb(228_197_126/55%)] shadow-[0_0_0_1px_rgb(228_197_126/35%),0_10px_28px_rgb(200_160_80/22%),0_0_36px_rgb(228_197_126/22%)] motion-safe:animate-[radio-card-glow_2.6s_ease-in-out_infinite]"
          : "border-border"
      }`}
    >
      <button
        type="button"
        onClick={() => onPlay(station)}
        aria-label={`${playingNow ? t("player.pause") : t("player.play")}: ${station.title}`}
        className="absolute inset-0 z-0 cursor-pointer rounded-t-[22px] rounded-b-[14px]"
      />

      <button
        type="button"
        onClick={() => onToggleFavorite(station.slug)}
        aria-pressed={isFavorite}
        aria-label={isFavorite ? t("radio.unfavorite") : t("radio.favorite")}
        className={`absolute end-2 top-2 z-10 inline-flex size-8 cursor-pointer items-center justify-center rounded-full transition-colors hover:bg-surface-2 ${
          isFavorite ? "text-primary" : "text-text-2"
        }`}
      >
        <StarIcon filled={isFavorite} />
      </button>

      {/* Sun-like bloom behind the icon, same warm gold as the prayer-times sun arc. */}
      <span
        aria-hidden="true"
        className={`pointer-events-none absolute -inset-x-[30%] -top-[30%] h-[170px] origin-[50%_20%] bg-[radial-gradient(circle_at_50%_30%,rgb(228_197_126/0.3),transparent_68%)] transition-opacity duration-300 ${
          playingNow ? "opacity-100 motion-safe:animate-[radio-glow-pulse_2.6s_ease-in-out_infinite]" : "opacity-45"
        }`}
      />

      <span
        className={`relative mx-auto mb-3 flex size-[52px] items-center justify-center rounded-full bg-surface-2 text-primary shadow-[0_0_0_1px_rgb(200_160_80/22%)] transition-shadow duration-300 ${
          playingNow ? "shadow-[0_0_0_1px_rgb(200_160_80/45%),0_0_22px_rgb(200_160_80/45%)]" : ""
        }`}
      >
        {station.image ? (
          <img src={station.image} alt="" loading="lazy" className="size-full rounded-full object-cover" />
        ) : (
          <RadioGlyph />
        )}
      </span>
      <p className="relative mb-1.5 truncate text-sm text-text">{station.title}</p>
      <span
        className={`relative inline-flex items-center gap-1.5 text-2xs font-semibold uppercase tracking-wide ${
          playingNow ? "text-primary" : "text-text-2"
        }`}
      >
        <Star8Icon />
        <WaveformMini playing={playingNow} />
        {t("radio.live")}
      </span>
      <span
        aria-hidden="true"
        className={`relative mx-auto mt-3.5 flex size-9 items-center justify-center rounded-full bg-primary text-primary-fg shadow-[0_4px_14px_rgb(200_160_80/35%)] transition-shadow duration-300 ${
          playingNow ? "shadow-[0_0_0_6px_rgb(200_160_80/12%),0_4px_18px_rgb(200_160_80/55%)]" : ""
        }`}
      >
        {playingNow ? <PauseIcon /> : <PlayIcon />}
      </span>
    </div>
  );
}
