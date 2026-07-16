"use client";

import { useEffect } from "react";

// A pinned/long-open tab never navigates, so nothing reloads it: the browser's
// ~24h sw.js re-check rarely runs, and — crucially — a bundle-only deploy does
// NOT change sw.js, so reg.update() installs no new worker and never fires
// controllerchange. The tab keeps running whatever JS it loaded, for days.
// That is exactly how the prayer-times adhan misfires: the scheduler fix ships
// in a bundle the stale tab never loads. So, independently of the SW, we poll
// the deployed build id and hard-reload a tab that has fallen behind. Throttled
// so a busy tab doesn't poll /api/health on every focus.
const UPDATE_CHECK_INTERVAL_MS = 30 * 60 * 1000; // 30 min
const RELOADED_FOR_KEY = "nour.build.reloadedFor";

// Compare the build that rendered THIS page (stamped on <html data-build> by
// app/[locale]/layout.tsx) against the currently-deployed build (/api/health).
// A mismatch means a newer build is live while this tab runs old JS → reload.
// This does NOT depend on sw.js changing, so it catches bundle-only deploys.
async function reloadIfStale(): Promise<void> {
  const running = document.documentElement.dataset.build;
  // Unknown/"dev" (an older build without the stamp, or local dev) → never
  // reload: without a known running build there's nothing safe to compare.
  if (!running || running === "dev") return;
  let deployed: string | undefined;
  try {
    const res = await fetch("/api/health", { cache: "no-store" });
    if (!res.ok) return;
    deployed = ((await res.json()) as { version?: string }).version;
  } catch {
    return; // offline / transient — retry on the next visibility tick
  }
  if (!deployed || deployed === "dev" || deployed === running) return;
  // Guard a reload loop in the rare case the fresh HTML hasn't reached this tab
  // yet (CDN/SW lag): reload at most once per target build.
  try {
    if (sessionStorage.getItem(RELOADED_FOR_KEY) === deployed) return;
    sessionStorage.setItem(RELOADED_FOR_KEY, deployed);
  } catch {
    /* storage blocked — a rare double reload beats never updating */
  }
  window.location.reload();
}

// Registers the service worker in production only (dev uses Turbopack HMR +
// the relaxed 'unsafe-eval' CSP branch, which a SW would interfere with).
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;

    // Run the build-version self-heal immediately (a tab focused right now
    // shouldn't wait for the next visibility toggle to shed stale JS) and on
    // each visibility gain thereafter, throttled. Independent of the SW API.
    void reloadIfStale();
    let lastCheckedAt = Date.now();
    const onVisibilityChange = () => {
      if (document.visibilityState !== "visible") return;
      const now = Date.now();
      if (now - lastCheckedAt < UPDATE_CHECK_INTERVAL_MS) return;
      lastCheckedAt = now;
      void reloadIfStale();
    };
    document.addEventListener("visibilitychange", onVisibilityChange);

    const hasSW =
      typeof navigator !== "undefined" && "serviceWorker" in navigator;
    if (!hasSW) {
      return () =>
        document.removeEventListener("visibilitychange", onVisibilityChange);
    }

    // When a new SW takes control (it calls skipWaiting + clients.claim),
    // reload once so the open app picks up fresh code/content. Guarded so the
    // first-ever install (no prior controller) and re-entrancy don't loop.
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

    const register = (): void => {
      void navigator.serviceWorker
        .register("/sw.js")
        .then((reg) => {
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
