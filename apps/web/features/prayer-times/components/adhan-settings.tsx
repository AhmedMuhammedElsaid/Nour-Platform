"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";

import { ADHAN_PRAYER_KEYS } from "@repo/api/schemas/prayer-times";

import { useAdhanSettings } from "../hooks/use-adhan-settings";
import { requestAdhanPermission } from "../lib/adhan-notifications";

export function AdhanSettings() {
  const t = useTranslations("prayer");
  const { settings, hydrated, setEnabled, setPrayer, setVolume } = useAdhanSettings();
  const [canBackground, setCanBackground] = useState(false);

  useEffect(() => {
    setCanBackground(
      typeof window !== "undefined" &&
        "Notification" in window &&
        "showTrigger" in Notification.prototype,
    );
  }, []);

  if (!hydrated) return null;

  return (
    <div className="space-y-4">
      <label className="flex items-center justify-between gap-3">
        <span className="text-sm text-text">{t("adhan.enable")}</span>
        <input
          type="checkbox"
          checked={settings.enabled}
          onChange={(e) => setEnabled(e.target.checked)}
          aria-label={t("adhan.enable")}
          className="size-4 accent-[var(--color-primary)]"
        />
      </label>

      {settings.enabled ? (
        <>
          <p className="text-xs text-text-2">{t("adhan.autoplayHint")}</p>

          <fieldset className="space-y-2">
            <legend className="mb-1 text-xs uppercase tracking-[0.06em] text-text-2">
              {t("adhan.perPrayer")}
            </legend>
            {ADHAN_PRAYER_KEYS.map((key) => (
              <label key={key} className="flex items-center justify-between gap-3">
                <span className="text-sm text-text">{t(key)}</span>
                <input
                  type="checkbox"
                  checked={settings.perPrayer[key]}
                  onChange={(e) => setPrayer(key, e.target.checked)}
                  aria-label={t(key)}
                  className="size-4 accent-[var(--color-primary)]"
                />
              </label>
            ))}
          </fieldset>

          <label className="block">
            <span className="mb-1.5 block text-xs uppercase tracking-[0.06em] text-text-2">
              {t("adhan.volume")}
            </span>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={settings.volume}
              onChange={(e) => setVolume(Number(e.target.value))}
              aria-label={t("adhan.volume")}
              className="w-full accent-[var(--color-primary)]"
            />
          </label>

          {canBackground ? (
            <button
              type="button"
              onClick={() => void requestAdhanPermission()}
              className="w-full rounded-md border border-border bg-surface-2 px-3 py-2.5 text-sm text-text hover:bg-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {t("adhan.background")}
            </button>
          ) : (
            <p className="text-xs text-text-2">{t("adhan.backgroundUnsupported")}</p>
          )}
        </>
      ) : null}
    </div>
  );
}
