import { useEffect, useState } from "react";

import {
  currentItem,
  PLAYBACK_RATES,
  type PlayerCommand,
  type PlayerState,
} from "../lib/player-state";
import { useI18n } from "../lib/i18n";
import { Slider } from "./ui/slider";
import { Sheet } from "./ui/sheet";
import {
  Gauge,
  ListMusic,
  LoaderCircle,
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
} from "./ui/icons";

function fmt(sec: number): string {
  if (!Number.isFinite(sec) || sec < 0) return "0:00";
  const s = Math.floor(sec);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

const SLEEP_MINUTES = [15, 30, 45, 60] as const;

const ghost =
  "inline-flex size-9 items-center justify-center rounded text-text-2 hover:bg-surface-2 hover:text-text";
const pill = "rounded-md border px-3 py-1.5 text-sm transition-colors";

// Full now-playing bar (mirrors the web audio player). Shared by the new-tab and
// popup. Renders nothing until a track is loaded.
export function PlayerBar({
  state,
  send,
}: {
  state: PlayerState | null;
  send: (command: PlayerCommand) => void;
}) {
  const { t } = useI18n();
  const [scrub, setScrub] = useState<number | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [queueOpen, setQueueOpen] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  const sleepEndsAt = state?.sleepTimerEndsAt ?? null;
  // Tick once a second only while a timed sleep is pending, to show its countdown.
  useEffect(() => {
    if (sleepEndsAt == null) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [sleepEndsAt]);

  // Keyboard shortcuts (mirror web): space, ←/→ ±10s, n/p, s, r. Bail on editable
  // targets and while a sheet is open so typing/menus aren't hijacked.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!state || settingsOpen || queueOpen) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
      switch (e.key) {
        case " ":
          e.preventDefault();
          send({ type: "toggle" });
          break;
        case "ArrowLeft":
          if (!currentItem(state)?.isLive)
            send({ type: "seek", positionSec: Math.max(0, state.positionSec - 10) });
          break;
        case "ArrowRight":
          if (!currentItem(state)?.isLive)
            send({ type: "seek", positionSec: Math.min(state.durationSec, state.positionSec + 10) });
          break;
        case "n":
        case "N":
          send({ type: "next" });
          break;
        case "p":
        case "P":
          send({ type: "prev" });
          break;
        case "s":
        case "S":
          send({ type: "toggleShuffle" });
          break;
        case "r":
        case "R":
          send({ type: "cycleRepeat" });
          break;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [state, settingsOpen, queueOpen, send]);

  if (!state) return null;
  const item = currentItem(state);
  if (!item) return null;

  const playing = state.status === "playing";
  // Live radio stream: no seek, no queue navigation — LIVE badge + play only.
  const isLive = item.isLive ?? false;
  const duration = state.durationSec || 0;
  const sliderValue = scrub ?? Math.min(state.positionSec, duration);
  const sleepRemaining = sleepEndsAt != null ? Math.max(0, (sleepEndsAt - now) / 1000) : null;
  const sleepActive = sleepEndsAt != null || state.sleepAtTrackEnd;

  return (
    <div
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-surface/95 backdrop-blur shadow-[0_-2px_12px_rgb(0_0_0/0.35)]"
      dir="rtl"
    >
      <div className="mx-auto max-w-5xl px-4 py-2">
        <div className="flex items-center gap-3">
          {/* Track info */}
          <div className="flex min-w-0 flex-1 items-center gap-3">
            {item.artwork ? (
              <img
                src={item.artwork}
                alt=""
                width={40}
                height={40}
                loading="lazy"
                className="size-10 shrink-0 rounded object-cover"
              />
            ) : null}
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-text">{item.title}</p>
              <p className="truncate text-xs text-text-2">
                {item.artist ?? t("player.trackOf").replace("{index}", String(state.index + 1)).replace("{total}", String(state.queue.length))}
              </p>
            </div>
          </div>

          {/* Transport */}
          <div className="flex shrink-0 items-center gap-1">
            {!isLive && (
              <>
                <button
                  type="button"
                  onClick={() => send({ type: "seek", positionSec: 0 })}
                  aria-label={t("player.replay")}
                  title={t("player.replay")}
                  className={ghost}
                >
                  <RotateCcw className="size-4" />
                </button>
                <button
                  type="button"
                  onClick={() => send({ type: "toggleShuffle" })}
                  aria-label={t("player.shuffle")}
                  aria-pressed={state.shuffle}
                  className={`${ghost} ${state.shuffle ? "text-primary" : ""}`}
                >
                  <Shuffle className="size-4" />
                </button>
                <button
                  type="button"
                  onClick={() => send({ type: "prev" })}
                  aria-label={t("player.prev")}
                  className={ghost}
                >
                  <SkipBack className="size-5 rtl:scale-x-[-1]" />
                </button>
              </>
            )}
            <button
              type="button"
              onClick={() => send({ type: "toggle" })}
              aria-label={playing ? t("player.pause") : t("player.play")}
              className="inline-flex size-10 items-center justify-center rounded-full bg-primary text-primary-fg hover:scale-105 transition-transform"
            >
              {state.isBuffering ? (
                <LoaderCircle className="size-5 animate-spin" />
              ) : playing ? (
                <Pause className="size-5" />
              ) : (
                <Play className="size-5" />
              )}
            </button>
            {!isLive && (
              <>
                <button
                  type="button"
                  onClick={() => send({ type: "next" })}
                  aria-label={t("player.next")}
                  className={ghost}
                >
                  <SkipForward className="size-5 rtl:scale-x-[-1]" />
                </button>
                <button
                  type="button"
                  onClick={() => send({ type: "cycleRepeat" })}
                  aria-label={t("player.repeat")}
                  aria-pressed={state.repeat !== "off"}
                  className={`${ghost} ${state.repeat !== "off" ? "text-primary" : ""}`}
                >
                  {state.repeat === "one" ? <Repeat1 className="size-4" /> : <Repeat className="size-4" />}
                </button>
              </>
            )}
          </div>

          {/* Right cluster */}
          <div className="flex shrink-0 items-center gap-1">
            <div className="hidden items-center gap-1.5 sm:flex">
              <button
                type="button"
                onClick={() => send({ type: "setVolume", volume: state.volume === 0 ? 1 : 0 })}
                aria-label={state.volume === 0 ? t("player.unmute") : t("player.mute")}
                className={ghost}
              >
                {state.volume === 0 ? <VolumeX className="size-4" /> : <Volume2 className="size-4" />}
              </button>
              <Slider
                aria-label={t("player.volume")}
                aria-valuetext={`${Math.round(state.volume * 100)}%`}
                className="w-20"
                min={0}
                max={1}
                step={0.02}
                value={state.volume}
                onChange={(v) => send({ type: "setVolume", volume: v })}
              />
            </div>

            {state.errorMessage ? (
              <button
                type="button"
                onClick={() => send({ type: "retry" })}
                className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-medium text-danger hover:bg-surface-2"
              >
                <RotateCw className="size-3.5" />
                {t("player.retry")}
              </button>
            ) : null}

            <button
              type="button"
              onClick={() => setSettingsOpen(true)}
              aria-label={t("player.settings")}
              className={ghost}
            >
              <Gauge className="size-4" />
            </button>
            <button
              type="button"
              onClick={() => setQueueOpen(true)}
              aria-label={t("player.queue")}
              className={ghost}
            >
              <ListMusic className="size-4" />
            </button>
            {/* Close: stop playback + clear the queue so the bar hides entirely. */}
            <button
              type="button"
              onClick={() => send({ type: "stop" })}
              aria-label={t("player.close")}
              title={t("player.close")}
              className={ghost}
            >
              <X className="size-4" />
            </button>
          </div>
        </div>

        {/* Seek — or a LIVE badge for radio streams (no seeking) */}
        {isLive ? (
          <div className="mt-1 flex items-center justify-center gap-2 py-1">
            <span className="size-2 rounded-full bg-danger" />
            <span className="text-xs font-semibold tracking-wide text-text">LIVE</span>
          </div>
        ) : (
          <div className="mt-1 flex items-center gap-2 text-2xs text-text-2">
            <span className="w-10 text-end font-mono tabular-nums">{fmt(sliderValue)}</span>
            <Slider
              aria-label={t("player.position")}
              aria-valuetext={`${fmt(sliderValue)} / ${fmt(duration)}`}
              className="flex-1"
              min={0}
              max={duration > 0 ? duration : 1}
              step={1}
              value={sliderValue}
              onChange={(v) => setScrub(v)}
              onCommit={(v) => {
                send({ type: "seek", positionSec: v });
                setScrub(null);
              }}
            />
            <span className="w-10 font-mono tabular-nums">{fmt(duration)}</span>
          </div>
        )}
      </div>

      {/* Playback settings */}
      <Sheet open={settingsOpen} onClose={() => setSettingsOpen(false)} title={t("player.settings")}>
        <p className="mb-2 text-xs font-medium text-text-2">{t("player.speed")}</p>
        <div className="flex flex-wrap gap-2">
          {PLAYBACK_RATES.map((rate) => {
            const active = rate === state.playbackRate;
            return (
              <button
                key={rate}
                type="button"
                aria-pressed={active}
                onClick={() => send({ type: "setRate", rate })}
                className={`${pill} ${active ? "border-primary bg-primary/10 text-primary" : "border-border text-text-2 hover:text-text"}`}
              >
                {rate}×
              </button>
            );
          })}
        </div>

        <p className="mb-2 mt-6 text-xs font-medium text-text-2">
          {t("player.sleep")}
          {sleepRemaining != null ? (
            <span className="ms-2 font-mono tabular-nums text-primary">{fmt(sleepRemaining)}</span>
          ) : null}
        </p>
        <div className="flex flex-wrap gap-2">
          {SLEEP_MINUTES.map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => send({ type: "setSleepTimer", option: m })}
              className={`${pill} border-border text-text-2 hover:text-text`}
            >
              {m}m
            </button>
          ))}
          <button
            type="button"
            aria-pressed={state.sleepAtTrackEnd}
            onClick={() => send({ type: "setSleepTimer", option: "end-of-track" })}
            className={`${pill} ${state.sleepAtTrackEnd ? "border-primary bg-primary/10 text-primary" : "border-border text-text-2 hover:text-text"}`}
          >
            {t("player.sleepAtEnd")}
          </button>
          <button
            type="button"
            disabled={!sleepActive}
            onClick={() => send({ type: "setSleepTimer", option: null })}
            className={`${pill} border-border text-text-2 hover:text-text disabled:opacity-40`}
          >
            {t("player.sleepOff")}
          </button>
        </div>
      </Sheet>

      {/* Queue */}
      <Sheet open={queueOpen} onClose={() => setQueueOpen(false)} title={t("player.queue")}>
        <ol className="-mx-2">
          {state.queue.map((track, index) => {
            const isCurrent = index === state.index;
            return (
              <li key={track.id}>
                <button
                  type="button"
                  onClick={() => {
                    send({ type: "goTo", index });
                    setQueueOpen(false);
                  }}
                  aria-current={isCurrent ? "true" : undefined}
                  className={`flex w-full items-center gap-3 rounded-md px-2 py-2 text-start text-sm hover:bg-surface-2 ${isCurrent ? "font-medium text-primary" : "text-text"}`}
                >
                  <span className="w-5 shrink-0 text-end font-mono text-2xs tabular-nums text-text-2">
                    {index + 1}
                  </span>
                  <span className="truncate">{track.title}</span>
                </button>
              </li>
            );
          })}
        </ol>
      </Sheet>
    </div>
  );
}
