// Day-fraction (Fajr→Isha) position for each prayer instant, used to place the
// dots along the arc. Mirrors `buildArcDots` in
// apps/web/features/prayer-times/components/prayer-times-widget.tsx. The localized
// `label` is optional: the full prayer-times screen passes a resolver so SunArc can
// draw names on the dots (showLabels), while the small Home widget omits it (names
// live in the labeled row below the widget's arc).

import type {
  PrayerDay,
  PrayerInstant,
  PrayerKey,
} from "@repo/shared-core/prayer-times/compute";

export type ArcDot = {
  key: PrayerKey;
  fraction: number; // 0..1 along the Fajr→Isha day
  isNext: boolean;
  label?: string; // localized prayer name, only when a labelFor resolver is given
};

export function buildArcDots(
  day: PrayerDay,
  nextKey: PrayerKey | null,
  labelFor?: (key: PrayerKey) => string,
): ArcDot[] {
  const fajr = day.instants.find((i) => i.key === "fajr")?.time ?? null;
  const isha = day.instants.find((i) => i.key === "isha")?.time ?? null;
  const span =
    fajr != null && isha != null && isha.getTime() > fajr.getTime()
      ? isha.getTime() - fajr.getTime()
      : 1;
  return day.instants
    .filter((i): i is PrayerInstant & { time: Date } => i.time != null)
    .map((i) => ({
      key: i.key,
      fraction:
        fajr != null
          ? Math.min(1, Math.max(0, (i.time.getTime() - fajr.getTime()) / span))
          : 0.5,
      isNext: i.key === nextKey,
      ...(labelFor ? { label: labelFor(i.key) } : {}),
    }));
}
