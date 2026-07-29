"use client";

import { useEffect, useState } from "react";

/**
 * Seconds-ticking clock that is safe to render during hydration.
 *
 * The prayer widget and the prayer page are client components that still get
 * server-rendered, so seeding their clock with `Date.now()` produced one value
 * in the SSR pass and a different one (~1s later) at hydration. React reported
 * that as a text mismatch on the countdown ("٧:٢٧:٣٢" vs "٧:٢٧:٣٣", minified
 * error #418) plus an attribute mismatch on the sun's `transform`, and threw
 * the whole server-rendered subtree away to re-render it on the client.
 *
 * Seeding from a timestamp the *server* captured and passed down as a prop
 * makes the first client render byte-identical to the SSR output; the effect
 * then jumps straight to the real clock, so the visible staleness is one frame
 * rather than one tick.
 */
export function useLiveNow(serverNow: number): number {
  const [now, setNow] = useState<number>(serverNow);

  useEffect(() => {
    // Correct immediately after hydration instead of waiting for the first
    // interval tick — `serverNow` is already up to a request-time old.
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 1_000);
    return () => clearInterval(id);
  }, []);

  return now;
}
