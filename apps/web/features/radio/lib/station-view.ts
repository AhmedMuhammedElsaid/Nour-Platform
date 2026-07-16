import type { Locale } from "@repo/api/schemas/locale";
import type { RadioStation } from "@repo/api/schemas/radio";

import type { StationView } from "../types";

// Locale-resolves a RadioStation DTO into the plain, serializable shape the
// client islands consume. Shared by the /radio route and the homepage
// preview shelf so both stay in sync with the DTO shape.
export function toStationView(station: RadioStation, locale: Locale): StationView {
  return {
    id: station.id,
    slug: station.slug,
    name: station[locale].name,
    ...(station[locale].description ? { description: station[locale].description } : {}),
    country: station.country,
    ...(station.city ? { city: station.city } : {}),
    ...(station.image ? { image: station.image } : {}),
    streamUrl: station.streamUrl,
    isFeatured: station.isFeatured,
  };
}
