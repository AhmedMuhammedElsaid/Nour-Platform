import { revalidateTag } from "next/cache";

import { requireSession } from "../auth/require-session";
import {
  create as repoCreate,
  deleteById as repoDeleteById,
  findAll,
  findByContentId,
  findById as repoFindById,
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
import { categoriesTag, playlistsHomeTag } from "../cache/tags";
import { LOCALES, type Locale } from "../schemas/locale";
import { slugify } from "../utils/slug";
import { newObjectIdString } from "../utils/id";
import type { CategoryLean } from "../repositories/category.repo";

/*
 * Category service — single chokepoint for category CRUD. Categories are
 * per-locale (DATABASE.md §3); playlists reference a category by its
 * locale-agnostic `contentId`.
 * - Public reads (no session): listCategories, getCategoryBySlug — locale-scoped.
 * - Admin-only mutations begin with requireSession(['admin']) before any I/O.
 * - revalidateTag is called after every mutation that affects cached responses.
 */

// Converts a lean Mongo doc to the public-facing Category DTO.
function toDto(doc: CategoryLean): Category {
  return {
    id: doc._id.toString(),
    contentId: (doc.contentId as { toString(): string }).toString(),
    locale: doc.locale as Category["locale"],
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

// ---------------------------------------------------------------------------
// Public reads (no session required) — locale-scoped
// ---------------------------------------------------------------------------

export async function listCategories(locale: Locale): Promise<Category[]> {
  const docs = await findAll(locale);
  return docs.map(toDto);
}

export async function getCategoryBySlug(
  locale: Locale,
  slug: string,
): Promise<Category> {
  const doc = await findBySlug(locale, slug);
  if (!doc) throw AppError.NotFound("Category");
  return toDto(doc);
}

export async function getCategoryById(id: string): Promise<Category | null> {
  const doc = await repoFindById(id);
  if (!doc) return null;
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

  // First locale of a new category mints a contentId; a translation supplies
  // the existing category's contentId to link the locales together.
  const contentId = parsed.contentId ?? newObjectIdString();

  // Auto-generate slug from name when the caller omits it.
  const baseSlug = parsed.slug ?? slugify(parsed.name, contentId);

  /*
   * Slug collision handling: try the base slug first, then append a numeric
   * suffix (-2, -3, …) on Mongo unique-constraint violations (error code 11000).
   * Uniqueness is per (locale, slug), so the same slug may exist in the other
   * locale without collision. Bounded at 10 attempts.
   */
  let lean: CategoryLean | undefined;
  let attempt = 0;
  const maxAttempts = 10;

  const { contentId: _omitContentId, slug: _omitSlug, ...rest } = parsed;

  while (attempt < maxAttempts) {
    const slug = attempt === 0 ? baseSlug : `${baseSlug}-${attempt + 1}`;
    try {
      lean = await repoCreate({ ...rest, slug, contentId });
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

  revalidateTag(categoriesTag(lean.locale as Locale), "default");

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

  revalidateTag(categoriesTag(lean.locale as Locale), "default");

  return toDto(lean);
}

export async function deleteCategory(id: string): Promise<void> {
  await requireSession(["admin"]);

  // Fetch before delete so we have the contentId + locale for the cascade.
  const existing = await repoFindById(id);
  if (!existing) throw AppError.NotFound("Category");

  const deleted = await repoDeleteById(id);
  if (!deleted) throw AppError.NotFound("Category");

  /*
   * Cross-collection cascade: playlists reference a category by its
   * locale-agnostic contentId. Only pull the contentId from playlists when the
   * LAST locale variant of this category is gone — otherwise the link is still
   * valid via the surviving locale. Without this, deleting a category would
   * leave dangling references and the homepage filter would surface a
   * "0 results" facet pointing at a non-existent category. Do not remove.
   */
  const remaining = await findByContentId(existing.contentId.toString());
  if (remaining === null) {
    await getDb();
    await PlaylistModel.updateMany(
      { categoryIds: existing.contentId },
      { $pull: { categoryIds: existing.contentId } },
    );
    // The pull can touch playlists of any locale — revalidate every home list.
    for (const locale of LOCALES) {
      revalidateTag(playlistsHomeTag(locale), "default");
    }
  }

  revalidateTag(categoriesTag(existing.locale as Locale), "default");
}
