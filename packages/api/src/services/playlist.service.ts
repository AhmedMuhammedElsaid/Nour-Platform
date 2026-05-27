import { revalidateTag } from "next/cache";

import { requireSession } from "../auth/require-session";
import { PLAYLISTS_HOME, playlistTag } from "../cache/tags";
import {
  createPlaylist as repoCreatePlaylist,
  deletePlaylistById,
  findAllPlaylists,
  findPlaylistById,
  findPlaylistBySlug,
  findPublishedPlaylists,
  updatePlaylistById,
} from "../repositories/playlist.repo";
// Cross-service validation: we call category.repo directly (not via a service)
// because this is a lightweight existence check, not a full service boundary
// crossing. Importing the service would risk circular module dependencies.
import { findById as findCategoryById } from "../repositories/category.repo";
import { AppError } from "../errors";
import type { Locale } from "../schemas/locale";
import {
  playlistCreateInputSchema,
  playlistUpdateInputSchema,
  type Playlist,
  type PlaylistCreateInput,
  type PlaylistUpdateInput,
} from "../schemas/playlist";
import { slugify } from "../utils/slug";
import type { Session } from "next-auth";

/*
 * Playlist service — single chokepoint for playlist CRUD.
 * - Public read methods (no session): getPublishedPlaylists, getPlaylistBySlug.
 * - Admin-only mutations all begin with requireSession(['admin']) before any I/O.
 * - revalidateTag is called after every mutation that affects public cache entries.
 * Services return plain DTO objects; Mongoose Documents never escape this layer.
 */

// Converts a lean Mongo doc to the public-facing Playlist DTO.
function toDto(doc: {
  _id: { toString(): string };
  ar: { title: string; slug: string; description?: string | null };
  en: { title: string; slug: string; description?: string | null };
  coverMediaId?: { toString(): string } | null;
  status: string;
  categoryIds?: Array<{ toString(): string }>;
  createdAt: Date;
  updatedAt: Date;
}): Playlist {
  return {
    id: doc._id.toString(),
    ar: {
      title: doc.ar.title,
      slug: doc.ar.slug,
      ...(doc.ar.description != null ? { description: doc.ar.description } : {}),
    },
    en: {
      title: doc.en.title,
      slug: doc.en.slug,
      ...(doc.en.description != null ? { description: doc.en.description } : {}),
    },
    ...(doc.coverMediaId != null
      ? { coverMediaId: doc.coverMediaId.toString() }
      : {}),
    status: doc.status as Playlist["status"],
    categoryIds: (doc.categoryIds ?? []).map((id) => id.toString()),
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

// ---------------------------------------------------------------------------
// Public reads (no session required)
// ---------------------------------------------------------------------------

export async function getPublishedPlaylists(
  filter?: { categoryId?: string },
): Promise<Playlist[]> {
  const docs = await findPublishedPlaylists(
    filter?.categoryId != null ? { categoryId: filter.categoryId } : undefined,
  );
  return docs.map(toDto);
}

export async function getPlaylistBySlug(
  locale: Locale,
  slug: string,
): Promise<Playlist | null> {
  const doc = await findPlaylistBySlug(locale, slug);
  return doc ? toDto(doc) : null;
}

// ---------------------------------------------------------------------------
// Admin reads
// ---------------------------------------------------------------------------

export async function getAllPlaylists(
  session: Session & { user: NonNullable<Session["user"]> },
): Promise<Playlist[]> {
  // Validate the caller holds the admin role. requireSession is async and
  // contacts the auth provider; we accept the pre-resolved session here so
  // server components can pass the already-fetched session without a second
  // round-trip. The RBAC check is still enforced.
  if (session.user.role !== "admin") {
    throw AppError.Forbidden(["admin"]);
  }
  const docs = await findAllPlaylists();
  return docs.map(toDto);
}

export async function getPlaylistById(
  id: string,
  session: Session & { user: NonNullable<Session["user"]> },
): Promise<Playlist | null> {
  if (session.user.role !== "admin") {
    throw AppError.Forbidden(["admin"]);
  }
  const doc = await findPlaylistById(id);
  return doc ? toDto(doc) : null;
}

// ---------------------------------------------------------------------------
// Admin mutations
// ---------------------------------------------------------------------------

export async function createPlaylist(
  input: PlaylistCreateInput,
): Promise<Playlist> {
  // Auth check first — no I/O before verifying identity.
  await requireSession(["admin"]);

  // Zod parse throws ZodError on bad input.
  const parsed = playlistCreateInputSchema.parse(input);

  // Cross-service validation: confirm every supplied category id exists.
  if (parsed.categoryIds.length > 0) {
    for (const categoryId of parsed.categoryIds) {
      const exists = await findCategoryById(categoryId);
      if (exists === null) {
        throw AppError.NotFound(`Category not found: ${categoryId}`);
      }
    }
  }

  // Auto-generate slugs from titles when the caller omits them.
  const arSlug = parsed.ar.slug ?? slugify(parsed.ar.title);
  const enSlug = parsed.en.slug ?? slugify(parsed.en.title);

  const { ar, en, ...rest } = parsed;
  const lean = await repoCreatePlaylist({
    ...rest,
    ar: {
      title: ar.title,
      slug: arSlug,
      ...(ar.description != null ? { description: ar.description } : {}),
    },
    en: {
      title: en.title,
      slug: enSlug,
      ...(en.description != null ? { description: en.description } : {}),
    },
  });

  // No revalidateTag here: new playlists default to status="draft" and are
  // invisible on the public homepage / detail pages, so no cached entry needs
  // invalidating. The first publish (publishPlaylist) emits the home tag.
  return toDto(lean);
}

export async function updatePlaylist(
  id: string,
  input: PlaylistUpdateInput,
): Promise<Playlist> {
  await requireSession(["admin"]);

  const parsed = playlistUpdateInputSchema.parse(input);

  // Cross-service validation: confirm every supplied category id exists.
  if (parsed.categoryIds != null && parsed.categoryIds.length > 0) {
    for (const categoryId of parsed.categoryIds) {
      const exists = await findCategoryById(categoryId);
      if (exists === null) {
        throw AppError.NotFound(`Category not found: ${categoryId}`);
      }
    }
  }

  const lean = await updatePlaylistById(id, parsed);
  if (!lean) throw AppError.NotFound("Playlist");

  revalidateTag(PLAYLISTS_HOME, "default");
  revalidateTag(playlistTag(lean._id.toString()), "default");

  return toDto(lean);
}

export async function deletePlaylist(id: string): Promise<void> {
  await requireSession(["admin"]);

  // Fetch before delete so we have the id for cache invalidation.
  const existing = await findPlaylistById(id);
  if (!existing) throw AppError.NotFound("Playlist");

  await deletePlaylistById(id);

  revalidateTag(PLAYLISTS_HOME, "default");
  revalidateTag(playlistTag(id), "default");
}

export async function publishPlaylist(id: string): Promise<Playlist> {
  await requireSession(["admin"]);

  const lean = await updatePlaylistById(id, { status: "published" });
  if (!lean) throw AppError.NotFound("Playlist");

  revalidateTag(PLAYLISTS_HOME, "default");
  revalidateTag(playlistTag(lean._id.toString()), "default");

  return toDto(lean);
}

export async function unpublishPlaylist(id: string): Promise<Playlist> {
  await requireSession(["admin"]);

  const lean = await updatePlaylistById(id, { status: "draft" });
  if (!lean) throw AppError.NotFound("Playlist");

  revalidateTag(PLAYLISTS_HOME, "default");
  revalidateTag(playlistTag(lean._id.toString()), "default");

  return toDto(lean);
}
