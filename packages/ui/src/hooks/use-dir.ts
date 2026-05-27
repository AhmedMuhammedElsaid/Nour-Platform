"use client";

import { useEffect, useState } from "react";

/**
 * Returns the current text direction by reading the `dir` attribute on
 * `<html>`. Starts SSR-safe with "ltr" and syncs after hydration.
 * Server components should set `dir` directly; this hook is for client
 * islands (e.g. the audio player) that need to branch on direction.
 */
export function useDir(): "rtl" | "ltr" {
  const [dir, setDir] = useState<"rtl" | "ltr">("ltr");

  useEffect(() => {
    const root = document.documentElement;
    const read = () => setDir(root.dir === "rtl" ? "rtl" : "ltr");
    read();
    const obs = new MutationObserver(read);
    obs.observe(root, { attributes: true, attributeFilter: ["dir"] });
    return () => obs.disconnect();
  }, []);

  return dir;
}
