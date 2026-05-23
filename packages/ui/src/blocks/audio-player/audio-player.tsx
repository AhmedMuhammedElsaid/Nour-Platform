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

  // Keyboard shortcuts: Space toggles play/pause, Arrow keys jog ±10s.
  // Suppress when the user is typing into an editable element so we don't
  // hijack form input.
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
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [hasQueue, toggle, seek, currentTime]);

  if (!hasQueue || !currentTrack) return null;

  const sliderMax = duration > 0 ? duration : currentTrack.durationSecs ?? 0;
  const sliderValue = sliderMax > 0 ? Math.min(currentTime, sliderMax) : 0;

  return (
    <section
      role="region"
      aria-label="Audio player"
      className={cn(
        "fixed bottom-0 inset-x-0 z-50",
        "bg-surface border-t border-border shadow-3",
      )}
    >
      <div className="max-w-5xl mx-auto px-6 py-3 flex items-center gap-4">
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
              {formatTime(currentTime)}
            </span>
            <Slider
              aria-label="Seek"
              className="flex-1"
              min={0}
              max={sliderMax > 0 ? sliderMax : 1}
              step={1}
              value={[sliderValue]}
              onValueChange={(values) => {
                const v = values[0];
                if (typeof v === "number") seek(v);
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
    </section>
  );
}
