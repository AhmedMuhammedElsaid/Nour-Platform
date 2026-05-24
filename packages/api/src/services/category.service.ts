import { revalidateTag } from "next/cache";

import { requireSession } from "../auth/require-session";
import {
  create as repoCreate,
  deleteById as repoDeleteById,
  findAll,
  findBySlug,
  updateById as repoUpdateById,
} from "../repositories/category.repo";
import { AppError } from "../errors";
import {
  categoryCreateInputSchema,
  categoryUpdateInputSchema,
  type Category,
  type CategoryCreateInput,
  type CategoryUpdateInput,
} from "../schemas/category";
import { getDb } from "../db/client";
import { PlaylistModel } from "../db/models/playlist.model";
import { CATEGORIES, PLAYLISTS_HOME } from "../cache/tags";
import type { CategoryLean } from "../repositories/category.repo";

/*
 * Category service — P2-A. Single chokepoint for category CRUD.
 * - Public reads (no session): listCategories, getCategoryBySlug.
 * - Admin-only mutations begin with requireSession(['admin']) before any I/O.
 * - revalidateTag is called after every mutation that affects cached responses.
 * Services return plain DTO objects; Mongoose Documents never escape this layer.
 */

// Converts a lean Mongo doc to the public-facing Category DTO.
function toDto(doc: CategoryLean): Category {
  return {
    id: doc._id.toString(),
    name: doc.name,
    slug: doc.slug,
    ...(doc.description != null ? { description: doc.description } : {}),
    // coverMediaId on CategoryDoc is a mongoose ObjectId or undefined.
    // The `as` cast here is safe: CategoryDoc's coverMediaId is typed as
    // ObjectId (from Schema.Types.ObjectId) and Mongoose serialises it to
    // a 24-char hex string at the lean() boundary, which matches objectIdSchema.
    ...(doc.coverMediaId != null
      ? { coverMediaId: (doc.coverMediaId as { toString(): string }).toString() }
      : {}),
    createdAt: doc.createdAt as Date,
    updatedAt: doc.updatedAt as Date,
  };
}

/*
 * Derives a URL-safe slug from a name. Matches slugSchema in schemas/category.ts:
 * lowercase, alphanum + hyphens, max 200 chars. Mirrors slugify in playlist.service.ts.
 */
function slugify(name: string): string {
  return name
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

export async function listCategories(): Promise<Category[]> {
  const docs = await findAll();
  return docs.map(toDto);
}

export async function getCategoryBySlug(slug: string): Promise<Category> {
  const doc = await findBySlug(slug);
  if (!doc) throw AppError.NotFound("Category");
  return toDto(doc);
}

// ---------------------------------------------------------------------------
// Admin mutations
// ---------------------------------------------------------------------------

export async function createCategory(
  input: CategoryCreateInput,
): Promise<Category> {
  // Auth check first — no I/O before verifying identity.
  await requireSession(["admin"]);

  // Zod parse throws on bad input (CLAUDE.md §4).
  const parsed = categoryCreateInputSchema.parse(input);

  // Auto-generate slug from name when the caller omits it.
  const baseSlug = parsed.slug ?? slugify(parsed.name);

  /*
   * Slug collision handling: try the base slug first, then append a numeric
   * suffix (-2, -3, …) on Mongo unique-constraint violations (error code 11000).
   * The loop is bounded at 10 attempts to prevent an infinite spin on a
   * pathological namespace collision.
   */
  let lean: CategoryLean | undefined;
  let attempt = 0;
  const maxAttempts = 10;

  while (attempt < maxAttempts) {
    const slug = attempt === 0 ? baseSlug : `${baseSlug}-${attempt + 1}`;
    try {
      lean = await repoCreate({ ...parsed, slug });
      break;
    } catch (err: unknown) {
      // MongoDB duplicate-key error code.
      const isDuplicate =
        typeof err === "object" &&
        err !== null &&
        "code" in err &&
        (err as { code: unknown }).code === 11000;

      if (!isDuplicate) {
        throw AppError.Internal("Failed to create category.", err);
      }
      attempt++;
    }
  }

  if (!lean) {
    throw AppError.Conflict(
      `Could not create category: slug "${baseSlug}" is taken up to suffix -${maxAttempts + 1}.`,
    );
  }

  revalidateTag(CATEGORIES, "default");

  return toDto(lean);
}

export async function updateCategory(
  id: string,
  patch: CategoryUpdateInput,
): Promise<Category> {
  await requireSession(["admin"]);

  const parsed = categoryUpdateInputSchema.parse(patch);

  const lean = await repoUpdateById(id, parsed);
  if (!lean) throw AppError.NotFound("Category");

  revalidateTag(CATEGORIES, "default");

  return toDto(lean);
}

export async function deleteCategory(id: string): Promise<void> {
  await requireSession(["admin"]);

  const deleted = await repoDeleteById(id);
  if (!deleted) throw AppError.NotFound("Category");

  /*
   * Cross-collection cascade: remove this category's ObjectId from every
   * playlist that references it. This is the one place the service layer
   * touches a Mongoose model directly, rather than going through a repo,
   * because the cascade crosses collection boundaries and belongs to the
   * service-layer's transaction coordination responsibility. A future
   * refactor could expose `pullCategoryFromPlaylists(id)` in playlist.repo.ts
   * once the PlaylistModel includes categoryIds in its schema.
   *
   * NOTE: PlaylistModel.schema does not currently define `categoryIds`.
   * The $pull is harmless today (updateMany matches no paths) and will
   * become load-bearing once P2-A.4 adds the `categoryIds` field to the
   * Playlist schema. The call is placed here now so the cascade is in place
   * before playlists start storing category references.
   */
  await getDb();
  await PlaylistModel.updateMany(
    { categoryIds: id },
    { $pull: { categoryIds: id } },
  );

  revalidateTag(CATEGORIES, "default");
  revalidateTag(PLAYLISTS_HOME, "default");
}
