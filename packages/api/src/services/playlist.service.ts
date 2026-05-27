import { revalidateTag } from "next/cache";

import { requireSession } from "../auth/require-session";
import { playlistsHomeTag, playlistTag } from "../cache/tags";
import {
  createPlaylist as repoCreatePlaylist,
  deletePlaylistById,
  findAllPlaylists,
  findPlaylistById,
  findPlaylistBySlug,
  findPlaylistsByContentId,
  findPublishedPlaylists,
  updatePlaylistById,
} from "../repositories/playlist.repo";
// Cross-service validation: we call category.repo directly (not via a service)
// because this is a lightweight existence check, not a full service boundary
// crossing. Importing the service would risk circular module dependencies.
import { findByContentId as findCategoryByContentId } from "../repositories/category.repo";
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
import { newObjectIdString } from "../utils/id";
import type { Session } from "next-auth";

/*
 * Playlist service — single chokepoint for playlist CRUD.
 * - Public read methods (no session): getPublishedPlaylists, getPlaylistBySlug — locale-scoped.
 * - Admin-only mutations all begin with requireSession(['admin']) before any I/O.
 * - revalidateTag is called after every mutation that affects public cache entries,
 *   scoped to the document's locale (DATABASE.md §3).
 * Services return plain DTO objects; Mongoose Documents never escape this layer.
 */

// Converts a lean Mongo doc to the public-facing Playlist DTO.
function toDto(doc: {
  _id: { toString(): string };
  contentId: { toString(): string };
  locale: string;
  title: string;
  slug: string;
  description?: string | null;
  coverMediaId?: { toString(): string } | null;
  status: string;
  categoryIds?: Array<{ toString(): string }>;
  createdAt: Date;
  updatedAt: Date;
}): Playlist {
  return {
    id: doc._id.toString(),
    contentId: doc.contentId.toString(),
    // Narrowing from string to the enum union is safe: the Mongoose enum
    // constraint enforces the allowed values at the DB layer.
    locale: doc.locale as Playlist["locale"],
    title: doc.title,
    slug: doc.slug,
    ...(doc.description != null ? { description: doc.description } : {}),
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
// Public reads (no session required) — locale-scoped
// ---------------------------------------------------------------------------

export async function getPublishedPlaylists(
  locale: Locale,
  filter?: { categoryContentId?: string },
): Promise<Playlist[]> {
  const docs = await findPublishedPlaylists(
    locale,
    filter?.categoryContentId != null
      ? { categoryContentId: filter.categoryContentId }
      : undefined,
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

/*
 * Resolves the published slug of a program in a given locale, keyed by the
 * shared contentId. Used for hreflang alternates: slugs differ per locale, so
 * the alternate URL cannot be derived by swapping the path prefix. Returns null
 * when that locale variant doesn't exist or isn't published (no alternate link).
 */
export async function getPlaylistSlugForLocale(
  contentId: string,
  locale: Locale,
): Promise<string | null> {
  const variants = await findPlaylistsByContentId(contentId);
  const variant = variants.find(
    (p) => p.locale === locale && p.status === "published",
  );
  return variant ? variant.slug : null;
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

  // First locale of a new program mints a contentId; a translation supplies the
  // existing program's contentId to link the locales together.
  const contentId = parsed.contentId ?? newObjectIdString();

  // Cross-service validation: confirm every supplied category contentId exists.
  // categoryIds reference categories by their locale-agnostic contentId.
  if (parsed.categoryIds.length > 0) {
    for (const categoryContentId of parsed.categoryIds) {
      const exists = await findCategoryByContentId(categoryContentId);
      if (exists === null) {
        throw AppError.NotFound(`Category not found: ${categoryContentId}`);
      }
    }
  }

  // Auto-generate slug from title when the caller omits it.
  const slug = parsed.slug ?? slugify(parsed.title, contentId);

  const { contentId: _omitContentId, slug: _omitSlug, ...rest } = parsed;
  const lean = await repoCreatePlaylist({ ...rest, slug, contentId });

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

  // Cross-service validation: confirm every supplied category contentId exists
  // before writing. `categoryIds` is optional in the update schema.
  if (parsed.categoryIds != null && parsed.categoryIds.length > 0) {
    for (const categoryContentId of parsed.categoryIds) {
      const exists = await findCategoryByContentId(categoryContentId);
      if (exists === null) {
        throw AppError.NotFound(`Category not found: ${categoryContentId}`);
      }
    }
  }

  const lean = await updatePlaylistById(id, parsed);
  if (!lean) throw AppError.NotFound("Playlist");

  const locale = lean.locale as Locale;
  revalidateTag(playlistsHomeTag(locale), "default");
  revalidateTag(playlistTag(locale, lean.slug), "default");

  return toDto(lean);
}

export async function deletePlaylist(id: string): Promise<void> {
  await requireSession(["admin"]);

  // Fetch before delete so we have the slug + locale for cache invalidation.
  const existing = await findPlaylistById(id);
  if (!existing) throw AppError.NotFound("Playlist");

  await deletePlaylistById(id);

  const locale = existing.locale as Locale;
  revalidateTag(playlistsHomeTag(locale), "default");
  revalidateTag(playlistTag(locale, existing.slug), "default");
}

export async function publishPlaylist(id: string): Promise<Playlist> {
  await requireSession(["admin"]);

  const lean = await updatePlaylistById(id, { status: "published" });
  if (!lean) throw AppError.NotFound("Playlist");

  const locale = lean.locale as Locale;
  revalidateTag(playlistsHomeTag(locale), "default");
  revalidateTag(playlistTag(locale, lean.slug), "default");

  return toDto(lean);
}

export async function unpublishPlaylist(id: string): Promise<Playlist> {
  await requireSession(["admin"]);

  const lean = await updatePlaylistById(id, { status: "draft" });
  if (!lean) throw AppError.NotFound("Playlist");

  const locale = lean.locale as Locale;
  revalidateTag(playlistsHomeTag(locale), "default");
  revalidateTag(playlistTag(locale, lean.slug), "default");

  return toDto(lean);
}
