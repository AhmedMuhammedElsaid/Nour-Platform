import type { Locale } from "@repo/shared-core/schemas/locale";
import type { RadioStation } from "@repo/shared-core/schemas/radio";

import type { StationView } from "../types";

// Locale-resolves a RadioStation DTO into the plain shape the screen/shelf
// components consume, tolerating a row missing the active locale (falls back
// to ar/en) so one bad row can't blank the whole list. Shared by the /radio
// screen and the home preview shelf. Mirrors
// apps/web/features/radio/lib/station-view.ts.
export function toStationView(station: RadioStation, locale: Locale): StationView {
  const loc = station[locale] ?? station.ar ?? station.en;
  return {
    slug: station.slug,
    name: loc?.name ?? "",
    ...(loc?.description ? { description: loc.description } : {}),
    ...(station.city ? { city: station.city } : {}),
    ...(station.image ? { image: station.image } : {}),
    streamUrl: station.streamUrl,
    isFeatured: station.isFeatured,
  };
}
