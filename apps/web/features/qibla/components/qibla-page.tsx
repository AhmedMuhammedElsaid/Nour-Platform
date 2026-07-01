"use client";

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
  const { heading } = useDeviceHeading();

  const bearing = computeQiblaBearing(location);
  const cardinal = t(`compass.${qiblaCardinalKey(bearing)}`);
  const distanceKm = Math.round(qiblaDistanceKm(location));
  const aligned =
    heading != null &&
    Math.abs(((heading - bearing + 540) % 360) - 180) <= 6;

  return (
    <section className="mx-auto max-w-2xl px-6 py-12">
      <h1 className="font-display text-3xl font-bold text-text">{t("title")}</h1>
      <p className="mt-1 text-sm text-text-2">🕌 {location.label}</p>

      <div className="mt-6 rounded-xl border border-border bg-surface p-6">
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

        {/* Sensor state: calibration hint once live, otherwise the static note. */}
        <div className="mt-4 text-center">
          <p className="text-xs text-text-2">
            {heading != null ? t("calibrateHint") : t("staticHint")}
          </p>
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
