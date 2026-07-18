"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter, usePathname } from "@/i18n/navigation";
import { useSearchParams } from "next/navigation";
import type { QuranEdition, QuranReciter } from "@repo/api/schemas/quran";
import { savePrefs, type QuranPrefs, type ReaderLayout } from "../lib/quran-prefs";

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
  const t = useTranslations("quran");
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
        className="border-border text-text-2 hover:text-primary inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm"
      >
        <svg
          viewBox="0 0 24 24"
          className="size-4"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
        </svg>
        Settings
      </button>

      {open ? (
        <div className="border-border bg-surface-2 absolute end-0 z-10 mt-2 w-72 max-w-[calc(100vw-2rem)] space-y-4 rounded-lg border p-4 shadow-3">
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

          <div className="flex items-center justify-between gap-3">
            <span>{t("layout")}</span>
            <div className="flex items-center gap-1.5" role="group" aria-label={t("layout")}>
              {(["list", "mushaf"] as ReaderLayout[]).map((option) => (
                <button
                  key={option}
                  type="button"
                  aria-pressed={prefs.layout === option}
                  onClick={() => update({ layout: option })}
                  className={`rounded-full border px-3 py-1 text-sm ${
                    prefs.layout === option
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border text-text-2"
                  }`}
                >
                  {option === "list" ? t("layoutList") : t("layoutMushaf")}
                </button>
              ))}
            </div>
          </div>

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
