// Locale-resolved view of a radio station, shaped in the screen from the
// RadioStation DTO. Mirrors apps/web/features/radio/types.ts.
export type StationView = {
  slug: string;
  name: string;
  description?: string;
  city?: string;
  image?: string;
  streamUrl: string;
  isFeatured: boolean;
};
