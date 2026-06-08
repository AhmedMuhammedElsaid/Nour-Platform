"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";

import { useAzkarReminderSettings } from "../hooks/use-azkar-reminder-settings";
import { requestAdhanPermission } from "../lib/adhan-notifications";

export function AzkarReminderSettings() {
  const t = useTranslations("prayer");
  const { settings, hydrated, setEnabled } = useAzkarReminderSettings();
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
        <span className="text-sm text-text">{t("azkar.enable")}</span>
        <input
          type="checkbox"
          checked={settings.enabled}
          onChange={(e) => {
            const on = e.target.checked;
            setEnabled(on);
            if (on) void requestAdhanPermission();
          }}
          aria-label={t("azkar.enable")}
          className="size-4 accent-[var(--color-primary)]"
        />
      </label>

      {settings.enabled ? (
        <p className="text-xs text-text-2">
          {canBackground ? t("azkar.hint") : t("azkar.foregroundOnly")}
        </p>
      ) : null}
    </div>
  );
}
