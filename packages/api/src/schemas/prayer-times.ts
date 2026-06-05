import { z } from "zod";

// Supported calculation conventions. Each maps 1:1 to an adhan CalculationMethod
// factory in the service. Keep this list in sync with methodFactory().
export const CALCULATION_METHOD_IDS = [
  "MuslimWorldLeague",
  "Egyptian",
  "Karachi",
  "UmmAlQura",
  "Dubai",
  "MoonsightingCommittee",
  "NorthAmerica",
  "Kuwait",
  "Qatar",
  "Singapore",
  "Turkey",
  "Tehran",
] as const;

export const calculationMethodSchema = z.enum(CALCULATION_METHOD_IDS);
export type CalculationMethodId = z.infer<typeof calculationMethodSchema>;

export const madhabSchema = z.enum(["standard", "hanafi"]);
export type MadhabId = z.infer<typeof madhabSchema>;

export const DEFAULT_METHOD: CalculationMethodId = "Egyptian";
export const DEFAULT_MADHAB: MadhabId = "standard";

// A resolved geographic point with a human label for display.
export const prayerLocationSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  label: z.string().min(1),
});
export type PrayerLocation = z.infer<typeof prayerLocationSchema>;

export const prayerPreferencesSchema = z.object({
  method: calculationMethodSchema.default(DEFAULT_METHOD),
  madhab: madhabSchema.default(DEFAULT_MADHAB),
});
export type PrayerPreferences = z.infer<typeof prayerPreferencesSchema>;

// Default location used for SSR first paint and before the user picks a city.
export const DEFAULT_LOCATION: PrayerLocation = {
  lat: 30.0444,
  lng: 31.2357,
  label: "Cairo",
};
