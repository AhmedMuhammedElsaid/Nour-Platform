"use client";

// Reserves layout space for the fixed audio player bar so it stops covering
// the footer / last list row while a track is queued (Phase 1.3). The bar
// itself (packages/ui/.../audio-player.tsx) measures its own real rendered
// height via ResizeObserver — mobile ~101px wrapped vs desktop 72px, both
// already inclusive of the bottom safe-area inset — and writes it to the
// `--player-height` custom property on <html>. This spacer just consumes
// that property as a normal-flow block, so it participates in document
// height like any other element: 0px (no clearance) when idle, growing when
// a queue loads, shrinking back on close — no bar-specific logic lives here,
// so any future change to the bar's height stays a single source of truth.
export function PlayerClearanceSpacer() {
  return (
    <div
      aria-hidden="true"
      style={{ height: "var(--player-height, 0px)" }}
      className="transition-[height] duration-[var(--motion-base)] ease-[var(--ease-standard)]"
    />
  );
}
