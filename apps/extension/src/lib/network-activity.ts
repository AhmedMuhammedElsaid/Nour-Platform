// Tiny in-flight request counter for the newtab nav-progress bar. The
// hash-router itself is instant — the perceived delay on a home-card click is
// the `/api/v1` fetch(es) the destination view kicks off, so this counts
// those instead of watching route changes (web's mechanism, which doesn't
// apply here). Pure module state, no browser APIs — safe to import from the
// service worker too, where a subscriber just never attaches.

type Listener = (count: number) => void;

let inflightCount = 0;
const listeners = new Set<Listener>();

function notify(): void {
  for (const listener of listeners) listener(inflightCount);
}

// Call before starting a request; pair with a matching endRequest() in a
// `finally` so the count can never leak on a thrown/rejected fetch.
export function beginRequest(): void {
  inflightCount += 1;
  notify();
}

// Floors at 0 — a stray extra endRequest() (e.g. a bug in a caller) must
// never send the counter negative and wedge the bar in a "still loading" state.
export function endRequest(): void {
  inflightCount = Math.max(0, inflightCount - 1);
  notify();
}

export function getInflightCount(): number {
  return inflightCount;
}

// Registers a listener, called immediately with the current count and again
// on every change. Returns an unsubscribe function.
export function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  listener(inflightCount);
  return () => {
    listeners.delete(listener);
  };
}
