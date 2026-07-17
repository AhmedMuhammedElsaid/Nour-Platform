"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";

// Client islands that navigate imperatively (router.push instead of an <a>,
// e.g. the home ReadersShelf) fire this so the bar still starts on their tap.
export const NAV_START_EVENT = "nour:nav-start";

export function startNavigationProgress(): void {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(NAV_START_EVENT));
  }
}

const TRICKLE_INTERVAL_MS = 250;
const DONE_FADE_MS = 400;
// Navigation may never land (same-URL click the router ignores) — auto-finish.
const SAFETY_MS = 8000;

function NavigationProgressInner() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const search = searchParams.toString();
  const [progress, setProgress] = useState<number | null>(null);
  const activeRef = useRef(false);
  const timersRef = useRef<{
    trickle?: ReturnType<typeof setInterval>;
    done?: ReturnType<typeof setTimeout>;
    safety?: ReturnType<typeof setTimeout>;
  }>({});

  useEffect(() => {
    const timers = timersRef.current;

    const clearTimers = () => {
      if (timers.trickle) clearInterval(timers.trickle);
      if (timers.done) clearTimeout(timers.done);
      if (timers.safety) clearTimeout(timers.safety);
      timers.trickle = timers.done = timers.safety = undefined;
    };

    const finish = () => {
      if (!activeRef.current) return;
      activeRef.current = false;
      clearTimers();
      setProgress(100);
      timers.done = setTimeout(() => setProgress(null), DONE_FADE_MS);
    };

    const start = () => {
      if (activeRef.current) return;
      activeRef.current = true;
      clearTimers();
      setProgress(15);
      timers.trickle = setInterval(() => {
        // Ease toward 90% and wait there for the route to land.
        setProgress((p) => (p === null ? p : Math.min(p + (90 - p) * 0.12, 90)));
      }, TRICKLE_INTERVAL_MS);
      timers.safety = setTimeout(finish, SAFETY_MS);
    };

    const onClick = (event: MouseEvent) => {
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      ) {
        return;
      }
      const anchor =
        event.target instanceof Element ? event.target.closest("a[href]") : null;
      if (!(anchor instanceof HTMLAnchorElement)) return;
      if ((anchor.target && anchor.target !== "_self") || anchor.hasAttribute("download")) {
        return;
      }
      const url = new URL(anchor.href, window.location.href);
      if (url.origin !== window.location.origin) return;
      // Hash-only / same-URL clicks don't trigger a route transition.
      if (
        url.pathname === window.location.pathname &&
        url.search === window.location.search
      ) {
        return;
      }
      start();
    };

    // Capture phase: runs before Next's Link handler calls preventDefault.
    document.addEventListener("click", onClick, true);
    window.addEventListener(NAV_START_EVENT, start);
    return () => {
      document.removeEventListener("click", onClick, true);
      window.removeEventListener(NAV_START_EVENT, start);
      clearTimers();
    };
  }, []);

  // Route landed (pathname or search params changed) → complete the bar.
  useEffect(() => {
    if (!activeRef.current) return;
    activeRef.current = false;
    const timers = timersRef.current;
    if (timers.trickle) clearInterval(timers.trickle);
    if (timers.safety) clearTimeout(timers.safety);
    timers.trickle = timers.safety = undefined;
    setProgress(100);
    timers.done = setTimeout(() => setProgress(null), DONE_FADE_MS);
  }, [pathname, search]);

  if (progress === null) return null;

  return (
    <div
      aria-hidden="true"
      data-testid="nav-progress"
      className="pointer-events-none fixed inset-x-0 top-0 z-50"
    >
      <div
        className="h-0.5 bg-primary transition-[width,opacity] duration-300 ease-out"
        style={{ width: `${progress}%`, opacity: progress >= 100 ? 0 : 1 }}
      />
    </div>
  );
}

// useSearchParams requires a Suspense boundary; wrap here so the layout edit
// stays a single line.
export function NavigationProgress() {
  return (
    <Suspense fallback={null}>
      <NavigationProgressInner />
    </Suspense>
  );
}
