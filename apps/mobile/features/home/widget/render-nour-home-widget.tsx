// Shared composition: reads settings + runs all three row builders, then
// returns the <NourHomeWidget/> JSX. Used by BOTH widget-task-handler.tsx
// (every WIDGET_ADDED/UPDATE/RESIZED) and components/azan-scheduler.tsx's
// instant-refresh-on-settings-change call (home_widget_plan.md §5.9/§5.10) —
// factored out so the two callers can't drift out of sync on what a
// "NourHome" render actually composes.
import { NourHomeWidget } from "@/features/home/widget/nour-home-widget";
import { buildPrayerRows } from "@/features/prayer-times/widget/build-prayer-rows";
import { buildRadioRow } from "@/features/radio/widget/build-radio-row";
import { buildAdhkarRow } from "@/features/adhkar/widget/build-adhkar-row";
import { readLocale, readLocation, readPrefs } from "@/features/prayer-times/lib/prayer-settings-store";

export async function renderNourHomeWidget(widgetInfo: { width: number; height: number }) {
  const [locale, location, prefs] = await Promise.all([readLocale(), readLocation(), readPrefs()]);

  const prayer = buildPrayerRows(location, prefs, new Date(), locale);
  // Radio never throws (build-radio-row.ts contract); adhkar is sync/local.
  const radio = await buildRadioRow(locale);
  const adhkar = buildAdhkarRow(locale);

  return (
    <NourHomeWidget
      width={widgetInfo.width}
      height={widgetInfo.height}
      locale={locale}
      prayer={prayer}
      radio={radio}
      adhkar={adhkar}
    />
  );
}
