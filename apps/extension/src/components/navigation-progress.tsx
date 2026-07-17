import { useEffect, useRef, useState } from "react";

import { subscribe } from "../lib/network-activity";

// Global top trickle bar driven by `/api/v1` network activity (see
// lib/network-activity.ts). The newtab hash router is instant, so — unlike
// web, which watches route changes — this watches in-flight `getJson` calls
// directly: that's what actually makes a home-card click feel like it did
// nothing until the destination view's data lands.
const SHOW_DELAY_MS = 150; // debounce so a cache-fast fetch never flickers the bar in
const TRICKLE_CEILING = 85; // trickle never finishes on its own — only a resolved fetch does
const TRICKLE_STEP = 5;
const TRICKLE_INTERVAL_MS = 300;
const FADE_DURATION_MS = 250;

export function NavigationProgress() {
  const [visible, setVisible] = useState(false);
  const [width, setWidth] = useState(0);
  const [fading, setFading] = useState(false);
  // Mirrors `visible` for the subscriber callback to read synchronously
  // without re-subscribing on every show/hide.
  const visibleRef = useRef(false);
  const showTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const trickleRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const fadeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const clearShowTimer = () => {
      if (showTimerRef.current) {
        clearTimeout(showTimerRef.current);
        showTimerRef.current = null;
      }
    };
    const clearTrickle = () => {
      if (trickleRef.current) {
        clearInterval(trickleRef.current);
        trickleRef.current = null;
      }
    };
    const clearFadeTimer = () => {
      if (fadeTimerRef.current) {
        clearTimeout(fadeTimerRef.current);
        fadeTimerRef.current = null;
      }
    };

    const unsubscribe = subscribe((count) => {
      if (count > 0) {
        // A new request arrived mid-fade (e.g. rapid nav clicks) — cancel the
        // fade-out and restart the show sequence instead of racing it.
        clearFadeTimer();
        setFading(false);
        clearShowTimer();
        showTimerRef.current = setTimeout(() => {
          visibleRef.current = true;
          setVisible(true);
          setWidth(15);
          clearTrickle();
          trickleRef.current = setInterval(() => {
            setWidth((w) => Math.min(w + TRICKLE_STEP, TRICKLE_CEILING));
          }, TRICKLE_INTERVAL_MS);
        }, SHOW_DELAY_MS);
        return;
      }

      clearShowTimer();
      clearTrickle();
      // Only run the finish/fade sequence if the bar actually made it on
      // screen — a fetch that resolves inside the show-delay window never
      // rendered anything, so there's nothing to complete.
      if (!visibleRef.current) return;
      setWidth(100);
      setFading(true);
      fadeTimerRef.current = setTimeout(() => {
        visibleRef.current = false;
        setVisible(false);
        setWidth(0);
        setFading(false);
      }, FADE_DURATION_MS);
    });

    return () => {
      unsubscribe();
      clearShowTimer();
      clearTrickle();
      clearFadeTimer();
    };
  }, []);

  if (!visible) return null;

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-x-0 top-0 z-[60] h-0.5 overflow-hidden"
    >
      <div
        className={`h-full bg-primary transition-[width,opacity] duration-300 ease-out ${
          fading ? "opacity-0" : "opacity-100"
        }`}
        style={{ width: `${width}%` }}
      />
    </div>
  );
}
