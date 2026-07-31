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

// The secondary transport — replay · shuffle · prev · next · repeat — renders
// in two places: inline in the bar at `sm`+, and inside the queue Sheet below
// `sm`, where the bar only has room for play/pause. Both copies must stay in
// lockstep (handlers, disabled logic, and the accent styling), so they share
// this one definition and differ only by the visibility class the call site
// passes. It reads the player context directly rather than taking a dozen
// props. `center` is the slot between prev and next: the bar puts play/pause
// there so it stays visually centred; the Sheet leaves it empty.
function SecondaryTransport({
  className,
  center,
}: {
  className?: string;
  center?: React.ReactNode;
}) {
  const {
    currentIndex,
    queue,
    repeatMode,
    isShuffled,
    seek,
    next,
    prev,
    cycleRepeat,
    toggleShuffle,
  } = usePlayer();

  // With repeat-all or shuffle on there is always a track to move to, so the
  // transport ends are only "hard" boundaries in plain sequential mode.
  const atSequentialEnd = repeatMode !== "all" && !isShuffled;
  const disablePrev = atSequentialEnd && currentIndex <= 0;
  const disableNext = atSequentialEnd && currentIndex >= queue.length - 1;
  const repeatLabel =
    repeatMode === "one"
      ? "Repeat one"
      : repeatMode === "all"
        ? "Repeat all"
        : "Repeat off";

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        aria-label="Replay from start"
        onClick={() => seek(0)}
        className={className}
      >
        <RotateCcw />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        aria-label="Shuffle"
        aria-pressed={isShuffled}
        onClick={toggleShuffle}
        className={cn(className, isShuffled && "text-primary")}
      >
        <Shuffle />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        aria-label="Previous track"
        onClick={prev}
        disabled={disablePrev}
        className={className}
      >
        <SkipBack className="rtl:scale-x-[-1]" />
      </Button>
      {center}
      <Button
        variant="ghost"
        size="icon"
        aria-label="Next track"
        onClick={next}
        disabled={disableNext}
        className={className}
      >
        <SkipForward className="rtl:scale-x-[-1]" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        aria-label={repeatLabel}
        aria-pressed={repeatMode !== "off"}
        onClick={cycleRepeat}
        className={cn(className, repeatMode !== "off" && "text-primary")}
      >
        {repeatMode === "one" ? <Repeat1 /> : <Repeat />}
      </Button>
    </>
  );
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

  // A live radio stream: no seeking, no queue navigation — show a LIVE badge and
  // hide the seek bar + shuffle/skip/repeat transport (radio feature).
  const isLive = currentTrack?.isLive ?? false;

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

  // Publish the bar's real rendered height (mobile ~101px wrapped vs desktop
  // 72px, both including the safe-area padding below) as a CSS custom
  // property on the document root. Layout-level consumers (the clearance
  // spacer in app/[locale]/layout.tsx, the adhkar reset FAB, the install
  // prompt) read `var(--player-height, 0px)` instead of hardcoding a number
  // that is already wrong on mobile. ResizeObserver (not a state-driven
  // layout read) so this never triggers a React re-render — it only writes
  // the DOM property that CSS `calc()` elsewhere consumes.
  const barRef = React.useRef<HTMLElement | null>(null);
  React.useEffect(() => {
    const el = barRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const setHeight = (height: number): void => {
      document.documentElement.style.setProperty(
        "--player-height",
        `${height}px`,
      );
    };
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      // borderBoxSize, NOT contentRect: contentRect is the content box, which
      // excludes the border-t and the pb-[env(safe-area-inset-bottom)] below.
      // On a home-indicator iPhone that inset is ~34px, so measuring the
      // content box under-reports the bar by exactly the amount of clearance
      // those devices need — the defect this property exists to prevent.
      const borderBox = entry.borderBoxSize?.[0];
      setHeight(
        borderBox ? borderBox.blockSize : el.getBoundingClientRect().height,
      );
    });
    // box: "border-box" — the default observes the CONTENT box, so a change to
    // the safe-area padding alone would never fire the callback. That is a real
    // case: env(safe-area-inset-bottom) differs between portrait and landscape.
    observer.observe(el, { box: "border-box" });
    setHeight(el.getBoundingClientRect().height);
    return () => {
      observer.disconnect();
      setHeight(0);
    };
  }, []);

  const sliderMax =
    currentTrack != null
      ? duration > 0
        ? duration
        : currentTrack.durationSecs ?? 0
      : 0;
  // Show the dragged position while scrubbing; otherwise track playback.
  const displayTime = scrubValue ?? currentTime;
  const sliderValue = sliderMax > 0 ? Math.min(displayTime, sliderMax) : 0;

  // Hoisted so it can be handed to <SecondaryTransport> as the `center` slot
  // (it sits between prev and next) without duplicating the markup.
  const playPause = (
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
  );

  // Render the bar even when idle so it slides out via CSS (DESIGN.md
  // §17.1/§17.5) instead of unmounting. Inner content guards on currentTrack.
  return (
    <section
      ref={barRef}
      role="region"
      aria-label="Audio player"
      aria-hidden={!hasQueue}
      className={cn(
        "fixed bottom-0 inset-x-0 z-40",
        "bg-surface border-t border-border shadow-up-3",
        "transition-transform transition-opacity",
        "duration-[var(--motion-base)] ease-[var(--ease-standard)]",
        hasQueue
          ? "translate-y-0 opacity-100 pb-[env(safe-area-inset-bottom)]"
          : "translate-y-full opacity-0 pointer-events-none",
      )}
    >
      {currentTrack && (
        <>
          {/* Announce track changes to assistive tech — DESIGN.md §17.3. */}
          <p className="sr-only" aria-live="polite">
            Now playing: {currentTrack.title}
          </p>
          {/* Below `sm` the row wraps: [track info | right cluster] on line 1,
              the transport + seek row on line 2 (`order-3` + `basis-full`). A
              single row cannot hold both at 360px — the right cluster alone is
              128px unshrinkable. `order` is direction-agnostic, so `dir="rtl"`
              still mirrors this correctly without `flex-row-reverse`. */}
          <div className="max-w-5xl mx-auto px-3 sm:px-6 h-auto min-h-16 md:h-[72px] py-2 sm:py-0 flex flex-wrap sm:flex-nowrap items-center gap-x-2 gap-y-1 sm:gap-4">
            {/* sm:order-none is required, not decorative: its siblings reset
                their order at sm, so leaving this at order-1 pushes the track
                info to the END of the desktop bar. */}
            <div className="order-1 sm:order-none min-w-0 flex-1 flex items-center gap-3">
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

        {/* `basis-full` (not `flex-1`) below `sm` is what forces the wrap; at
            `sm` it reverts to a shared, growable column. */}
        <div className="order-3 sm:order-none basis-full sm:basis-0 grow min-w-0 flex flex-row sm:flex-col items-center gap-2 sm:gap-1">
          {/* Secondary transport is `hidden` below `sm` — the same <SecondaryTransport>
              is rendered inside the queue Sheet at that width (see below), so
              nothing becomes unreachable. */}
          <div className="shrink-0 flex items-center gap-2">
            {isLive ? (
              playPause
            ) : (
              <SecondaryTransport
                className="hidden sm:inline-flex"
                center={playPause}
              />
            )}
          </div>
          {isLive ? (
            <div className="min-w-0 grow sm:grow-0 sm:w-full flex items-center justify-center gap-2 py-1">
              <span
                className="size-2 rounded-full bg-destructive animate-pulse"
                aria-hidden="true"
              />
              <span className="text-xs font-semibold tracking-wide text-foreground">
                LIVE
              </span>
            </div>
          ) : (
            <div className="min-w-0 grow sm:grow-0 sm:w-full flex items-center gap-2 sm:gap-3">
              <span
                className="text-2xs text-text-2 tabular-nums w-10 shrink-0 text-end"
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
              {/* Duration is redundant on a phone (it is also in the slider's
                  aria-valuetext) and costs 40px of an already-tight seek row. */}
              <span
                className="hidden sm:block text-2xs text-text-2 tabular-nums w-10 shrink-0"
                aria-hidden="true"
              >
                {formatTime(sliderMax)}
              </span>
            </div>
          )}
        </div>

        <div className="order-2 sm:order-none flex items-center gap-1">
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
              aria-label="Retry"
              className="inline-flex shrink-0 items-center gap-1 rounded-sm px-2 py-1 text-xs font-medium text-destructive hover:bg-surface-2 outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
            >
              <RotateCw className="size-3.5" aria-hidden="true" />
              {/* Label is dropped below `sm`; aria-label above keeps the
                  accessible name. */}
              <span className="hidden sm:inline">Retry</span>
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
              {/* The secondary transport, relocated. Below `sm` the bar has
                  room for play/pause only, so these live here instead — the
                  Sheet is the one surface always reachable from the bar.
                  Deliberately NOT wrapped in SheetClose: skipping tracks or
                  toggling repeat should not dismiss the queue. */}
              {!isLive && (
                <div
                  role="group"
                  aria-label="Transport controls"
                  // gap-0 + shrink-0: five 44px targets need 220px and the
                  // Sheet offers ~221px, so any gap forced them to shrink to
                  // 41px — silently undoing the touch-target work for the very
                  // controls that were relocated here. flex-wrap is the safety
                  // valve if a narrower Sheet ever appears.
                  className="sm:hidden mb-2 flex flex-wrap items-center justify-center gap-0 border-b border-border pb-3"
                >
                  <SecondaryTransport className="shrink-0" />
                </div>
              )}
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
