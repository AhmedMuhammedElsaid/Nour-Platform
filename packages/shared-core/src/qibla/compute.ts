// Pure Qibla direction math — framework-agnostic (no react/DOM/next), mirrors
// the purity rules of prayer-times/compute.ts. The Qibla is the great-circle
// bearing from the observer to the Kaaba in Mecca; it is derived from the same
// device location the prayer-times feature already stores, so this module adds
// no new dependency and no I/O.

// Kaaba coordinates (Masjid al-Haram, Mecca). Widely used reference values.
export const KAABA = { lat: 21.4225, lng: 39.8262 } as const;

export type LatLng = { lat: number; lng: number };

const toRad = (deg: number): number => (deg * Math.PI) / 180;
const toDeg = (rad: number): number => (rad * 180) / Math.PI;

// Normalize any angle in degrees to [0, 360).
const norm360 = (deg: number): number => ((deg % 360) + 360) % 360;

/**
 * Initial great-circle bearing from `from` to the Kaaba, in degrees clockwise
 * from **true north**, normalized to [0, 360).
 *
 *   θ = atan2( sinΔλ·cosφ2 , cosφ1·sinφ2 − sinφ1·cosφ2·cosΔλ )
 *
 * At (or infinitesimally near) the Kaaba the bearing is undefined; we return 0
 * so callers always get a finite number.
 */
export function computeQiblaBearing(from: LatLng): number {
  const phi1 = toRad(from.lat);
  const phi2 = toRad(KAABA.lat);
  const dLambda = toRad(KAABA.lng - from.lng);

  const y = Math.sin(dLambda) * Math.cos(phi2);
  const x =
    Math.cos(phi1) * Math.sin(phi2) -
    Math.sin(phi1) * Math.cos(phi2) * Math.cos(dLambda);

  if (y === 0 && x === 0) return 0;
  return norm360(toDeg(Math.atan2(y, x)));
}

export type CardinalKey =
  | "n"
  | "ne"
  | "e"
  | "se"
  | "s"
  | "sw"
  | "w"
  | "nw";

const CARDINALS: CardinalKey[] = ["n", "ne", "e", "se", "s", "sw", "w", "nw"];

/**
 * Maps a bearing (deg) to one of 8 compass-point keys for i18n. Each app
 * translates the key ("ne" → "NE" / "شمال شرق"). Sectors are 45° wide, centred
 * on each cardinal (N spans 337.5°–22.5°).
 */
export function qiblaCardinalKey(bearing: number): CardinalKey {
  const idx = Math.round(norm360(bearing) / 45) % 8;
  return CARDINALS[idx]!;
}

const EARTH_RADIUS_KM = 6371;

/**
 * Great-circle (haversine) distance from `from` to the Kaaba, in kilometres.
 * Used only for a display readout ("1,320 km").
 */
export function qiblaDistanceKm(from: LatLng): number {
  const phi1 = toRad(from.lat);
  const phi2 = toRad(KAABA.lat);
  const dPhi = toRad(KAABA.lat - from.lat);
  const dLambda = toRad(KAABA.lng - from.lng);

  const a =
    Math.sin(dPhi / 2) ** 2 +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(dLambda / 2) ** 2;
  return EARTH_RADIUS_KM * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
