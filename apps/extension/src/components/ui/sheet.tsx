import { useEffect, type ReactNode } from "react";
import { createPortal } from "react-dom";

import { useI18n } from "../../lib/i18n";
import { X } from "./icons";

// Controlled slide-in panel (no Radix). Full-screen backdrop + a panel anchored
// to one side. The new-tab is RTL, so the player opens its sheets from the left
// (matching the web). Closes on backdrop click or Escape.

type SheetProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  side?: "left" | "right";
  children: ReactNode;
};

export function Sheet({ open, onClose, title, side = "left", children }: SheetProps) {
  const { t } = useI18n();
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const anchor = side === "left" ? "left-0 border-e" : "right-0 border-s";

  // Portal to <body> so the fixed-position overlay is sized against the viewport.
  // Rendering inline would anchor it to the player bar, whose `backdrop-blur`
  // creates a containing block for fixed descendants (clipping the sheet).
  return createPortal(
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label={title}>
      <button
        type="button"
        aria-label={t("ui.close")}
        onClick={onClose}
        className="absolute inset-0 bg-black/50"
      />
      <div
        className={`absolute inset-y-0 ${anchor} flex w-80 max-w-[85vw] flex-col border-border bg-surface shadow-xl`}
      >
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <h2 className="text-sm font-semibold text-text">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label={t("ui.close")}
            className="rounded p-1 text-text-2 hover:bg-surface-2 hover:text-text"
          >
            <X className="size-4" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-4">{children}</div>
      </div>
    </div>,
    document.body,
  );
}
