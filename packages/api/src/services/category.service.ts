import { requireSession } from "../auth/require-session";
import {
  create as repoCreate,
  deleteById as repoDeleteById,
  findAll,
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
import { PLAYLISTS_HOME, CATEGORIES } from "../cache/tags";
import { invalidate } from "../cache/invalidate";
import type { Locale } from "../schemas/locale";
import { slugify } from "../utils/slug";
import type { CategoryLean } from "../repositories/category.repo";

/*
 * Category service — single chokepoint for category CRUD.
 * Categories use embedded ar/en locale objects (Task 1 schema).
 * - Public reads (no session): listCategories, getCategoryBySlug, getCategoryById.
 * - Admin-only mutations begin with requireSession(['admin']) before any I/O.
 * - revalidateTag is called after every mutation that affects cached responses.
 */

// Converts a lean Mongo doc to the public-facing Category DTO.
// The `as { name: string }` casts are adapter-boundary casts: InferSchemaType
// makes nested subdocument fields opaque Mongoose types; we know the runtime
// shape matches the Zod schema, so the casts are safe here.
function toDto(doc: CategoryLean): Category {
  return {
    id: doc._id.toString(),
    ar: {
      name: (doc.ar as { name: string }).name,
      slug: (doc.ar as { slug: string }).slug,
      ...((doc.ar as { description?: string | null }).description != null
        ? { description: (doc.ar as { description: string }).description }
        : {}),
    },
    en: {
      name: (doc.en as { name: string }).name,
      slug: (doc.en as { slug: string }).slug,
      ...((doc.en as { description?: string | null }).description != null
        ? { description: (doc.en as { description: string }).description }
        : {}),
    },
    ...(doc.coverMediaId != null
      ? { coverMediaId: (doc.coverMediaId as { toString(): string }).toString() }
      : {}),
    createdAt: doc.createdAt as Date,
    updatedAt: doc.updatedAt as Date,
  };
}

// ---------------------------------------------------------------------------
// Public reads (no session required)
// ---------------------------------------------------------------------------

export async function listCategories(): Promise<Category[]> {
  const docs = await findAll();
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

  // Auto-generate slugs from names when the caller omits them.
  const arBaseSlug = parsed.ar.slug ?? slugify(parsed.ar.name);
  const enBaseSlug = parsed.en.slug ?? slugify(parsed.en.name);

  /*
   * Slug collision handling: try the base slugs first, then append a numeric
   * suffix (-2, -3, …) on Mongo unique-constraint violations (error code 11000).
   * Bounded at 10 attempts.
   */
  let lean: CategoryLean | undefined;
  let attempt = 0;
  const maxAttempts = 10;

  while (attempt < maxAttempts) {
    const arSlug = attempt === 0 ? arBaseSlug : `${arBaseSlug}-${attempt + 1}`;
    const enSlug = attempt === 0 ? enBaseSlug : `${enBaseSlug}-${attempt + 1}`;
    try {
      lean = await repoCreate({
        ar: {
          name: parsed.ar.name,
          slug: arSlug,
          ...(parsed.ar.description ? { description: parsed.ar.description } : {}),
        },
        en: {
          name: parsed.en.name,
          slug: enSlug,
          ...(parsed.en.description ? { description: parsed.en.description } : {}),
        },
        ...(parsed.coverMediaId ? { coverMediaId: parsed.coverMediaId } : {}),
      });
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
      `Could not create category: slug "${arBaseSlug}" is taken up to suffix -${maxAttempts + 1}.`,
    );
  }

  await invalidate([CATEGORIES]);

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

  await invalidate([CATEGORIES]);

  return toDto(lean);
}

export async function deleteCategory(id: string): Promise<void> {
  await requireSession(["admin"]);

  // Fetch before delete so we have the _id for the cascade pull.
  const existing = await repoFindById(id);
  if (!existing) throw AppError.NotFound("Category");

  const deleted = await repoDeleteById(id);
  if (!deleted) throw AppError.NotFound("Category");

  /*
   * Cross-collection cascade: playlists reference categories by their ObjectId.
   * Pull this category's _id from every playlist that references it directly.
   * Without this, deleting a category leaves dangling categoryIds references.
   */
  await getDb();
  await PlaylistModel.updateMany(
    { categoryIds: existing._id },
    { $pull: { categoryIds: existing._id } },
  );

  await invalidate([PLAYLISTS_HOME, CATEGORIES]);
}
