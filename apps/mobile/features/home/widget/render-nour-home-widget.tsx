// Shared composition: reads settings + runs all three row builders (plus the
// arc SVG string), then returns the <NourHomeWidget/> JSX. Used by BOTH
// widget-task-handler.tsx (every WIDGET_ADDED/UPDATE/RESIZED) and
// components/azan-scheduler.tsx's instant-refresh-on-settings-change call
// (home_widget_plan.md §5.9/§5.10) — factored out so the two callers can't
// drift out of sync on what a "NourHome" render actually composes.
import { hijriDate } from "@repo/shared-core/prayer-times/format";

import { buildAdhkarRow } from "@/features/adhkar/widget/build-adhkar-row";
import { NourHomeWidget } from "@/features/home/widget/nour-home-widget";
import { buildArcSvg } from "@/features/prayer-times/widget/build-arc-svg";
import { buildPrayerRows } from "@/features/prayer-times/widget/build-prayer-rows";
import { readLocale, readLocation, readPrefs } from "@/features/prayer-times/lib/prayer-settings-store";
import { buildRadioRow } from "@/features/radio/widget/build-radio-row";

export async function renderNourHomeWidget(widgetInfo: { width: number; height: number }) {
  const [locale, location, prefs] = await Promise.all([readLocale(), readLocation(), readPrefs()]);
  const now = new Date();

  const prayer = buildPrayerRows(location, prefs, now, locale);
  const arcSvg = buildArcSvg({ dots: prayer.dots, ...prayer.arc });
  // Radio + adhkar never throw (see each builder's file-header contract).
  const radio = await buildRadioRow(locale);
  const adhkar = await buildAdhkarRow(locale);

  return (
    <NourHomeWidget
      width={widgetInfo.width}
      height={widgetInfo.height}
      locale={locale}
      hijriDateLabel={hijriDate(now, locale)}
      arcSvg={arcSvg}
      prayer={prayer}
      radio={radio}
      adhkar={adhkar}
    />
  );
}
