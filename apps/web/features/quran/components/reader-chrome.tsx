"use client";

import { useEffect, useState, type ReactNode } from "react";
import { loadPrefs, type ReaderLayout } from "../lib/quran-prefs";

export interface ReaderChromeProps {
  /** The page's `<h1>`. Always rendered — visually in list mode, sr-only in Mushaf. */
  heading: ReactNode;
  /** Surah meaning / ayah count / Bismillah. Dropped entirely in Mushaf mode. */
  details: ReactNode;
}

// Surah-page header chrome, gated on the reader layout.
//
// In LIST mode this is the page's own header and the only place the surah is
// named. In MUSHAF mode `MushafPageView` already renders a per-segment banner
// AND that segment's Bismillah, so keeping the chrome visible printed the surah
// name twice and the Bismillah twice (the owner's original report). It is also
// actively misleading there: a mushaf page can open on the tail of the PREVIOUS
// surah, so the chrome would caption the screen with a surah you aren't reading.
//
// The `<h1>` survives as `sr-only` rather than being removed: the layout pref
// lives in localStorage, so the server always renders the default (mushaf), and
// returning null would drop the only `<h1>` from the server HTML. Keeping it
// also means the page has exactly one heading in Mushaf mode, where the segment
// banner is a plain `<p>`. The details block carries no heading, so it is simply
// not rendered — that avoids reading the Bismillah twice to a screen reader.
//
// Mirrors `Reader`'s own hydration pattern: seed from `loadPrefs()` (which is
// SSR-safe and returns DEFAULT_PREFS on the server), then re-read on mount.
export function ReaderChrome({ heading, details }: ReaderChromeProps) {
  const [layout, setLayout] = useState<ReaderLayout>(() => loadPrefs().layout);

  useEffect(() => {
    setLayout(loadPrefs().layout);
  }, []);

  if (layout === "mushaf") {
    return <header className="sr-only">{heading}</header>;
  }

  return (
    <header className="border-border mb-4 border-b pb-4 text-center">
      {heading}
      {details}
    </header>
  );
}
