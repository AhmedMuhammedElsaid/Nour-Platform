import type mongoose from "mongoose";

import { getDb } from "../db/client";
import { CategoryModel, type CategoryDoc } from "../db/models/Category.model";
import type { Locale } from "../schemas/locale";
import type { CategoryCreateInput, CategoryUpdateInput } from "../schemas/category";

/*
 * Lean repository for the `categories` collection. All methods return plain
 * JS objects (`.lean()`) — never Mongoose Documents. Services own the
 * `_id → id` DTO mapping and RBAC checks; this layer is query-only.
 *
 * Categories are per-locale (DATABASE.md §3); `findAll`/`findBySlug` are
 * locale-scoped. `findByContentId` underpins the playlist→category existence
 * check, which links by the locale-agnostic contentId.
 */

export type CategoryLean = CategoryDoc & { _id: mongoose.Types.ObjectId };

export async function findAll(locale: Locale): Promise<CategoryLean[]> {
  await getDb();
  return CategoryModel.find({ locale }).sort({ name: 1 }).lean<CategoryLean[]>();
}

export async function findBySlug(
  locale: Locale,
  slug: string,
): Promise<CategoryLean | null> {
  await getDb();
  return CategoryModel.findOne({ locale, slug }).lean<CategoryLean>();
}

export async function findById(id: string): Promise<CategoryLean | null> {
  await getDb();
  return CategoryModel.findById(id).lean<CategoryLean>();
}

/** First category doc (any locale) for a contentId — existence check helper. */
export async function findByContentId(
  contentId: string,
): Promise<CategoryLean | null> {
  await getDb();
  return CategoryModel.findOne({ contentId }).lean<CategoryLean>();
}

export async function create(
  data: Omit<CategoryCreateInput, "contentId" | "slug"> & {
    slug: string;
    contentId: string;
  },
): Promise<CategoryLean> {
  await getDb();
  // `create()` returns a Mongoose Document; fetch lean immediately so the
  // Document does not escape this function (CLAUDE.md §4.2).
  const doc = await CategoryModel.create(data);
  const lean = await CategoryModel.findById(doc._id).lean<CategoryLean>();
  // `lean` is never null here — we just created the document.
  return lean!;
}

export async function updateById(
  id: string,
  patch: CategoryUpdateInput,
): Promise<CategoryLean | null> {
  await getDb();
  return CategoryModel.findByIdAndUpdate(
    id,
    { $set: patch },
    { new: true },
  ).lean<CategoryLean>();
}

export async function deleteById(id: string): Promise<boolean> {
  await getDb();
  const result = await CategoryModel.deleteOne({ _id: id });
  return result.deletedCount === 1;
}
