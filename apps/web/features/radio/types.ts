// Locale-resolved view of a radio station, shaped in the RSC and handed to the
// client island. Dates are dropped (the UI never needs them) so nothing but
// plain serializable primitives crosses the server→client boundary.
export type StationView = {
  id: string;
  slug: string;
  name: string;
  description?: string;
  country: string;
  city?: string;
  image?: string;
  streamUrl: string;
  isFeatured: boolean;
};
