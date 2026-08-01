import {
  findAllStations,
  findFeaturedStations,
  findStationBySlug,
  type RadioStationLean,
} from "../repositories/radio.repo";
import { AppError } from "../errors";
import { RADIO } from "../cache/tags";
import { CONTENT_TTL_SECONDS, cachedRead, reviveDates } from "../cache/cached";
import type { RadioStation } from "../schemas/radio";

/*
 * Radio service — public, read-only. No requireSession: the station catalog is
 * public (like quran.service). Admin CRUD is deferred (stations are seeded via
 * `pnpm seed:radio`); when it lands it will mirror category.service —
 * requireSession(['admin']) FIRST, then Zod-parse, then repo, then
 * revalidateTag(RADIO). Services return plain DTOs; Mongoose docs never escape.
 *
 * All three reads are wrapped in unstable_cache under the RADIO tag.
 * ⚠️ Nothing emits revalidateTag(RADIO) yet, precisely because admin CRUD does
 * not exist — the catalogue only changes via `pnpm seed:radio`, which runs
 * outside Next and cannot revalidate. CONTENT_TTL_SECONDS is therefore the
 * *only* thing that makes a reseed visible; it must stay short until the admin
 * CRUD lands and starts emitting the tag.
 */

// Adapter-boundary casts: InferSchemaType opacifies nested subdocument fields;
// the runtime shape is guaranteed by the Mongoose schema definition.
function toDto(doc: RadioStationLean): RadioStation {
  const ar = doc.ar as unknown as { name: string; description?: string | null };
  const en = doc.en as unknown as { name: string; description?: string | null };
  return {
    id: doc._id.toString(),
    slug: doc.slug,
    ar: { name: ar.name, ...(ar.description ? { description: ar.description } : {}) },
    en: { name: en.name, ...(en.description ? { description: en.description } : {}) },
    country: doc.country,
    ...(doc.city ? { city: doc.city } : {}),
    ...(doc.image ? { image: doc.image } : {}),
    streamUrl: doc.streamUrl,
    streamType: doc.streamType as RadioStation["streamType"],
    ...(doc.bitrate != null ? { bitrate: doc.bitrate } : {}),
    language: doc.language,
    category: doc.category as RadioStation["category"],
    ...(doc.nowPlayingUrl ? { nowPlayingUrl: doc.nowPlayingUrl } : {}),
    isLive: doc.isLive,
    isFeatured: doc.isFeatured,
    order: doc.order,
    createdAt: doc.createdAt as Date,
    updatedAt: doc.updatedAt as Date,
  };
}

export async function listStations(): Promise<RadioStation[]> {
  // Key completeness: no arguments, unfiltered repo read — constant key.
  const dtos = await cachedRead(
    ["radio", "stations"],
    [RADIO],
    CONTENT_TTL_SECONDS,
    async () => {
      const docs = await findAllStations();
      return docs.map(toDto);
    },
  );
  return dtos.map(reviveDates);
}

export async function getFeaturedStations(): Promise<RadioStation[]> {
  // Key completeness: no arguments. A distinct key part from listStations
  // because the repo applies a different filter.
  const dtos = await cachedRead(
    ["radio", "featured"],
    [RADIO],
    CONTENT_TTL_SECONDS,
    async () => {
      const docs = await findFeaturedStations();
      return docs.map(toDto);
    },
  );
  return dtos.map(reviveDates);
}

export async function getStationBySlug(slug: string): Promise<RadioStation> {
  /*
   * Key completeness: `slug` is the only argument and is in the key.
   * The isLive gate stays OUTSIDE the cache so the NotFound path is never
   * itself cached, and so flipping isLive is reflected as soon as the cached
   * row refreshes rather than needing a separate negative entry to expire.
   */
  const dto = await cachedRead(
    ["radio", "by-slug", slug],
    [RADIO],
    CONTENT_TTL_SECONDS,
    async () => {
      const doc = await findStationBySlug(slug);
      return doc ? toDto(doc) : null;
    },
  );
  // Hide disabled stations from public lookups (repo returns them regardless).
  if (!dto || !dto.isLive) throw AppError.NotFound("RadioStation");
  return reviveDates(dto);
}
