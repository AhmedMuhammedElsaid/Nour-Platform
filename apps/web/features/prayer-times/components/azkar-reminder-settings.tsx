"use client";

import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";

import { useAzkarReminderSettings } from "../hooks/use-azkar-reminder-settings";
import { requestAdhanPermission } from "../lib/adhan-notifications";
import {
  type AzkarReminderBuilder,
  sendTestAzkarReminder,
} from "../lib/azkar-reminder-notifications";

export function AzkarReminderSettings() {
  const t = useTranslations("prayer");
  const locale = useLocale() === "ar" ? "ar" : "en";
  const { settings, hydrated, setEnabled } = useAzkarReminderSettings();
  const [canBackground, setCanBackground] = useState(false);
  const [testMode, setTestMode] = useState(false);
  const [testMsg, setTestMsg] = useState("");

  useEffect(() => {
    setCanBackground(
      typeof window !== "undefined" &&
        "Notification" in window &&
        "showTrigger" in Notification.prototype,
    );
    setTestMode(
      typeof window !== "undefined" &&
        new URLSearchParams(window.location.search).has("test"),
    );
  }, []);

  const build: AzkarReminderBuilder = (kind) => {
    const slug = kind === "sabah" ? settings.sabah[locale] : settings.masaa[locale];
    return {
      url: `/${locale}/adhkar/${encodeURIComponent(slug)}`,
      title: t(`azkar.${kind}.title`),
      body: t(`azkar.${kind}.body`),
    };
  };

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

      {testMode ? (
        <div className="space-y-2 rounded-md border border-dashed border-border p-3">
          <button
            type="button"
            onClick={async () => {
              setTestMsg("…");
              const r = await sendTestAzkarReminder(build, 10_000);
              setTestMsg(
                r === "scheduled"
                  ? "Scheduled — you can close the tab; arrives in ~10s."
                  : r === "shown"
                    ? "Shown now (foreground)."
                    : r === "no-sw"
                      ? "No service worker — run a production build."
                      : "Notification permission denied.",
              );
            }}
            className="w-full rounded-md border border-border bg-surface-2 px-3 py-2 text-sm text-text hover:bg-surface"
          >
            🔔 Send test reminder (10s)
          </button>
          {testMsg ? <p className="text-xs text-text-2">{testMsg}</p> : null}
        </div>
      ) : null}
    </div>
  );
}
