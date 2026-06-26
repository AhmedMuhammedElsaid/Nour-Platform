import { currentItem, type PlayerCommand, type PlayerState } from "../lib/player-state";

function fmt(sec: number): string {
  if (!Number.isFinite(sec) || sec < 0) return "0:00";
  const s = Math.floor(sec);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

// Fixed now-playing bar shared by the new-tab and popup pages. Renders nothing
// when there's no current track. The seek slider is bound to the broadcast
// position — dragging is slightly jumpy under the 250ms broadcast throttle, but
// commits correctly on release.
export function PlayerBar({
  state,
  send,
}: {
  state: PlayerState | null;
  send: (command: PlayerCommand) => void;
}) {
  if (!state) return null;
  const item = currentItem(state);
  if (!item) return null;

  const playing = state.status === "playing";

  return (
    <div
      className="fixed inset-x-0 bottom-0 border-t border-border bg-surface/95 px-4 py-3 backdrop-blur"
      dir="rtl"
    >
      <div className="mx-auto flex max-w-2xl items-center gap-3">
        {/* Track info */}
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-text">{item.title}</p>
          {item.artist ? (
            <p className="truncate text-xs text-text-2">{item.artist}</p>
          ) : null}
        </div>

        {/* Transport */}
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => send({ type: "prev" })}
            className="rounded p-1.5 text-text-2 hover:bg-surface-2 hover:text-text"
            aria-label="السابق"
          >
            ⏮
          </button>
          <button
            type="button"
            onClick={() => send({ type: "toggle" })}
            className="rounded-full bg-primary p-2 text-primary-fg hover:opacity-90"
            aria-label={playing ? "إيقاف مؤقت" : "تشغيل"}
          >
            {playing ? "⏸" : "▶"}
          </button>
          <button
            type="button"
            onClick={() => send({ type: "next" })}
            className="rounded p-1.5 text-text-2 hover:bg-surface-2 hover:text-text"
            aria-label="التالي"
          >
            ⏭
          </button>
        </div>
      </div>

      {/* Seek */}
      <div className="mx-auto mt-2 flex max-w-2xl items-center gap-2 text-2xs text-text-2">
        <span className="font-mono">{fmt(state.positionSec)}</span>
        <input
          type="range"
          min={0}
          max={state.durationSec || 0}
          step={1}
          value={Math.min(state.positionSec, state.durationSec || 0)}
          onChange={(e) => send({ type: "seek", positionSec: Number(e.target.value) })}
          className="h-1 flex-1 accent-[var(--color-primary)]"
          aria-label="الموضع"
        />
        <span className="font-mono">{fmt(state.durationSec)}</span>
      </div>
    </div>
  );
}
