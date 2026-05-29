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
    const register = (): void => {
      void navigator.serviceWorker.register("/sw.js").catch(() => {
        /* registration failure is non-fatal — app still works online */
      });
    };
    if (document.readyState === "complete") register();
    else window.addEventListener("load", register, { once: true });
  }, []);

  return null;
}
