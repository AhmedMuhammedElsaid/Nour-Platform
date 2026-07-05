"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

import {
  computeQiblaBearing,
  qiblaCardinalKey,
  qiblaDistanceKm,
} from "@repo/shared-core/qibla/compute";
import { usePrayerSettings } from "@/features/prayer-times/hooks/use-prayer-settings";
import { LocationPicker } from "@/features/prayer-times/components/location-picker";
import { QiblaCompass } from "./qibla-compass";
import { useDeviceHeading } from "../hooks/use-device-heading";

export function QiblaPage({ locale }: { locale: "ar" | "en" }) {
  const t = useTranslations("qibla");
  // The stored location IS the prayer-settings location — reuse it directly
  // rather than duplicating the localStorage read (same reuse the home widget
  // relies on). Qibla only needs lat/lng.
  const { location, setLocation } = usePrayerSettings();
  const { heading, needsPermission, requestPermission } = useDeviceHeading();
  const [permDenied, setPermDenied] = useState(false);

  async function enableCompass(): Promise<void> {
    const res = await requestPermission();
    setPermDenied(res === "denied");
  }

  const bearing = computeQiblaBearing(location);
  const cardinal = t(`compass.${qiblaCardinalKey(bearing)}`);
  const distanceKm = Math.round(qiblaDistanceKm(location));
  const aligned =
    heading != null &&
    Math.abs(((heading - bearing + 540) % 360) - 180) <= 6;

  return (
    <section className="mx-auto max-w-2xl px-4 py-8 sm:px-6 sm:py-12">
      <h1 className="font-display text-3xl font-bold text-text">{t("title")}</h1>
      <p className="mt-1 text-sm text-text-2">🕌 {location.label}</p>

      <div className="mt-6 rounded-xl border border-border bg-surface p-4 sm:p-6">
        <QiblaCompass
          bearing={bearing}
          heading={heading}
          label={t("compassLabel", {
            degrees: Math.round(bearing),
            direction: cardinal,
          })}
        />

        {/* Numeric readout */}
        <div className="mt-4 text-center">
          <p
            className="font-display text-2xl text-primary"
            style={{ fontVariantNumeric: "tabular-nums" }}
          >
            {t("bearing", { degrees: Math.round(bearing), direction: cardinal })}
          </p>
          <p className="mt-1 text-sm text-text-2">
            {t("distanceKm", { km: distanceKm.toLocaleString(locale) })}
          </p>
          {aligned ? (
            <p className="mt-2 text-sm font-medium text-sun">{t("facingQibla")}</p>
          ) : null}
        </div>

        {/* Sensor state: iOS needs an explicit gesture to unlock the compass;
            after that (or on Android/desktop) show the calibration/static note. */}
        <div className="mt-4 text-center">
          {needsPermission ? (
            <>
              <button
                type="button"
                onClick={enableCompass}
                className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-fg transition-colors hover:bg-primary/90"
              >
                {t("enableCompass")}
              </button>
              {permDenied ? (
                <p className="mt-2 text-xs text-text-2">{t("permissionDenied")}</p>
              ) : null}
            </>
          ) : (
            <p className="text-xs text-text-2">
              {heading != null ? t("calibrateHint") : t("staticHint")}
            </p>
          )}
        </div>
      </div>

      {/* Change location — reuses the prayer-times picker + stored location. */}
      <div className="mt-6 rounded-lg border border-border bg-surface p-4">
        <h2 className="mb-3 font-display text-base text-text">{t("changeCity")}</h2>
        <LocationPicker locale={locale} current={location} onSelect={setLocation} />
      </div>
    </section>
  );
}
