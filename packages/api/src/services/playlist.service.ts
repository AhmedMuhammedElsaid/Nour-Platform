import { revalidateTag } from "next/cache";

import { requireSession } from "../auth/require-session";
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
import {
  playlistCreateInputSchema,
  playlistUpdateInputSchema,
  type Playlist,
  type PlaylistCreateInput,
  type PlaylistUpdateInput,
} from "../schemas/playlist";
import type { Session } from "next-auth";

/*
 * Playlist service — Wave 2.6. Single chokepoint for playlist CRUD.
 * - Public read methods (no session required): getPublishedPlaylists, getPlaylistBySlug.
 * - Admin-only mutations all begin with requireSession(['admin']) before any I/O.
 * - revalidateTag is called after every mutation that affects public cache entries.
 * Services return plain DTO objects; Mongoose Documents never escape this layer.
 */

// Converts a lean Mongo doc to the public-facing Playlist DTO.
function toDto(doc: {
  _id: { toString(): string };
  title: string;
  slug: string;
  description?: string | null;
  coverMediaId?: { toString(): string } | null;
  status: string;
  trackIds: Array<{ toString(): string }>;
  categoryIds?: Array<{ toString(): string }>;
  createdAt: Date;
  updatedAt: Date;
}): Playlist {
  return {
    id: doc._id.toString(),
    title: doc.title,
    slug: doc.slug,
    ...(doc.description != null ? { description: doc.description } : {}),
    ...(doc.coverMediaId != null
      ? { coverMediaId: doc.coverMediaId.toString() }
      : {}),
    // Narrowing from string to the enum union is safe: the Mongoose enum
    // constraint enforces the allowed values at the DB layer.
    status: doc.status as Playlist["status"],
    trackIds: doc.trackIds.map((id) => id.toString()),
    categoryIds: (doc.categoryIds ?? []).map((id) => id.toString()),
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

/*
 * Derives a URL-safe slug from a title. The pattern matches slugSchema in
 * schemas/playlist.ts: lowercase, alphanum + hyphens, max 200 chars.
 */
function slugify(title: string): string {
  return title
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 200);
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

export async function getPlaylistBySlug(slug: string): Promise<Playlist | null> {
  const doc = await findPlaylistBySlug(slug);
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

  // Zod parse throws AppError.Validation on bad input (CLAUDE.md §4).
  const parsed = playlistCreateInputSchema.parse(input);

  // Cross-service validation: confirm every supplied categoryId exists in the
  // categories collection before writing. We check individually so we can
  // surface which ID is missing in the error message.
  if (parsed.categoryIds.length > 0) {
    for (const categoryId of parsed.categoryIds) {
      const exists = await findCategoryById(categoryId);
      if (exists === null) {
        throw AppError.NotFound(`Category not found: ${categoryId}`);
      }
    }
  }

  // Auto-generate slug from title when the caller omits it.
  const slug = parsed.slug ?? slugify(parsed.title);

  const lean = await repoCreatePlaylist({ ...parsed, slug });
  return toDto(lean);
}

export async function updatePlaylist(
  id: string,
  input: PlaylistUpdateInput,
): Promise<Playlist> {
  await requireSession(["admin"]);

  const parsed = playlistUpdateInputSchema.parse(input);

  // Cross-service validation: confirm every supplied categoryId exists before
  // writing. `categoryIds` is optional in the update schema (via .partial()),
  // so we guard on its presence first.
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

  revalidateTag("playlists:home", "default");
  revalidateTag(`playlist:${lean.slug}`, "default");

  return toDto(lean);
}

export async function deletePlaylist(id: string): Promise<void> {
  await requireSession(["admin"]);

  // Fetch before delete so we have the slug for cache invalidation.
  const existing = await findPlaylistById(id);
  if (!existing) throw AppError.NotFound("Playlist");

  await deletePlaylistById(id);

  revalidateTag("playlists:home", "default");
  revalidateTag(`playlist:${existing.slug}`, "default");
}

export async function publishPlaylist(id: string): Promise<Playlist> {
  await requireSession(["admin"]);

  const lean = await updatePlaylistById(id, { status: "published" });
  if (!lean) throw AppError.NotFound("Playlist");

  revalidateTag("playlists:home", "default");
  revalidateTag(`playlist:${lean.slug}`, "default");

  return toDto(lean);
}

export async function unpublishPlaylist(id: string): Promise<Playlist> {
  await requireSession(["admin"]);

  const lean = await updatePlaylistById(id, { status: "draft" });
  if (!lean) throw AppError.NotFound("Playlist");

  revalidateTag("playlists:home", "default");
  revalidateTag(`playlist:${lean.slug}`, "default");

  return toDto(lean);
}
