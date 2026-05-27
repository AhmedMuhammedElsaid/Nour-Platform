"use client";

import * as React from "react";
import { Pause, Play, SkipBack, SkipForward } from "lucide-react";

import { cn } from "../../lib/utils";
import { Button } from "../../primitives/button";
import { Slider } from "../../primitives/slider";
import { usePlayer } from "./player-context";

function formatTime(totalSeconds: number): string {
  if (!Number.isFinite(totalSeconds) || totalSeconds < 0) return "0:00";
  const seconds = Math.floor(totalSeconds % 60);
  const minutes = Math.floor(totalSeconds / 60);
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

function isEditableTarget(node: Element | null): boolean {
  if (!node) return false;
  const tag = node.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  // Account for contenteditable regions too — typing there should not steal
  // playback shortcuts.
  if (node instanceof HTMLElement && node.isContentEditable) return true;
  return false;
}

export function AudioPlayer() {
  const {
    hasQueue,
    isPlaying,
    currentTime,
    duration,
    currentTrack,
    currentIndex,
    queue,
    toggle,
    seek,
    next,
    prev,
  } = usePlayer();

  // While the user drags the seek slider we track the pending value locally and
  // only commit it (seek the audio element) on release — DESIGN.md §17.2 wants
  // seek-on-commit, not scrub-on-drag, to avoid per-tick seek latency.
  const [scrubValue, setScrubValue] = React.useState<number | null>(null);

  // Keyboard shortcuts: Space toggles play/pause, ←/→ jog ±10s, n/p change
  // track. Suppress when the user is typing into an editable element so we
  // don't hijack form input (DESIGN.md §17.2).
  React.useEffect(() => {
    if (!hasQueue) return;
    const onKeyDown = (event: KeyboardEvent): void => {
      if (isEditableTarget(document.activeElement)) return;
      if (event.key === " " || event.code === "Space") {
        event.preventDefault();
        toggle();
        return;
      }
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        seek(Math.max(0, currentTime - 10));
        return;
      }
      if (event.key === "ArrowRight") {
        event.preventDefault();
        seek(currentTime + 10);
        return;
      }
      if (event.key === "n" || event.key === "N") {
        event.preventDefault();
        next();
        return;
      }
      if (event.key === "p" || event.key === "P") {
        event.preventDefault();
        prev();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [hasQueue, toggle, seek, currentTime, next, prev]);

  const sliderMax =
    currentTrack != null
      ? duration > 0
        ? duration
        : currentTrack.durationSecs ?? 0
      : 0;
  // Show the dragged position while scrubbing; otherwise track playback.
  const displayTime = scrubValue ?? currentTime;
  const sliderValue = sliderMax > 0 ? Math.min(displayTime, sliderMax) : 0;

  // Render the bar even when idle so it slides out via CSS (DESIGN.md
  // §17.1/§17.5) instead of unmounting. Inner content guards on currentTrack.
  return (
    <section
      role="region"
      aria-label="Audio player"
      aria-hidden={!hasQueue}
      className={cn(
        "fixed bottom-0 inset-x-0 z-40",
        "bg-surface border-t border-border shadow-up-2",
        "transition-transform transition-opacity",
        "duration-[var(--motion-base)] ease-[var(--ease-standard)]",
        hasQueue
          ? "translate-y-0 opacity-100"
          : "translate-y-full opacity-0 pointer-events-none",
      )}
    >
      {currentTrack && (
        <>
          {/* Announce track changes to assistive tech — DESIGN.md §17.3. */}
          <p className="sr-only" aria-live="polite">
            Now playing: {currentTrack.title}
          </p>
          <div className="max-w-5xl mx-auto px-6 h-16 md:h-[72px] flex items-center gap-4">
            <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-foreground">
            {currentTrack.title}
          </p>
          <p className="text-xs text-muted">
            Track {currentIndex + 1} / {queue.length}
          </p>
        </div>

        <div className="flex-1 flex flex-col items-center gap-1">
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              aria-label="Previous track"
              onClick={prev}
              disabled={currentIndex <= 0}
            >
              <SkipBack />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              aria-label={isPlaying ? "Pause" : "Play"}
              onClick={toggle}
            >
              {isPlaying ? <Pause /> : <Play />}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Next track"
              onClick={next}
              disabled={currentIndex >= queue.length - 1}
            >
              <SkipForward />
            </Button>
          </div>
          <div className="w-full flex items-center gap-3">
            <span
              className="text-2xs text-text-2 tabular-nums w-10 text-end"
              aria-hidden="true"
            >
              {formatTime(displayTime)}
            </span>
            <Slider
              aria-label="Seek"
              aria-valuetext={`${formatTime(sliderValue)} of ${formatTime(sliderMax)}`}
              className="flex-1"
              min={0}
              max={sliderMax > 0 ? sliderMax : 1}
              step={1}
              value={[sliderValue]}
              onValueChange={(values) => {
                const v = values[0];
                if (typeof v === "number") setScrubValue(v);
              }}
              onValueCommit={(values) => {
                const v = values[0];
                if (typeof v === "number") seek(v);
                setScrubValue(null);
              }}
            />
            <span
              className="text-2xs text-text-2 tabular-nums w-10"
              aria-hidden="true"
            >
              {formatTime(sliderMax)}
            </span>
          </div>
        </div>
          </div>
        </>
      )}
    </section>
  );
}
