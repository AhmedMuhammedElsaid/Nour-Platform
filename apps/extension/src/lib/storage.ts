import browser from "webextension-polyfill";
import {
  adhanSettingsSchema,
  azkarReminderSettingsSchema,
  DEFAULT_ADHAN_SETTINGS,
  DEFAULT_AZKAR_REMINDER_SETTINGS,
  DEFAULT_KAHF_REMINDER_SETTINGS,
  DEFAULT_LOCATION,
  kahfReminderSettingsSchema,
  prayerLocationSchema,
  prayerPreferencesSchema,
  type AdhanSettings,
  type AzkarReminderSettings,
  type KahfReminderSettings,
  type PrayerLocation,
  type PrayerPreferences,
} from "@repo/shared-core/schemas/prayer-times";
import { z } from "zod";

// Continue-listening entry. `slug`/`title`/`type` are the original (playlist-level)
// fields; the optional fields enrich a per-track recent (web parity) so the shelf
// can show a cover, the playlist name, and a resume bar (savedPos / durationSecs).
export type RecentItem = {
  slug: string;
  title: string;
  type: "playlist" | "quran";
  trackId?: string;
  cover?: string;
  playlistTitle?: string;
  durationSecs?: number;
};
export type PlayerPositions = Record<string, { t: number }>;

// Persisted player preferences (mirrors web `nour.player.prefs`): survive across
// sessions and re-hydrate the offscreen engine on startup.
export type PlayerPrefs = {
  shuffle: boolean;
  repeat: "off" | "all" | "one";
  playbackRate: number;
  volume: number;
};

export const DEFAULT_PLAYER_PREFS: PlayerPrefs = {
  shuffle: false,
  repeat: "off",
  playbackRate: 1,
  volume: 1,
};

// Device-local adhkar progress (identical key/shape to web + mobile). Resets per
// calendar day so morning/evening adhkar behave like a daily checklist.
// sets: setId -> itemIndex(string) -> count.
export type AzkarProgress = {
  date: string;
  sets: Record<string, Record<string, number>>;
};

// ── Quran device-local (identical keys to web nour.quran.*) ──────────────────

export type QuranPrefs = {
  translationSlug: string;
  reciterSlug: string;
  showTranslation: boolean;
  showWordByWord: boolean;
  fontScale: number; // clamped 0.8..1.6 by the settings UI
};

export const DEFAULT_QURAN_PREFS: QuranPrefs = {
  translationSlug: "en.sahih",
  reciterSlug: "qatami",
  showTranslation: true,
  showWordByWord: false,
  fontScale: 1,
};

export type AyahRef = {
  surah: number;
  ayah: number;
  numberGlobal?: number;
  surahName?: string;
};

// ZodType<T, ZodTypeDef, unknown>: the Input param must be `unknown` (not T) to
// accept ZodDefault/ZodObject schemas whose _input fields are optional-unioned.
type SchemaEntry<T> = { schema: z.ZodType<T, z.ZodTypeDef, unknown>; fallback: T };

const SCHEMA_MAP: {
  "nour.prayer.location": SchemaEntry<PrayerLocation>;
  "nour.prayer.prefs": SchemaEntry<PrayerPreferences>;
  "nour.prayer.adhan": SchemaEntry<AdhanSettings>;
  "nour.azkar.reminder": SchemaEntry<AzkarReminderSettings>;
  "nour.kahf.reminder": SchemaEntry<KahfReminderSettings>;
  "nour.kahf.dismissed": SchemaEntry<string>;
  "nour.player.recent": SchemaEntry<RecentItem[]>;
  "nour.player.positions": SchemaEntry<PlayerPositions>;
  "nour.player.prefs": SchemaEntry<PlayerPrefs>;
  "nour.theme": SchemaEntry<"dark" | "light">;
  "nour.locale": SchemaEntry<"ar" | "en">;
  "nour.adhkar.progress": SchemaEntry<AzkarProgress>;
  "nour.quran.prefs": SchemaEntry<QuranPrefs>;
  "nour.quran.lastread": SchemaEntry<AyahRef | null>;
  "nour.quran.bookmarks": SchemaEntry<AyahRef[]>;
  "nour.radio.favorites": SchemaEntry<string[]>;
  "nour.radio.recent": SchemaEntry<string[]>;
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
  "nour.kahf.reminder": {
    schema: kahfReminderSettingsSchema,
    fallback: DEFAULT_KAHF_REMINDER_SETTINGS,
  },
  // Local YYYY-MM-DD of the Friday the home Kahf card was dismissed ("" = never).
  "nour.kahf.dismissed": { schema: z.string(), fallback: "" },
  "nour.player.recent": {
    schema: z.array(
      z.object({
        slug: z.string(),
        title: z.string(),
        type: z.enum(["playlist", "quran"]),
        trackId: z.string().optional(),
        cover: z.string().optional(),
        playlistTitle: z.string().optional(),
        durationSecs: z.number().optional(),
      }),
    ).max(20),
    fallback: [],
  },
  "nour.player.positions": {
    schema: z.record(z.object({ t: z.number() })),
    fallback: {},
  },
  "nour.player.prefs": {
    schema: z.object({
      shuffle: z.boolean(),
      repeat: z.enum(["off", "all", "one"]),
      playbackRate: z.number().positive(),
      volume: z.number().min(0).max(1),
    }),
    fallback: DEFAULT_PLAYER_PREFS,
  },
  "nour.theme": { schema: z.enum(["dark", "light"]), fallback: "dark" },
  "nour.locale": { schema: z.enum(["ar", "en"]), fallback: "ar" },
  "nour.adhkar.progress": {
    schema: z.object({
      date: z.string(),
      sets: z.record(z.record(z.number())),
    }),
    fallback: { date: "", sets: {} },
  },
  "nour.quran.prefs": {
    schema: z.object({
      translationSlug: z.string(),
      reciterSlug: z.string(),
      showTranslation: z.boolean(),
      showWordByWord: z.boolean(),
      fontScale: z.number(),
    }),
    fallback: DEFAULT_QURAN_PREFS,
  },
  "nour.quran.lastread": {
    schema: z
      .object({
        surah: z.number(),
        ayah: z.number(),
        numberGlobal: z.number().optional(),
        surahName: z.string().optional(),
      })
      .nullable(),
    fallback: null,
  },
  "nour.quran.bookmarks": {
    schema: z.array(
      z.object({
        surah: z.number(),
        ayah: z.number(),
        numberGlobal: z.number().optional(),
        surahName: z.string().optional(),
      }),
    ),
    fallback: [],
  },
  // Device-local radio favorites + recently-played — same keys/shape as web +
  // mobile (nour.radio.favorites / nour.radio.recent, flat slug arrays, MRU).
  "nour.radio.favorites": { schema: z.array(z.string()), fallback: [] },
  "nour.radio.recent": { schema: z.array(z.string()).max(12), fallback: [] },
};

export type StorageKey = keyof typeof SCHEMA_MAP;
// `as StorageValue<K>` below bridges the generic key-indexed union that TypeScript
// cannot narrow through conditional types without an explicit cast.
export type StorageValue<K extends StorageKey> =
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

// Untyped write used by the background-side storage bridge: the value has already
// been built and validated at the offscreen call site (which is typed), so it is
// written directly. `key` arrives over a runtime message as a plain string.
export async function setRaw(key: string, value: unknown): Promise<void> {
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
