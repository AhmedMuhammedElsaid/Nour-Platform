"use client";

import { useEffect } from "react";

// A tab that's pinned/left open for days never navigates, so the browser's
// own "re-check /sw.js roughly every 24h" heuristic barely runs — the tab
// can keep executing a stale JS bundle indefinitely (this is how prayer
// times drift/misfire on long-lived tabs). Throttle window for the
// visibility-driven update() nudge below.
const UPDATE_CHECK_INTERVAL_MS = 60 * 60 * 1000;

// Registers the service worker in production only (dev uses Turbopack HMR +
// the relaxed 'unsafe-eval' CSP branch, which a SW would interfere with).
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) {
      return;
    }
    // When a new SW takes control (it calls skipWaiting + clients.claim),
    // reload once so the open app picks up fresh code/content instead of
    // running against the previous generation. Guarded so the first-ever
    // install (no prior controller) and re-entrancy don't cause a reload loop.
    let refreshing = false;
    const hadController = Boolean(navigator.serviceWorker.controller);
    const onControllerChange = () => {
      if (refreshing || !hadController) return;
      refreshing = true;
      window.location.reload();
    };
    navigator.serviceWorker.addEventListener(
      "controllerchange",
      onControllerChange,
    );

    // Reused by the visibility check below so it doesn't re-register — only
    // asks the existing registration to look for a newer SW.
    let registration: ServiceWorkerRegistration | undefined;
    // Seeded at registration time (register() already does one update()
    // check), so a tab that just loaded doesn't immediately re-check again
    // on its first focus.
    let lastCheckedAt = Date.now();

    const onVisibilityChange = () => {
      if (document.visibilityState !== "visible" || !registration) return;
      const now = Date.now();
      if (now - lastCheckedAt < UPDATE_CHECK_INTERVAL_MS) return;
      lastCheckedAt = now;
      void registration.update().catch(() => {});
    };
    document.addEventListener("visibilitychange", onVisibilityChange);

    const register = (): void => {
      void navigator.serviceWorker
        .register("/sw.js")
        .then((reg) => {
          registration = reg;
          lastCheckedAt = Date.now();
          // Proactively check for a newer SW on each load.
          void reg.update().catch(() => {});
        })
        .catch(() => {
          /* registration failure is non-fatal — app still works online */
        });
    };
    if (document.readyState === "complete") register();
    else window.addEventListener("load", register, { once: true });

    return () => {
      document.removeEventListener("visibilitychange", onVisibilityChange);
      navigator.serviceWorker.removeEventListener(
        "controllerchange",
        onControllerChange,
      );
    };
  }, []);

  return null;
}
