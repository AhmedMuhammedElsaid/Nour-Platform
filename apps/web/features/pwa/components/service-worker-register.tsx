"use client";

import { useEffect } from "react";

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
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (refreshing || !hadController) return;
      refreshing = true;
      window.location.reload();
    });

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
  }, []);

  return null;
}
