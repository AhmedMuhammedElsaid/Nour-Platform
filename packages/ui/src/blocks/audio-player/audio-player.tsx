"use client";

import * as React from "react";
import {
  Gauge,
  ListMusic,
  Loader2,
  Pause,
  Play,
  Repeat,
  Repeat1,
  RotateCcw,
  RotateCw,
  Shuffle,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";

import { cn } from "../../lib/utils";
import { Button } from "../../primitives/button";
import { Slider } from "../../primitives/slider";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "../../primitives/sheet";
import { toast } from "../../primitives/toaster";
import { PLAYBACK_RATES, usePlayer } from "./player-context";
import { useDir } from "../../hooks/use-dir";

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
    isBuffering,
    errorMessage,
    currentTime,
    duration,
    currentTrack,
    currentIndex,
    queue,
    repeatMode,
    isShuffled,
    playbackRate,
    volume,
    toggle,
    seek,
    next,
    prev,
    goTo,
    retry,
    stop,
    cycleRepeat,
    toggleShuffle,
    setPlaybackRate,
    setVolume,
    sleepTimerEndsAt,
    sleepAtTrackEnd,
    setSleepTimer,
  } = usePlayer();
  const dir = useDir();

  // Tick once a second only while a timed sleep timer is running, so the
  // remaining-time readout stays live without a constant interval.
  const [now, setNow] = React.useState<number>(() => Date.now());
  React.useEffect(() => {
    if (sleepTimerEndsAt == null) return;
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [sleepTimerEndsAt]);
  const sleepRemainingMs =
    sleepTimerEndsAt != null ? Math.max(0, sleepTimerEndsAt - now) : 0;

  // With repeat-all or shuffle on there is always a track to move to, so the
  // transport ends are only "hard" boundaries in plain sequential mode.
  const atSequentialEnd = repeatMode !== "all" && !isShuffled;
  const disablePrev = atSequentialEnd && currentIndex <= 0;
  const disableNext = atSequentialEnd && currentIndex >= queue.length - 1;
  // A live radio stream: no seeking, no queue navigation — show a LIVE badge and
  // hide the seek bar + shuffle/skip/repeat transport (radio feature).
  const isLive = currentTrack?.isLive ?? false;
  const repeatLabel =
    repeatMode === "one"
      ? "Repeat one"
      : repeatMode === "all"
        ? "Repeat all"
        : "Repeat off";

  // Mirror playback errors to a transient toast (DESIGN.md §17.1); the inline
  // chip remains the persistent, in-bar surface.
  React.useEffect(() => {
    if (errorMessage) toast.error(errorMessage);
  }, [errorMessage]);

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
        if (!isLive) seek(Math.max(0, currentTime - 10));
        return;
      }
      if (event.key === "ArrowRight") {
        event.preventDefault();
        if (!isLive) seek(currentTime + 10);
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
        return;
      }
      if (event.key === "s" || event.key === "S") {
        event.preventDefault();
        toggleShuffle();
        return;
      }
      if (event.key === "r" || event.key === "R") {
        event.preventDefault();
        cycleRepeat();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [hasQueue, isLive, toggle, seek, currentTime, next, prev, toggleShuffle, cycleRepeat]);

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
        "bg-surface border-t border-border shadow-up-3",
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
            <div className="min-w-0 flex-1 flex items-center gap-3">
              {currentTrack.coverUrl && (
                // Decorative — the adjacent track title carries the label.
                // next/image is unavailable inside packages/ui; a sized, lazy
                // <img> satisfies DESIGN.md §17.5 (40px, not priority).
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={currentTrack.coverUrl}
                  alt=""
                  width={40}
                  height={40}
                  loading="lazy"
                  className="size-10 rounded-sm object-cover shrink-0"
                />
              )}
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-foreground">
                  {currentTrack.title}
                </p>
                <p className="truncate text-xs text-muted">
                  {currentTrack.playlistTitle ??
                    `Track ${currentIndex + 1} / ${queue.length}`}
                </p>
              </div>
            </div>

        <div className="flex-1 flex flex-col items-center gap-1">
          <div className="flex items-center gap-2">
            {!isLive && (
              <>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Replay from start"
                  onClick={() => seek(0)}
                >
                  <RotateCcw />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Shuffle"
                  aria-pressed={isShuffled}
                  onClick={toggleShuffle}
                  className={cn(isShuffled && "text-primary")}
                >
                  <Shuffle />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Previous track"
                  onClick={prev}
                  disabled={disablePrev}
                >
                  <SkipBack className="rtl:scale-x-[-1]" />
                </Button>
              </>
            )}
            <Button
              variant="default"
              size="icon"
              aria-label={isPlaying ? "Pause" : "Play"}
              onClick={toggle}
              className="rounded-full hover:scale-105 transition-transform"
            >
              {/* Spinner while buffering; control stays enabled (§17.1). */}
              {isBuffering ? (
                <Loader2 className="animate-spin" aria-hidden="true" />
              ) : isPlaying ? (
                <Pause />
              ) : (
                <Play />
              )}
            </Button>
            {!isLive && (
              <>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Next track"
                  onClick={next}
                  disabled={disableNext}
                >
                  <SkipForward className="rtl:scale-x-[-1]" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={repeatLabel}
                  aria-pressed={repeatMode !== "off"}
                  onClick={cycleRepeat}
                  className={cn(repeatMode !== "off" && "text-primary")}
                >
                  {repeatMode === "one" ? <Repeat1 /> : <Repeat />}
                </Button>
              </>
            )}
          </div>
          {isLive ? (
            <div className="w-full flex items-center justify-center gap-2 py-1">
              <span
                className="size-2 rounded-full bg-destructive animate-pulse"
                aria-hidden="true"
              />
              <span className="text-xs font-semibold tracking-wide text-foreground">
                LIVE
              </span>
            </div>
          ) : (
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
          )}
        </div>

        <div className="shrink-0 flex items-center gap-1">
          {/* Volume control — desktop only */}
          <div className="hidden md:flex items-center gap-1.5">
            <button
              type="button"
              aria-label={volume === 0 ? "Unmute" : "Mute"}
              onClick={() => setVolume(volume === 0 ? 1 : 0)}
              className="inline-flex size-8 items-center justify-center rounded-md text-text-2 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {volume === 0 ? (
                <VolumeX className="size-4" />
              ) : (
                <Volume2 className="size-4" />
              )}
            </button>
            <Slider
              aria-label="Volume"
              aria-valuetext={`${Math.round(volume * 100)}%`}
              className="w-20"
              min={0}
              max={1}
              step={0.02}
              value={[volume]}
              // Must update on change, not commit: this Slider is controlled by
              // `volume`, so without feeding each change back into the prop the
              // Radix value never advances and onValueCommit sees no change and
              // never fires (unlike seek, volume has no commit-latency concern).
              onValueChange={(values) => {
                const v = values[0];
                if (typeof v === "number") setVolume(v);
              }}
            />
          </div>
          {errorMessage && (
            <button
              type="button"
              onClick={retry}
              className="inline-flex items-center gap-1 rounded-sm px-2 py-1 text-xs font-medium text-destructive hover:bg-surface-2 outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
            >
              <RotateCw className="size-3.5" aria-hidden="true" />
              Retry
            </button>
          )}
          <Sheet>
            <SheetTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Playback settings"
              >
                <Gauge />
              </Button>
            </SheetTrigger>
            <SheetContent
              side={dir === "rtl" ? "left" : "right"}
              aria-label="Playback settings"
            >
              <SheetHeader>
                <SheetTitle>Playback settings</SheetTitle>
                <SheetDescription className="sr-only">
                  Adjust playback speed and the sleep timer.
                </SheetDescription>
              </SheetHeader>
              <div className="px-2 py-3">
                <p
                  id="speed-label"
                  className="mb-2 text-xs font-medium text-muted"
                >
                  Speed
                </p>
                <div
                  role="group"
                  aria-labelledby="speed-label"
                  className="flex flex-wrap gap-2"
                >
                  {PLAYBACK_RATES.map((rate) => (
                    <Button
                      key={rate}
                      type="button"
                      variant={rate === playbackRate ? "default" : "outline"}
                      size="sm"
                      aria-pressed={rate === playbackRate}
                      onClick={() => setPlaybackRate(rate)}
                    >
                      {rate}×
                    </Button>
                  ))}
                </div>

                <p
                  id="sleep-label"
                  className="mt-6 mb-2 text-xs font-medium text-muted"
                >
                  Sleep timer
                  {sleepTimerEndsAt != null && (
                    <span className="ms-2 text-primary tabular-nums">
                      {formatTime(sleepRemainingMs / 1000)}
                    </span>
                  )}
                </p>
                <div
                  role="group"
                  aria-labelledby="sleep-label"
                  className="flex flex-wrap gap-2"
                >
                  {[15, 30, 45, 60].map((minutes) => (
                    <Button
                      key={minutes}
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setSleepTimer(minutes)}
                    >
                      {minutes}m
                    </Button>
                  ))}
                  <Button
                    type="button"
                    variant={sleepAtTrackEnd ? "default" : "outline"}
                    size="sm"
                    aria-pressed={sleepAtTrackEnd}
                    onClick={() => setSleepTimer("end-of-track")}
                  >
                    End of track
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={sleepTimerEndsAt == null && !sleepAtTrackEnd}
                    onClick={() => setSleepTimer(null)}
                  >
                    Off
                  </Button>
                </div>
              </div>
            </SheetContent>
          </Sheet>
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" aria-label="Queue">
                <ListMusic />
              </Button>
            </SheetTrigger>
            <SheetContent side={dir === "rtl" ? "left" : "right"} aria-label="Play queue">
              <SheetHeader>
                <SheetTitle>Queue</SheetTitle>
                <SheetDescription className="sr-only">
                  The list of tracks queued to play.
                </SheetDescription>
              </SheetHeader>
              <ol className="-mx-2 overflow-y-auto">
                {queue.map((track, index) => (
                  <li key={track.id}>
                    <SheetClose asChild>
                      <button
                        type="button"
                        onClick={() => goTo(index)}
                        aria-current={
                          index === currentIndex ? "true" : undefined
                        }
                        className={cn(
                          "w-full flex items-center gap-3 rounded-md px-2 py-2 text-start text-sm outline-none",
                          "hover:bg-surface-2 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-bg",
                          index === currentIndex
                            ? "text-primary font-medium"
                            : "text-foreground",
                        )}
                      >
                        <span className="w-5 shrink-0 text-2xs text-muted tabular-nums text-end">
                          {index + 1}
                        </span>
                        <span className="truncate">{track.title}</span>
                      </button>
                    </SheetClose>
                  </li>
                ))}
              </ol>
            </SheetContent>
          </Sheet>
          {/* Close: stop playback + clear the queue so the bar slides away. */}
          <Button
            variant="ghost"
            size="icon"
            aria-label="Close player"
            onClick={stop}
          >
            <X />
          </Button>
        </div>
          </div>
        </>
      )}
    </section>
  );
}
