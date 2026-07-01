import {
  findAllStations,
  findFeaturedStations,
  findStationBySlug,
  type RadioStationLean,
} from "../repositories/radio.repo";
import { AppError } from "../errors";
import type { RadioStation } from "../schemas/radio";

/*
 * Radio service — public, read-only. No requireSession: the station catalog is
 * public (like quran.service). Admin CRUD is deferred (stations are seeded via
 * `pnpm seed:radio`); when it lands it will mirror category.service —
 * requireSession(['admin']) FIRST, then Zod-parse, then repo, then
 * revalidateTag(RADIO). Services return plain DTOs; Mongoose docs never escape.
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
  const docs = await findAllStations();
  return docs.map(toDto);
}

export async function getFeaturedStations(): Promise<RadioStation[]> {
  const docs = await findFeaturedStations();
  return docs.map(toDto);
}

export async function getStationBySlug(slug: string): Promise<RadioStation> {
  const doc = await findStationBySlug(slug);
  // Hide disabled stations from public lookups (repo returns them regardless).
  if (!doc || !doc.isLive) throw AppError.NotFound("RadioStation");
  return toDto(doc);
}
