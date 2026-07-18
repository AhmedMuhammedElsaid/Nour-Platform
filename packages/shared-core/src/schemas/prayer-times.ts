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
  // Curated city id (from cities.ts) for locale-aware display. Optional so
  // arbitrary GPS coordinates (not in the curated list) still persist cleanly.
  cityId: z.string().optional(),
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
  cityId: "cairo",
};

// Prayers that have an adhan (sunrise is a marker, not a prayer).
export const ADHAN_PRAYER_KEYS = [
  "fajr",
  "dhuhr",
  "asr",
  "maghrib",
  "isha",
] as const;
export type AdhanPrayerKey = (typeof ADHAN_PRAYER_KEYS)[number];

const perPrayerSchema = z.object({
  fajr: z.boolean().default(true),
  dhuhr: z.boolean().default(true),
  asr: z.boolean().default(true),
  maghrib: z.boolean().default(true),
  isha: z.boolean().default(true),
});

// User controls for the adhan. Persisted device-local (localStorage), never
// sent to the server — no auth/DB involvement (matches prayer-times v1).
export const adhanSettingsSchema = z.object({
  enabled: z.boolean().default(true),
  perPrayer: perPrayerSchema.default({}),
  volume: z.number().min(0).max(1).default(0.8),
});
export type AdhanSettings = z.infer<typeof adhanSettingsSchema>;

export const DEFAULT_ADHAN_SETTINGS: AdhanSettings = adhanSettingsSchema.parse({});

// Per-locale slugs for the morning/evening Adhkar collections (seeded by
// scripts/seed-adhkar.ts). The reader route resolves by the locale's own slug.
const azkarSlugLocaleSchema = z.object({
  ar: z.string().min(1),
  en: z.string().min(1),
});

// Azkar al-Sabah/al-Masaa reminder, fired `offsetMinutes` after Fajr/Asr.
// Device-local only (localStorage), independent of the adhan toggle.
// On by default (owner decision 2026-07-16): every user gets the daily
// reminders without touching settings — delivery still gates on the OS/browser
// notification permission per surface.
export const azkarReminderSettingsSchema = z.object({
  enabled: z.boolean().default(true),
  offsetMinutes: z.number().int().min(0).max(120).default(15),
  sabah: azkarSlugLocaleSchema.default({ ar: "أذكار-الصباح", en: "morning-adhkar" }),
  masaa: azkarSlugLocaleSchema.default({ ar: "أذكار-المساء", en: "evening-adhkar" }),
});
export type AzkarReminderSettings = z.infer<typeof azkarReminderSettingsSchema>;

export const DEFAULT_AZKAR_REMINDER_SETTINGS: AzkarReminderSettings =
  azkarReminderSettingsSchema.parse({});

// Friday Surah Al-Kahf reminder — fixed 12:00 local, not configurable.
// Device-local contract `nour.kahf.reminder` (mobile AsyncStorage · extension
// browser.storage). On by default like the azkar reminders; delivery still
// gates on the OS/browser notification permission per surface.
export const kahfReminderSettingsSchema = z.object({
  enabled: z.boolean().default(true),
});
export type KahfReminderSettings = z.infer<typeof kahfReminderSettingsSchema>;

export const DEFAULT_KAHF_REMINDER_SETTINGS: KahfReminderSettings =
  kahfReminderSettingsSchema.parse({});
