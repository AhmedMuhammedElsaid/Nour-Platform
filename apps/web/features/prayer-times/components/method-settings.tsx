"use client";

import { useTranslations } from "next-intl";

import {
  CALCULATION_METHOD_IDS,
  type CalculationMethodId,
  type MadhabId,
} from "@repo/api/schemas/prayer-times";

export function MethodSettings({
  method,
  madhab,
  onMethodChange,
  onMadhabChange,
}: {
  method: CalculationMethodId;
  madhab: MadhabId;
  onMethodChange: (m: CalculationMethodId) => void;
  onMadhabChange: (m: MadhabId) => void;
}) {
  const t = useTranslations("prayer");

  return (
    <div className="space-y-4">
      <label className="block">
        <span className="mb-1.5 block text-xs uppercase tracking-[0.06em] text-text-2">
          {t("method")}
        </span>
        <select
          value={method}
          onChange={(e) => onMethodChange(e.target.value as CalculationMethodId)}
          className="w-full rounded-md border border-border bg-surface-2 px-3 py-2.5 text-sm text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {CALCULATION_METHOD_IDS.map((id) => (
            <option key={id} value={id}>
              {t(`method${id}`)}
            </option>
          ))}
        </select>
      </label>

      <label className="block">
        <span className="mb-1.5 block text-xs uppercase tracking-[0.06em] text-text-2">
          {t("madhab")}
        </span>
        <select
          value={madhab}
          onChange={(e) => onMadhabChange(e.target.value as MadhabId)}
          className="w-full rounded-md border border-border bg-surface-2 px-3 py-2.5 text-sm text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <option value="standard">{t("madhabStandard")}</option>
          <option value="hanafi">{t("madhabHanafi")}</option>
        </select>
      </label>
    </div>
  );
}
