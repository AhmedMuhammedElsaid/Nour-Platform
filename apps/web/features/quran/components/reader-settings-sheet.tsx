"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter, usePathname } from "@/i18n/navigation";
import { useSearchParams } from "next/navigation";
import type { QuranEdition, QuranReciter } from "@repo/api/schemas/quran";
import { BISMILLAH_UTHMANI } from "@repo/shared-core/quran/basmala";
import { cn } from "@repo/ui/lib/utils";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "@repo/ui/primitives/sheet";
import { savePrefs, type QuranPrefs, type ReaderLayout } from "../lib/quran-prefs";

const FONT_MIN = 0.8;
const FONT_MAX = 1.6;
const FONT_STEP = 0.1;

// Purely presentational base for the live preview's Arabic size — demonstrates
// relative scaling as fontScale moves, not a prediction of the reader's own
// on-page size (mirrors the mobile sheet's PREVIEW_BASE_SIZE rationale).
const PREVIEW_BASE_SIZE = 28;

export interface ReaderSettingsSheetProps {
  prefs: QuranPrefs;
  onChange: (next: QuranPrefs) => void;
  editions: QuranEdition[];
  reciters: QuranReciter[];
}

function Selectable({
  label,
  selected,
  onClick,
}: {
  label: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={cn(
        "rounded-full border px-3 py-1.5 text-sm",
        selected ? "border-primary bg-primary/10 text-primary" : "border-border text-text-2",
      )}
    >
      {label}
    </button>
  );
}

// The "grouped cards" concept ported from mobile's redesign (`4f60f8c`) — one
// card per related cluster of settings instead of one flat scroll.
function SettingsCard({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="bg-surface-2 flex flex-col gap-2 rounded-lg p-3">
      <span className="text-text-2 text-xs uppercase tracking-wide">{label}</span>
      {children}
    </div>
  );
}

// Port of apps/mobile/features/quran/components/reader-settings-sheet.tsx.
// Changes are staged in a local draft and only applied on Save — Cancel
// discards them. This matters because translation/reciter slugs drive the
// reader's query key (server refetch), so applying every keystroke would
// refetch repeatedly; staging defers the navigation to one Save. The live
// preview below reads the DRAFT, not the committed prefs, so it can restyle
// as the user adjusts settings without triggering that refetch.
export function ReaderSettingsSheet({
  prefs,
  onChange,
  editions,
  reciters,
}: ReaderSettingsSheetProps) {
  const t = useTranslations("quran");
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Draft seeded from the committed prefs each time the sheet opens.
  const [draft, setDraft] = useState<QuranPrefs>(prefs);
  useEffect(() => {
    if (open) setDraft(prefs);
  }, [open, prefs]);

  const update = (patch: Partial<QuranPrefs>) => setDraft((d) => ({ ...d, ...patch }));

  const setFont = (delta: number) => {
    const next = Math.min(FONT_MAX, Math.max(FONT_MIN, Math.round((draft.fontScale + delta) * 10) / 10));
    update({ fontScale: next });
  };

  const save = () => {
    savePrefs(draft);
    onChange(draft);
    if (draft.translationSlug !== prefs.translationSlug || draft.reciterSlug !== prefs.reciterSlug) {
      const params = new URLSearchParams(searchParams.toString());
      params.set("translation", draft.translationSlug);
      params.set("reciter", draft.reciterSlug);
      router.push(`${pathname}?${params.toString()}`);
    }
    setOpen(false);
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <button
        type="button"
        aria-label={t("settings")}
        onClick={() => setOpen(true)}
        // min-h-11 (44px) hit area; the gear icon stays size-4.
        className="border-border text-text-2 hover:text-primary inline-flex min-h-11 items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm"
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
        {t("settings")}
      </button>

      <SheetContent side="bottom" aria-label={t("settings")} className="max-h-[85vh] overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{t("settings")}</SheetTitle>
          <SheetDescription className="sr-only">{t("settings")}</SheetDescription>
        </SheetHeader>

        {/* Live preview — reads `draft`, so it restyles on every change and
            reverts for free if the user backs out with Cancel. */}
        <div className="border-border bg-bg flex flex-col items-center gap-2 rounded-lg border px-4 py-4">
          <p
            dir="rtl"
            className="font-quran text-text text-center leading-relaxed"
            style={{ fontSize: PREVIEW_BASE_SIZE * draft.fontScale }}
          >
            {BISMILLAH_UTHMANI}
          </p>
          {draft.showTranslation ? (
            <p className="text-text-2 text-center text-xs">{t("settingsPreviewTranslation")}</p>
          ) : null}
        </div>

        <div className="flex flex-col gap-3 py-2">
          <SettingsCard label={t("display")}>
            <label className="flex items-center justify-between">
              <span>{t("showTranslation")}</span>
              <input
                type="checkbox"
                aria-label={t("showTranslation")}
                checked={draft.showTranslation}
                onChange={(e) => update({ showTranslation: e.target.checked })}
              />
            </label>
            <label className="flex items-center justify-between">
              <span>{t("wordByWord")}</span>
              <input
                type="checkbox"
                aria-label={t("wordByWord")}
                checked={draft.showWordByWord}
                onChange={(e) => update({ showWordByWord: e.target.checked })}
              />
            </label>
            <div className="flex items-center justify-between gap-3">
              <span>{t("fontSize")}</span>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  aria-label={t("fontSmaller")}
                  onClick={() => setFont(-FONT_STEP)}
                  className="border-border size-8 rounded-full border text-lg"
                >
                  −
                </button>
                <span className="w-10 text-center text-sm tabular-nums">
                  {Math.round(draft.fontScale * 100)}%
                </span>
                <button
                  type="button"
                  aria-label={t("fontLarger")}
                  onClick={() => setFont(FONT_STEP)}
                  className="border-border size-8 rounded-full border text-lg"
                >
                  ＋
                </button>
              </div>
            </div>
          </SettingsCard>

          <SettingsCard label={t("layout")}>
            <div className="flex flex-wrap gap-2">
              {(["list", "mushaf"] as ReaderLayout[]).map((option) => (
                <Selectable
                  key={option}
                  label={option === "list" ? t("layoutList") : t("layoutMushaf")}
                  selected={draft.layout === option}
                  onClick={() => update({ layout: option })}
                />
              ))}
            </div>
          </SettingsCard>

          {editions.length > 0 ? (
            <SettingsCard label={t("translation")}>
              <div className="flex flex-wrap gap-2">
                {editions.map((ed) => (
                  <Selectable
                    key={ed.slug}
                    label={ed.name}
                    selected={draft.translationSlug === ed.slug}
                    onClick={() => update({ translationSlug: ed.slug })}
                  />
                ))}
              </div>
            </SettingsCard>
          ) : null}

          {reciters.length > 0 ? (
            <SettingsCard label={t("reciter")}>
              <div className="flex flex-wrap gap-2">
                {reciters.map((r) => (
                  <Selectable
                    key={r.slug}
                    label={r.name}
                    selected={draft.reciterSlug === r.slug}
                    onClick={() => update({ reciterSlug: r.slug })}
                  />
                ))}
              </div>
            </SettingsCard>
          ) : null}
        </div>

        <SheetFooter className="mt-0 flex-row gap-3">
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="border-border flex-1 rounded-md border px-4 py-2 text-sm"
          >
            {t("cancel")}
          </button>
          <button
            type="button"
            onClick={save}
            className="bg-primary text-bg flex-1 rounded-md px-4 py-2 text-sm font-medium"
          >
            {t("save")}
          </button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
