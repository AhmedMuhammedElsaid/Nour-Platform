"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, usePathname } from "@/i18n/navigation";
import { useSearchParams } from "next/navigation";
import type { QuranEdition, QuranReciter } from "@repo/api/schemas/quran";
import { savePrefs, type QuranPrefs } from "../lib/quran-prefs";

export interface ReaderSettingsSheetProps {
  prefs: QuranPrefs;
  onChange: (next: QuranPrefs) => void;
  editions: QuranEdition[];
  reciters: QuranReciter[];
}

/*
 * Reading settings. Translation/word-by-word/font-size are pure client state
 * (no refetch). Changing the translation or reciter edition requires the server
 * to re-resolve the surah, so those navigate with ?translation= / ?reciter=
 * query params which the reader page reads.
 */
export function ReaderSettingsSheet({
  prefs,
  onChange,
  editions,
  reciters,
}: ReaderSettingsSheetProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Close the dropdown on outside-click or Escape (it's a hand-rolled popover).
  useEffect(() => {
    if (!open) return;
    const onPointer = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const update = (patch: Partial<QuranPrefs>) => {
    const next = { ...prefs, ...patch };
    savePrefs(next);
    onChange(next);
  };

  const navigateWithParam = (key: string, value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set(key, value);
    router.push(`${pathname}?${params.toString()}`);
  };

  return (
    <div className="relative" ref={rootRef}>
      <button
        type="button"
        aria-label="Reading settings"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="border-border text-text-2 hover:text-primary rounded-md border px-3 py-1.5 text-sm"
      >
        ⚙ Settings
      </button>

      {open ? (
        <div className="border-border bg-bg-2 absolute end-0 z-10 mt-2 w-72 max-w-[calc(100vw-2rem)] space-y-4 rounded-lg border p-4 shadow-up-3">
          <label className="flex items-center justify-between">
            <span>Show translation</span>
            <input
              type="checkbox"
              aria-label="Show translation"
              checked={prefs.showTranslation}
              onChange={(e) => update({ showTranslation: e.target.checked })}
            />
          </label>

          <label className="flex items-center justify-between">
            <span>Word-by-word</span>
            <input
              type="checkbox"
              aria-label="Word-by-word"
              checked={prefs.showWordByWord}
              onChange={(e) => update({ showWordByWord: e.target.checked })}
            />
          </label>

          <label className="flex items-center justify-between gap-3">
            <span>Font size</span>
            <input
              type="range"
              min={0.8}
              max={1.6}
              step={0.1}
              aria-label="Font size"
              value={prefs.fontScale}
              onChange={(e) => update({ fontScale: Number(e.target.value) })}
            />
          </label>

          {editions.length > 0 ? (
            <label className="flex items-center justify-between gap-3">
              <span>Translation</span>
              <select
                aria-label="Translation edition"
                value={prefs.translationSlug}
                onChange={(e) => {
                  update({ translationSlug: e.target.value });
                  navigateWithParam("translation", e.target.value);
                }}
              >
                {editions.map((ed) => (
                  <option key={ed.slug} value={ed.slug}>
                    {ed.name}
                  </option>
                ))}
              </select>
            </label>
          ) : null}

          {reciters.length > 0 ? (
            <label className="flex items-center justify-between gap-3">
              <span>Reciter</span>
              <select
                aria-label="Reciter"
                value={prefs.reciterSlug}
                onChange={(e) => {
                  update({ reciterSlug: e.target.value });
                  navigateWithParam("reciter", e.target.value);
                }}
              >
                {reciters.map((r) => (
                  <option key={r.slug} value={r.slug}>
                    {r.name}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
