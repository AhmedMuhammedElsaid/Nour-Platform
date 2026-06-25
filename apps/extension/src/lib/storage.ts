import browser from "webextension-polyfill";
import {
  adhanSettingsSchema,
  azkarReminderSettingsSchema,
  DEFAULT_ADHAN_SETTINGS,
  DEFAULT_AZKAR_REMINDER_SETTINGS,
  DEFAULT_LOCATION,
  prayerLocationSchema,
  prayerPreferencesSchema,
  type AdhanSettings,
  type AzkarReminderSettings,
  type PrayerLocation,
  type PrayerPreferences,
} from "@repo/shared-core/schemas/prayer-times";
import { z } from "zod";

export type RecentItem = { slug: string; title: string; type: "playlist" | "quran" };
export type PlayerPositions = Record<string, { t: number }>;

// ZodType<T, ZodTypeDef, unknown>: the Input param must be `unknown` (not T) to
// accept ZodDefault/ZodObject schemas whose _input fields are optional-unioned.
type SchemaEntry<T> = { schema: z.ZodType<T, z.ZodTypeDef, unknown>; fallback: T };

const SCHEMA_MAP: {
  "nour.prayer.location": SchemaEntry<PrayerLocation>;
  "nour.prayer.prefs": SchemaEntry<PrayerPreferences>;
  "nour.prayer.adhan": SchemaEntry<AdhanSettings>;
  "nour.azkar.reminder": SchemaEntry<AzkarReminderSettings>;
  "nour.player.recent": SchemaEntry<RecentItem[]>;
  "nour.player.positions": SchemaEntry<PlayerPositions>;
} = {
  "nour.prayer.location": {
    schema: prayerLocationSchema,
    fallback: DEFAULT_LOCATION,
  },
  "nour.prayer.prefs": {
    schema: prayerPreferencesSchema,
    fallback: prayerPreferencesSchema.parse({}),
  },
  "nour.prayer.adhan": {
    schema: adhanSettingsSchema,
    fallback: DEFAULT_ADHAN_SETTINGS,
  },
  "nour.azkar.reminder": {
    schema: azkarReminderSettingsSchema,
    fallback: DEFAULT_AZKAR_REMINDER_SETTINGS,
  },
  "nour.player.recent": {
    schema: z.array(
      z.object({
        slug: z.string(),
        title: z.string(),
        type: z.enum(["playlist", "quran"]),
      }),
    ).max(20),
    fallback: [],
  },
  "nour.player.positions": {
    schema: z.record(z.object({ t: z.number() })),
    fallback: {},
  },
};

type StorageKey = keyof typeof SCHEMA_MAP;
// `as StorageValue<K>` below bridges the generic key-indexed union that TypeScript
// cannot narrow through conditional types without an explicit cast.
type StorageValue<K extends StorageKey> =
  (typeof SCHEMA_MAP)[K] extends SchemaEntry<infer T> ? T : never;

export async function get<K extends StorageKey>(key: K): Promise<StorageValue<K>> {
  try {
    const result = await browser.storage.local.get(key);
    const raw: unknown = result[key];
    if (raw === undefined) return SCHEMA_MAP[key].fallback as StorageValue<K>;
    const parsed = SCHEMA_MAP[key].schema.safeParse(raw);
    return (parsed.success ? parsed.data : SCHEMA_MAP[key].fallback) as StorageValue<K>;
  } catch {
    return SCHEMA_MAP[key].fallback as StorageValue<K>;
  }
}

export async function set<K extends StorageKey>(
  key: K,
  value: StorageValue<K>,
): Promise<void> {
  await browser.storage.local.set({ [key]: value });
}

// Writes defaults only for keys absent from storage — called on first install.
export async function seedDefaults(): Promise<void> {
  const keys = Object.keys(SCHEMA_MAP) as StorageKey[];
  const existing = await browser.storage.local.get(keys);
  const toSet: Record<string, unknown> = {};
  for (const key of keys) {
    if (existing[key] === undefined) toSet[key] = SCHEMA_MAP[key].fallback;
  }
  if (Object.keys(toSet).length > 0) await browser.storage.local.set(toSet);
}

// Subscribe to changes for a single key; returns unsubscribe fn.
export function watch<K extends StorageKey>(
  key: K,
  callback: (value: StorageValue<K>) => void,
): () => void {
  const listener = (
    changes: Record<string, browser.Storage.StorageChange>,
    areaName: string,
  ) => {
    if (areaName !== "local" || !(key in changes)) return;
    const raw: unknown = changes[key]?.newValue;
    if (raw === undefined) {
      callback(SCHEMA_MAP[key].fallback as StorageValue<K>);
      return;
    }
    const parsed = SCHEMA_MAP[key].schema.safeParse(raw);
    callback(
      (parsed.success ? parsed.data : SCHEMA_MAP[key].fallback) as StorageValue<K>,
    );
  };
  browser.storage.onChanged.addListener(listener);
  return () => browser.storage.onChanged.removeListener(listener);
}
