import { z } from "zod";

// A live Islamic radio station (e.g. إذاعة القرآن الكريم – القاهرة). The first
// vertical whose playable source is an infinite live stream rather than a finite
// track — see the radio plan. Embedded-locale shape mirrors playlists
// (single doc with `ar`/`en` sub-objects; no `contentId`, no top-level `locale`).

const objectIdSchema = z.string().regex(/^[0-9a-f]{24}$/, "Invalid ObjectId");

const slugSchema = z
  .string()
  .regex(/^[\p{L}\p{N}]+(?:-[\p{L}\p{N}]+)*$/u, "Invalid slug")
  .min(1)
  .max(200);

export const radioStreamTypeSchema = z.enum(["mp3", "aac", "hls"]);
export type RadioStreamType = z.infer<typeof radioStreamTypeSchema>;

export const radioCategorySchema = z.enum(["quran", "islamic"]);
export type RadioCategory = z.infer<typeof radioCategorySchema>;

const localeContentSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
});

export const radioStationSchema = z.object({
  id: objectIdSchema,
  slug: slugSchema,
  ar: localeContentSchema,
  en: localeContentSchema,
  // ISO-3166 alpha-2 country code (e.g. "EG"). Uppercased by the model.
  country: z.string().length(2),
  city: z.string().max(100).optional(),
  // A `/public` path (like playlist.scholarImage) OR an absolute URL — NOT
  // `.url()` so relative bundled logos are allowed.
  image: z.string().max(500).optional(),
  // The live stream endpoint (mp3/aac icecast or an HLS .m3u8). Absolute URL.
  streamUrl: z.string().url().max(1000),
  streamType: radioStreamTypeSchema,
  bitrate: z.number().int().positive().optional(),
  // BCP-47-ish language tag of the broadcast (e.g. "ar").
  language: z.string().min(2).max(10),
  category: radioCategorySchema,
  // Optional station-provided "now playing" JSON endpoint. When present the
  // server-side now-playing route proxies it instead of parsing ICY metadata.
  nowPlayingUrl: z.string().url().max(1000).optional(),
  // Enabled/available flag — public reads only return `isLive: true` stations.
  isLive: z.boolean(),
  isFeatured: z.boolean(),
  order: z.number().int().nonnegative(),
  createdAt: z.date(),
  updatedAt: z.date(),
});
export type RadioStation = z.infer<typeof radioStationSchema>;

// Write inputs — admin CRUD is deferred (stations are seeded), but these define
// the canonical write shape and are used by the seed / future CMS.
export const radioStationCreateInputSchema = z.object({
  slug: slugSchema.optional(),
  ar: localeContentSchema,
  en: localeContentSchema,
  country: z.string().length(2),
  city: z.string().max(100).optional(),
  image: z.string().max(500).optional(),
  streamUrl: z.string().url().max(1000),
  streamType: radioStreamTypeSchema.default("mp3"),
  bitrate: z.number().int().positive().optional(),
  language: z.string().min(2).max(10).default("ar"),
  category: radioCategorySchema.default("quran"),
  nowPlayingUrl: z.string().url().max(1000).optional(),
  isLive: z.boolean().default(true),
  isFeatured: z.boolean().default(false),
  order: z.number().int().nonnegative().optional(),
});
export type RadioStationCreateInput = z.infer<typeof radioStationCreateInputSchema>;

export const radioStationUpdateInputSchema = z
  .object({
    ar: localeContentSchema.partial(),
    en: localeContentSchema.partial(),
    country: z.string().length(2),
    city: z.string().max(100).nullable(),
    image: z.string().max(500).nullable(),
    streamUrl: z.string().url().max(1000),
    streamType: radioStreamTypeSchema,
    bitrate: z.number().int().positive().nullable(),
    language: z.string().min(2).max(10),
    category: radioCategorySchema,
    nowPlayingUrl: z.string().url().max(1000).nullable(),
    isLive: z.boolean(),
    isFeatured: z.boolean(),
    order: z.number().int().nonnegative(),
  })
  .partial();
export type RadioStationUpdateInput = z.infer<typeof radioStationUpdateInputSchema>;
