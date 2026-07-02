"use client";

import { useEffect, useState } from "react";

// Best-effort "now playing" ticker for the currently-streaming station. Polls the
// same-origin server route (which does the ICY parsing) every ~25s while a station
// plays. Returns the track title, or null when unavailable — the UI then shows
// nothing extra and the station name / LIVE badge stand alone. Deliberately plain
// fetch + interval: the web app is RSC-first and mounts no TanStack Query provider,
// and a live ticker is exactly the case polling suits.
const POLL_MS = 25_000;

export function useNowPlaying(slug: string | null, enabled: boolean): string | null {
  const [title, setTitle] = useState<string | null>(null);

  useEffect(() => {
    if (!slug || !enabled) {
      setTitle(null);
      return;
    }
    let active = true;
    const load = async (): Promise<void> => {
      try {
        const res = await fetch(`/api/v1/radio/${encodeURIComponent(slug)}/now-playing`);
        if (!res.ok) return;
        const data = (await res.json()) as { title: string | null };
        if (active) setTitle(data.title ?? null);
      } catch {
        /* best-effort — leave the last known title */
      }
    };
    void load();
    const id = window.setInterval(() => void load(), POLL_MS);
    return () => {
      active = false;
      window.clearInterval(id);
    };
  }, [slug, enabled]);

  return title;
}
