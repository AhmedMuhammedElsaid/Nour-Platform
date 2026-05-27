# i18n Embedded Locale Refactor — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace per-locale documents (AR+EN separate docs linked by `contentId`) with single documents that embed locale content under `ar: {}` and `en: {}` keys.

**Architecture:** Each Playlist/Track/Category becomes one MongoDB document. Translated fields (`title`, `slug`, `description`/`name`) live inside `ar` and `en` sub-objects. Shared fields (`status`, `categoryIds`, `mediaId`, `order`, etc.) stay flat. Web RSC pages receive `locale` from the URL and read `doc[locale].title`. Admin forms show both locales at once.

**Tech Stack:** TypeScript strict, Zod v3, Mongoose 8, Next.js 16, TanStack Form v1, next-intl, Vitest, React Testing Library.

---

## File Map

| Layer | Files changed |
|---|---|
| Schemas | `packages/api/src/schemas/playlist.ts`, `track.ts`, `category.ts` |
| Models | `packages/api/src/db/models/playlist.model.ts`, `track.model.ts`, `Category.model.ts` |
| Cache | `packages/api/src/cache/tags.ts` |
| Repos | `packages/api/src/repositories/playlist.repo.ts`, `track.repo.ts`, `category.repo.ts` |
| Services | `packages/api/src/services/playlist.service.ts`, `category.service.ts`, `track.service.ts` |
| Migration | `packages/api/src/db/migrations/0005-embedded-locale.ts` (new), `scripts/migrate.ts` |
| Admin schemas | `apps/admin/features/playlists/schemas/playlist-form.schema.ts`, `apps/admin/features/categories/schemas/category-form.schema.ts` |
| Admin actions | `apps/admin/features/playlists/actions/create-playlist.action.ts`, `update-playlist.action.ts`, `reorder-tracks.action.ts`, `create-track.action.ts` |
| Admin actions | `apps/admin/features/categories/actions/create-category.action.ts`, `update-category.action.ts` |
| Admin forms | `apps/admin/features/playlists/components/playlist-form.tsx`, `apps/admin/features/categories/components/category-form.tsx` |
| Admin components | `apps/admin/features/playlists/components/track-list.tsx`, `track-uploader.tsx` |
| Admin hooks | `apps/admin/features/playlists/hooks/use-track-upload.ts` |
| Admin pages | `apps/admin/app/playlists/new/page.tsx`, `playlists/[id]/edit/page.tsx`, `categories/[id]/edit/page.tsx` |
| Web types | `apps/web/features/playlists/types.ts` |
| Web components | `apps/web/features/playlists/components/playlist-card.tsx` |
| Web pages | `apps/web/app/[locale]/page.tsx`, `apps/web/app/[locale]/playlists/[slug]/page.tsx` |

---

## Task 1: Update Zod Schemas

**Files:**
- Modify: `packages/api/src/schemas/playlist.ts`
- Modify: `packages/api/src/schemas/track.ts`
- Modify: `packages/api/src/schemas/category.ts`

- [ ] **Step 1: Replace `packages/api/src/schemas/playlist.ts`**

```typescript
import { z } from "zod";

const objectIdSchema = z
  .string()
  .regex(/^[0-9a-f]{24}$/, "Invalid ObjectId");

const slugSchema = z
  .string()
  .regex(/^[\p{L}\p{N}]+(?:-[\p{L}\p{N}]+)*$/u, "Invalid slug")
  .min(1)
  .max(200);

export const playlistStatusSchema = z.enum(["draft", "published"]);
export type PlaylistStatus = z.infer<typeof playlistStatusSchema>;

const localeContentSchema = z.object({
  title: z.string().min(1).max(200),
  slug: slugSchema,
  description: z.string().max(2000).optional(),
});

export const playlistSchema = z.object({
  id: objectIdSchema,
  ar: localeContentSchema,
  en: localeContentSchema,
  coverMediaId: objectIdSchema.optional(),
  status: playlistStatusSchema,
  categoryIds: z.array(objectIdSchema),
  createdAt: z.date(),
  updatedAt: z.date(),
});
export type Playlist = z.infer<typeof playlistSchema>;

export const playlistCreateInputSchema = z.object({
  ar: z.object({
    title: z.string().min(1).max(200),
    slug: slugSchema.optional(),
    description: z.string().max(2000).optional(),
  }),
  en: z.object({
    title: z.string().min(1).max(200),
    slug: slugSchema.optional(),
    description: z.string().max(2000).optional(),
  }),
  coverMediaId: objectIdSchema.optional(),
  status: playlistStatusSchema.default("draft"),
  categoryIds: z.array(objectIdSchema).default([]),
});
export type PlaylistCreateInput = z.infer<typeof playlistCreateInputSchema>;

export const playlistUpdateInputSchema = z
  .object({
    ar: z
      .object({
        title: z.string().min(1).max(200),
        slug: slugSchema,
        description: z.string().max(2000),
      })
      .partial(),
    en: z
      .object({
        title: z.string().min(1).max(200),
        slug: slugSchema,
        description: z.string().max(2000),
      })
      .partial(),
    coverMediaId: objectIdSchema.nullable(),
    status: playlistStatusSchema,
    categoryIds: z.array(objectIdSchema),
  })
  .partial();
export type PlaylistUpdateInput = z.infer<typeof playlistUpdateInputSchema>;
```

- [ ] **Step 2: Replace `packages/api/src/schemas/track.ts`**

```typescript
import { z } from "zod";

const objectIdSchema = z
  .string()
  .regex(/^[0-9a-f]{24}$/, "Invalid ObjectId");

const slugSchema = z
  .string()
  .regex(/^[\p{L}\p{N}]+(?:-[\p{L}\p{N}]+)*$/u, "Invalid slug")
  .min(1)
  .max(200);

const localeContentSchema = z.object({
  title: z.string().min(1).max(200),
  slug: slugSchema,
  description: z.string().max(2000).optional(),
});

export const trackSchema = z.object({
  id: objectIdSchema,
  ar: localeContentSchema,
  en: localeContentSchema,
  mediaId: objectIdSchema,
  playlistId: objectIdSchema,
  order: z.number().int().nonnegative(),
  durationSecs: z.number().positive().optional(),
  createdAt: z.date(),
  updatedAt: z.date(),
});
export type Track = z.infer<typeof trackSchema>;

export const trackCreateInputSchema = z.object({
  ar: z.object({
    title: z.string().min(1).max(200),
    slug: slugSchema.optional(),
    description: z.string().max(2000).optional(),
  }),
  en: z.object({
    title: z.string().min(1).max(200),
    slug: slugSchema.optional(),
    description: z.string().max(2000).optional(),
  }),
  mediaId: objectIdSchema,
  playlistId: objectIdSchema,
  order: z.number().int().nonnegative().optional(),
  durationSecs: z.number().positive().optional(),
});
export type TrackCreateInput = z.infer<typeof trackCreateInputSchema>;

export const trackUpdateInputSchema = z
  .object({
    ar: z
      .object({
        title: z.string().min(1).max(200),
        slug: slugSchema,
        description: z.string().max(2000),
      })
      .partial(),
    en: z
      .object({
        title: z.string().min(1).max(200),
        slug: slugSchema,
        description: z.string().max(2000),
      })
      .partial(),
    mediaId: objectIdSchema,
    order: z.number().int().nonnegative(),
    durationSecs: z.number().positive(),
  })
  .partial();
export type TrackUpdateInput = z.infer<typeof trackUpdateInputSchema>;
```

- [ ] **Step 3: Replace `packages/api/src/schemas/category.ts`**

```typescript
import { z } from "zod";

const objectIdSchema = z
  .string()
  .regex(/^[0-9a-f]{24}$/, "Invalid ObjectId");

const slugSchema = z
  .string()
  .regex(/^[\p{L}\p{N}]+(?:-[\p{L}\p{N}]+)*$/u, "Invalid slug")
  .min(1)
  .max(200);

const localeContentSchema = z.object({
  name: z.string().min(1).max(100),
  slug: slugSchema,
  description: z.string().max(500).optional(),
});

export const categorySchema = z.object({
  id: objectIdSchema,
  ar: localeContentSchema,
  en: localeContentSchema,
  coverMediaId: objectIdSchema.optional(),
  createdAt: z.date(),
  updatedAt: z.date(),
});
export type Category = z.infer<typeof categorySchema>;

export const categoryCreateInputSchema = z.object({
  ar: z.object({
    name: z.string().min(1).max(100),
    slug: slugSchema.optional(),
    description: z.string().max(500).optional(),
  }),
  en: z.object({
    name: z.string().min(1).max(100),
    slug: slugSchema.optional(),
    description: z.string().max(500).optional(),
  }),
  coverMediaId: objectIdSchema.optional(),
});
export type CategoryCreateInput = z.infer<typeof categoryCreateInputSchema>;

export const categoryUpdateInputSchema = z
  .object({
    ar: z
      .object({
        name: z.string().min(1).max(100),
        slug: slugSchema,
        description: z.string().max(500),
      })
      .partial(),
    en: z
      .object({
        name: z.string().min(1).max(100),
        slug: slugSchema,
        description: z.string().max(500),
      })
      .partial(),
    coverMediaId: objectIdSchema.nullable(),
  })
  .partial();
export type CategoryUpdateInput = z.infer<typeof categoryUpdateInputSchema>;
```

- [ ] **Step 4: Commit**

```bash
git add packages/api/src/schemas/playlist.ts packages/api/src/schemas/track.ts packages/api/src/schemas/category.ts
git commit -m "[AhmedMuhammedElsaid][wip]: embed ar/en locale fields in Zod schemas"
```

---

## Task 2: Update Mongoose Models

**Files:**
- Modify: `packages/api/src/db/models/playlist.model.ts`
- Modify: `packages/api/src/db/models/track.model.ts`
- Modify: `packages/api/src/db/models/Category.model.ts`

- [ ] **Step 1: Replace `packages/api/src/db/models/playlist.model.ts`**

```typescript
import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

const localeContentSchema = new Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 200 },
    slug: { type: String, required: true, lowercase: true, trim: true, maxlength: 200 },
    description: { type: String, maxlength: 2000 },
  },
  { _id: false },
);

const playlistSchema = new Schema(
  {
    ar: { type: localeContentSchema, required: true },
    en: { type: localeContentSchema, required: true },
    coverMediaId: { type: Schema.Types.ObjectId, ref: "Media" },
    status: {
      type: String,
      enum: ["draft", "published"],
      required: true,
      default: "draft",
    },
    categoryIds: [{ type: Schema.Types.ObjectId, default: [] }],
  },
  { timestamps: true, collection: "playlists" },
);

playlistSchema.index({ "ar.slug": 1 }, { unique: true });
playlistSchema.index({ "en.slug": 1 }, { unique: true });
playlistSchema.index({ status: 1, updatedAt: -1 });

export type PlaylistDoc = InferSchemaType<typeof playlistSchema> & {
  _id: mongoose.Types.ObjectId;
};

type PlaylistModelType = Model<PlaylistDoc>;

export const PlaylistModel: PlaylistModelType =
  (mongoose.models.Playlist as PlaylistModelType | undefined) ??
  mongoose.model<PlaylistDoc>("Playlist", playlistSchema);
```

- [ ] **Step 2: Replace `packages/api/src/db/models/track.model.ts`**

```typescript
import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

const localeContentSchema = new Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 200 },
    slug: { type: String, required: true, lowercase: true, trim: true, maxlength: 200 },
    description: { type: String, maxlength: 2000 },
  },
  { _id: false },
);

const trackSchema = new Schema(
  {
    ar: { type: localeContentSchema, required: true },
    en: { type: localeContentSchema, required: true },
    mediaId: { type: Schema.Types.ObjectId, ref: "Media", required: true },
    playlistId: { type: Schema.Types.ObjectId, required: true },
    order: { type: Number, required: true, min: 0 },
    durationSecs: { type: Number, min: 0 },
  },
  { timestamps: true, collection: "tracks" },
);

trackSchema.index({ "ar.slug": 1, playlistId: 1 }, { unique: true });
trackSchema.index({ "en.slug": 1, playlistId: 1 }, { unique: true });
trackSchema.index({ playlistId: 1, order: 1 });

export type TrackDoc = InferSchemaType<typeof trackSchema> & {
  _id: mongoose.Types.ObjectId;
};

type TrackModelType = Model<TrackDoc>;

export const TrackModel: TrackModelType =
  (mongoose.models.Track as TrackModelType | undefined) ??
  mongoose.model<TrackDoc>("Track", trackSchema);
```

- [ ] **Step 3: Replace `packages/api/src/db/models/Category.model.ts`**

```typescript
import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

const localeContentSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 100 },
    slug: { type: String, required: true, lowercase: true, trim: true, maxlength: 200 },
    description: { type: String, maxlength: 500 },
  },
  { _id: false },
);

const categorySchema = new Schema(
  {
    ar: { type: localeContentSchema, required: true },
    en: { type: localeContentSchema, required: true },
    coverMediaId: { type: Schema.Types.ObjectId, ref: "Media" },
  },
  { timestamps: true, collection: "categories" },
);

categorySchema.index({ "ar.slug": 1 }, { unique: true });
categorySchema.index({ "en.slug": 1 }, { unique: true });

export type CategoryDoc = InferSchemaType<typeof categorySchema> & {
  _id: mongoose.Types.ObjectId;
};

type CategoryModelType = Model<CategoryDoc>;

export const CategoryModel: CategoryModelType =
  (mongoose.models.Category as CategoryModelType | undefined) ??
  mongoose.model<CategoryDoc>("Category", categorySchema);
```

- [ ] **Step 4: Commit**

```bash
git add packages/api/src/db/models/playlist.model.ts packages/api/src/db/models/track.model.ts packages/api/src/db/models/Category.model.ts
git commit -m "[AhmedMuhammedElsaid][wip]: update Mongoose models for embedded locale"
```

---

## Task 3: Update Cache Tags

**Files:**
- Modify: `packages/api/src/cache/tags.ts`

- [ ] **Step 1: Replace `packages/api/src/cache/tags.ts`**

```typescript
export const PLAYLISTS_HOME = "playlists:home";

export function playlistTag(id: string): string {
  return `playlist:${id}`;
}

export const CATEGORIES = "categories";
```

- [ ] **Step 2: Commit**

```bash
git add packages/api/src/cache/tags.ts
git commit -m "[AhmedMuhammedElsaid][wip]: simplify cache tags — drop locale scope"
```

---

## Task 4: Update Repositories

**Files:**
- Modify: `packages/api/src/repositories/playlist.repo.ts`
- Modify: `packages/api/src/repositories/track.repo.ts`
- Modify: `packages/api/src/repositories/category.repo.ts`

- [ ] **Step 1: Replace `packages/api/src/repositories/playlist.repo.ts`**

```typescript
import type mongoose from "mongoose";

import { getDb } from "../db/client";
import { PlaylistModel, type PlaylistDoc } from "../db/models/playlist.model";
import type { Locale } from "../schemas/locale";
import type { PlaylistCreateInput, PlaylistUpdateInput } from "../schemas/playlist";

export type PlaylistLean = PlaylistDoc & { _id: mongoose.Types.ObjectId };

export async function findPlaylistById(id: string): Promise<PlaylistLean | null> {
  await getDb();
  return PlaylistModel.findById(id).lean<PlaylistLean>();
}

export async function findPlaylistBySlug(
  locale: Locale,
  slug: string,
): Promise<PlaylistLean | null> {
  await getDb();
  const field = locale === "ar" ? "ar.slug" : "en.slug";
  return PlaylistModel.findOne({ [field]: slug }).lean<PlaylistLean>();
}

export async function findPublishedPlaylists(
  filter?: { categoryId?: string },
): Promise<PlaylistLean[]> {
  await getDb();
  const query: Record<string, unknown> = { status: "published" };
  if (filter?.categoryId != null) {
    query["categoryIds"] = filter.categoryId;
  }
  return PlaylistModel.find(query).sort({ updatedAt: -1 }).lean<PlaylistLean[]>();
}

export async function findAllPlaylists(): Promise<PlaylistLean[]> {
  await getDb();
  return PlaylistModel.find({}).sort({ updatedAt: -1 }).lean<PlaylistLean[]>();
}

export async function createPlaylist(
  data: Omit<PlaylistCreateInput, "ar" | "en"> & {
    ar: { title: string; slug: string; description?: string };
    en: { title: string; slug: string; description?: string };
  },
): Promise<PlaylistLean> {
  await getDb();
  const doc = await PlaylistModel.create(data);
  const lean = await PlaylistModel.findById(doc._id).lean<PlaylistLean>();
  return lean!;
}

export async function updatePlaylistById(
  id: string,
  update: PlaylistUpdateInput,
): Promise<PlaylistLean | null> {
  await getDb();
  return PlaylistModel.findByIdAndUpdate(id, { $set: update }, { new: true }).lean<PlaylistLean>();
}

export async function deletePlaylistById(id: string): Promise<boolean> {
  await getDb();
  const result = await PlaylistModel.deleteOne({ _id: id });
  return result.deletedCount === 1;
}
```

- [ ] **Step 2: Replace `packages/api/src/repositories/track.repo.ts`**

```typescript
import type mongoose from "mongoose";

import { getDb } from "../db/client";
import { TrackModel, type TrackDoc } from "../db/models/track.model";
import type { Locale } from "../schemas/locale";
import type { TrackCreateInput, TrackUpdateInput } from "../schemas/track";

export type TrackLean = TrackDoc & { _id: mongoose.Types.ObjectId };

export async function findTrackById(id: string): Promise<TrackLean | null> {
  await getDb();
  return TrackModel.findById(id).lean<TrackLean>();
}

export async function findTracksByPlaylist(
  playlistId: string,
): Promise<TrackLean[]> {
  await getDb();
  return TrackModel.find({ playlistId })
    .sort({ order: 1 })
    .lean<TrackLean[]>();
}

export async function findTrackBySlug(
  locale: Locale,
  playlistId: string,
  slug: string,
): Promise<TrackLean | null> {
  await getDb();
  const field = locale === "ar" ? "ar.slug" : "en.slug";
  return TrackModel.findOne({ playlistId, [field]: slug }).lean<TrackLean>();
}

export async function createTrack(
  data: Omit<TrackCreateInput, "ar" | "en" | "order"> & {
    ar: { title: string; slug: string; description?: string };
    en: { title: string; slug: string; description?: string };
    order: number;
  },
): Promise<TrackLean> {
  await getDb();
  const doc = await TrackModel.create(data);
  const lean = await TrackModel.findById(doc._id).lean<TrackLean>();
  return lean!;
}

export async function updateTrackById(
  id: string,
  update: TrackUpdateInput,
): Promise<TrackLean | null> {
  await getDb();
  return TrackModel.findByIdAndUpdate(id, { $set: update }, { new: true }).lean<TrackLean>();
}

export async function deleteTrackById(id: string): Promise<boolean> {
  await getDb();
  const result = await TrackModel.deleteOne({ _id: id });
  return result.deletedCount === 1;
}

export async function updateTrackOrder(orderedIds: string[]): Promise<void> {
  await getDb();
  const ops = orderedIds.map((id, index) => ({
    updateOne: {
      filter: { _id: id },
      update: { $set: { order: index } },
    },
  }));
  if (ops.length > 0) {
    await TrackModel.bulkWrite(ops);
  }
}
```

- [ ] **Step 3: Replace `packages/api/src/repositories/category.repo.ts`**

```typescript
import type mongoose from "mongoose";

import { getDb } from "../db/client";
import { CategoryModel, type CategoryDoc } from "../db/models/Category.model";
import type { Locale } from "../schemas/locale";
import type { CategoryCreateInput, CategoryUpdateInput } from "../schemas/category";

export type CategoryLean = CategoryDoc & { _id: mongoose.Types.ObjectId };

export async function findAll(): Promise<CategoryLean[]> {
  await getDb();
  return CategoryModel.find({}).sort({ "ar.name": 1 }).lean<CategoryLean[]>();
}

export async function findBySlug(
  locale: Locale,
  slug: string,
): Promise<CategoryLean | null> {
  await getDb();
  const field = locale === "ar" ? "ar.slug" : "en.slug";
  return CategoryModel.findOne({ [field]: slug }).lean<CategoryLean>();
}

export async function findById(id: string): Promise<CategoryLean | null> {
  await getDb();
  return CategoryModel.findById(id).lean<CategoryLean>();
}

export async function create(
  data: Omit<CategoryCreateInput, "ar" | "en"> & {
    ar: { name: string; slug: string; description?: string };
    en: { name: string; slug: string; description?: string };
  },
): Promise<CategoryLean> {
  await getDb();
  const doc = await CategoryModel.create(data);
  const lean = await CategoryModel.findById(doc._id).lean<CategoryLean>();
  return lean!;
}

export async function updateById(
  id: string,
  patch: CategoryUpdateInput,
): Promise<CategoryLean | null> {
  await getDb();
  return CategoryModel.findByIdAndUpdate(id, { $set: patch }, { new: true }).lean<CategoryLean>();
}

export async function deleteById(id: string): Promise<boolean> {
  await getDb();
  const result = await CategoryModel.deleteOne({ _id: id });
  return result.deletedCount === 1;
}
```

- [ ] **Step 4: Commit**

```bash
git add packages/api/src/repositories/
git commit -m "[AhmedMuhammedElsaid][wip]: update repos for embedded locale schema"
```

---

## Task 5: Update Playlist Service

**Files:**
- Modify: `packages/api/src/services/playlist.service.ts`
- Modify: `packages/api/src/services/playlist.service.test.ts`

- [ ] **Step 1: Replace `packages/api/src/services/playlist.service.ts`**

```typescript
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
// Public reads
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
  if (session.user.role !== "admin") throw AppError.Forbidden(["admin"]);
  const docs = await findAllPlaylists();
  return docs.map(toDto);
}

export async function getPlaylistById(
  id: string,
  session: Session & { user: NonNullable<Session["user"]> },
): Promise<Playlist | null> {
  if (session.user.role !== "admin") throw AppError.Forbidden(["admin"]);
  const doc = await findPlaylistById(id);
  return doc ? toDto(doc) : null;
}

// ---------------------------------------------------------------------------
// Admin mutations
// ---------------------------------------------------------------------------

export async function createPlaylist(input: PlaylistCreateInput): Promise<Playlist> {
  await requireSession(["admin"]);

  const parsed = playlistCreateInputSchema.parse(input);

  if (parsed.categoryIds.length > 0) {
    for (const categoryId of parsed.categoryIds) {
      const exists = await findCategoryById(categoryId);
      if (exists === null) throw AppError.NotFound(`Category not found: ${categoryId}`);
    }
  }

  const arSlug = parsed.ar.slug ?? slugify(parsed.ar.title);
  const enSlug = parsed.en.slug ?? slugify(parsed.en.title);

  const { ar, en, ...rest } = parsed;
  const lean = await repoCreatePlaylist({
    ...rest,
    ar: { title: ar.title, slug: arSlug, ...(ar.description ? { description: ar.description } : {}) },
    en: { title: en.title, slug: enSlug, ...(en.description ? { description: en.description } : {}) },
  });

  return toDto(lean);
}

export async function updatePlaylist(
  id: string,
  input: PlaylistUpdateInput,
): Promise<Playlist> {
  await requireSession(["admin"]);

  const parsed = playlistUpdateInputSchema.parse(input);

  if (parsed.categoryIds != null && parsed.categoryIds.length > 0) {
    for (const categoryId of parsed.categoryIds) {
      const exists = await findCategoryById(categoryId);
      if (exists === null) throw AppError.NotFound(`Category not found: ${categoryId}`);
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
```

- [ ] **Step 2: Update `packages/api/src/services/playlist.service.test.ts`**

Open the file and update it: replace all references to `locale`, `contentId`, `title`/`slug` flat fields with the new shape. Key patterns to change:

- Mock playlist docs must include `ar: { title, slug }` and `en: { title, slug }` instead of `locale`, `contentId`, `title`, `slug`
- `getPublishedPlaylists(locale)` → `getPublishedPlaylists()` (no locale arg)
- `getPlaylistBySlug(locale, slug)` stays the same signature
- `createPlaylist({ locale, title, ... })` → `createPlaylist({ ar: { title }, en: { title }, ... })`
- `revalidateTag` assertions: `playlistsHomeTag(locale)` → `PLAYLISTS_HOME`, `playlistTag(locale, slug)` → `playlistTag(id)`

Example updated mock doc shape to use throughout the test file:
```typescript
const mockPlaylistDoc = {
  _id: { toString: () => "playlist123456789012" },
  ar: { title: "عنوان", slug: "عنوان", description: undefined },
  en: { title: "Title", slug: "title", description: undefined },
  coverMediaId: null,
  status: "published",
  categoryIds: [],
  createdAt: new Date("2024-01-01"),
  updatedAt: new Date("2024-01-01"),
};
```

- [ ] **Step 3: Run playlist service tests**

```bash
cd "D:\CodeLab\Nour Platform" && pnpm turbo run test --filter=@repo/api
```

Expected: all playlist.service tests pass.

- [ ] **Step 4: Commit**

```bash
git add packages/api/src/services/playlist.service.ts packages/api/src/services/playlist.service.test.ts
git commit -m "[AhmedMuhammedElsaid][wip]: update playlist service for embedded locale"
```

---

## Task 6: Update Category Service

**Files:**
- Modify: `packages/api/src/services/category.service.ts`
- Modify: `packages/api/src/services/category.service.test.ts`

- [ ] **Step 1: Replace `packages/api/src/services/category.service.ts`**

```typescript
import { revalidateTag } from "next/cache";

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
import type { Locale } from "../schemas/locale";
import { slugify } from "../utils/slug";
import type { CategoryLean } from "../repositories/category.repo";

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
// Public reads
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

export async function createCategory(input: CategoryCreateInput): Promise<Category> {
  await requireSession(["admin"]);

  const parsed = categoryCreateInputSchema.parse(input);

  const arBaseSlug = parsed.ar.slug ?? slugify(parsed.ar.name);
  const enBaseSlug = parsed.en.slug ?? slugify(parsed.en.name);

  let lean: CategoryLean | undefined;
  let attempt = 0;
  const maxAttempts = 10;

  while (attempt < maxAttempts) {
    const arSlug = attempt === 0 ? arBaseSlug : `${arBaseSlug}-${attempt + 1}`;
    const enSlug = attempt === 0 ? enBaseSlug : `${enBaseSlug}-${attempt + 1}`;
    try {
      lean = await repoCreate({
        ar: { name: parsed.ar.name, slug: arSlug, ...(parsed.ar.description ? { description: parsed.ar.description } : {}) },
        en: { name: parsed.en.name, slug: enSlug, ...(parsed.en.description ? { description: parsed.en.description } : {}) },
        ...(parsed.coverMediaId ? { coverMediaId: parsed.coverMediaId } : {}),
      });
      break;
    } catch (err: unknown) {
      const isDuplicate =
        typeof err === "object" &&
        err !== null &&
        "code" in err &&
        (err as { code: unknown }).code === 11000;
      if (!isDuplicate) throw AppError.Internal("Failed to create category.", err);
      attempt++;
    }
  }

  if (!lean) {
    throw AppError.Conflict(
      `Could not create category: slug "${arBaseSlug}" is taken up to suffix -${maxAttempts + 1}.`,
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

  const existing = await repoFindById(id);
  if (!existing) throw AppError.NotFound("Category");

  const deleted = await repoDeleteById(id);
  if (!deleted) throw AppError.NotFound("Category");

  // Cascade: pull this category's _id from every playlist that references it.
  await getDb();
  await PlaylistModel.updateMany(
    { categoryIds: existing._id },
    { $pull: { categoryIds: existing._id } },
  );

  revalidateTag(PLAYLISTS_HOME, "default");
  revalidateTag(CATEGORIES, "default");
}
```

- [ ] **Step 2: Update `packages/api/src/services/category.service.test.ts`**

Update the test file: replace all references to `locale`, `contentId`, `name`/`slug` flat fields with the new shape. Key patterns:

- Mock category docs must have `ar: { name, slug }` and `en: { name, slug }` instead of `locale`, `contentId`, `name`, `slug`
- `listCategories(locale)` → `listCategories()` (no locale arg)
- `getCategoryBySlug(locale, slug)` same signature
- `createCategory({ locale, name, ... })` → `createCategory({ ar: { name }, en: { name }, ... })`
- `revalidateTag` assertions: `categoriesTag(locale)` → `CATEGORIES`, `playlistsHomeTag(locale)` → `PLAYLISTS_HOME`

Example updated mock doc shape:
```typescript
const mockCategoryDoc = {
  _id: { toString: () => "cat1234567890123456" },
  ar: { name: "فئة", slug: "فئة" },
  en: { name: "Category", slug: "category" },
  coverMediaId: null,
  createdAt: new Date("2024-01-01"),
  updatedAt: new Date("2024-01-01"),
};
```

- [ ] **Step 3: Run category service tests**

```bash
pnpm turbo run test --filter=@repo/api
```

Expected: all category.service tests pass.

- [ ] **Step 4: Commit**

```bash
git add packages/api/src/services/category.service.ts packages/api/src/services/category.service.test.ts
git commit -m "[AhmedMuhammedElsaid][wip]: update category service for embedded locale"
```

---

## Task 7: Update Track Service

**Files:**
- Modify: `packages/api/src/services/track.service.ts`
- Modify: `packages/api/src/services/track.service.test.ts`

- [ ] **Step 1: Replace `packages/api/src/services/track.service.ts`**

```typescript
import { revalidateTag } from "next/cache";

import { env } from "@repo/config/env";

import { requireSession } from "../auth/require-session";
import { playlistTag } from "../cache/tags";
import { findMediaById } from "../repositories/media.repo";
import { findPlaylistById } from "../repositories/playlist.repo";
import {
  createTrack as repoCreateTrack,
  deleteTrackById,
  findTrackById,
  findTracksByPlaylist,
  updateTrackById,
  updateTrackOrder,
} from "../repositories/track.repo";
import { AppError } from "../errors";
import {
  trackCreateInputSchema,
  trackUpdateInputSchema,
  type Track,
  type TrackCreateInput,
  type TrackUpdateInput,
} from "../schemas/track";
import { slugify } from "../utils/slug";

export interface PlayableTrack extends Track {
  srcUrl: string | null;
}

function toDto(doc: {
  _id: { toString(): string };
  ar: { title: string; slug: string; description?: string | null };
  en: { title: string; slug: string; description?: string | null };
  mediaId: { toString(): string };
  playlistId: { toString(): string };
  order: number;
  durationSecs?: number | null;
  createdAt: Date;
  updatedAt: Date;
}): Track {
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
    mediaId: doc.mediaId.toString(),
    playlistId: doc.playlistId.toString(),
    order: doc.order,
    ...(doc.durationSecs != null ? { durationSecs: doc.durationSecs } : {}),
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

// ---------------------------------------------------------------------------
// Public reads
// ---------------------------------------------------------------------------

export async function getTracksByPlaylist(playlistId: string): Promise<Track[]> {
  const docs = await findTracksByPlaylist(playlistId);
  return docs.map(toDto);
}

export async function getTracksWithUrls(playlistId: string): Promise<PlayableTrack[]> {
  const docs = await findTracksByPlaylist(playlistId);
  const tracks = docs.map(toDto);

  const base = env.R2_PUBLIC_BASE;
  if (!base) return tracks.map((t) => ({ ...t, srcUrl: null }));

  const mediaDocs = await Promise.all(
    docs.map((doc) => findMediaById(doc.mediaId.toString())),
  );

  return tracks.map((t, i) => {
    const media = mediaDocs[i];
    return { ...t, srcUrl: media?.key ? `${base}/${media.key}` : null };
  });
}

export async function getTrackById(id: string): Promise<Track | null> {
  const doc = await findTrackById(id);
  return doc ? toDto(doc) : null;
}

// ---------------------------------------------------------------------------
// Admin mutations
// ---------------------------------------------------------------------------

export async function createTrack(input: TrackCreateInput): Promise<Track> {
  await requireSession(["admin"]);

  const parsed = trackCreateInputSchema.parse(input);

  // Verify the parent playlist exists before creating the track.
  const playlist = await findPlaylistById(parsed.playlistId);
  if (!playlist) throw AppError.NotFound("Playlist");

  const arSlug = parsed.ar.slug ?? slugify(parsed.ar.title);
  const enSlug = parsed.en.slug ?? slugify(parsed.en.title);

  const existing = await findTracksByPlaylist(parsed.playlistId);
  const order = parsed.order ?? existing.length;

  const { ar, en, order: _omitOrder, ...rest } = parsed;
  const lean = await repoCreateTrack({
    ...rest,
    ar: { title: ar.title, slug: arSlug, ...(ar.description ? { description: ar.description } : {}) },
    en: { title: en.title, slug: enSlug, ...(en.description ? { description: en.description } : {}) },
    order,
  });

  revalidateTag(playlistTag(parsed.playlistId), "default");

  return toDto(lean);
}

export async function updateTrack(id: string, input: TrackUpdateInput): Promise<Track> {
  await requireSession(["admin"]);

  const parsed = trackUpdateInputSchema.parse(input);

  const lean = await updateTrackById(id, parsed);
  if (!lean) throw AppError.NotFound("Track");

  revalidateTag(playlistTag(lean.playlistId.toString()), "default");

  return toDto(lean);
}

export async function deleteTrack(id: string): Promise<void> {
  await requireSession(["admin"]);

  const existing = await findTrackById(id);
  if (!existing) throw AppError.NotFound("Track");

  await deleteTrackById(id);

  revalidateTag(playlistTag(existing.playlistId.toString()), "default");
}

export async function reorderTracks(
  playlistId: string,
  orderedTrackIds: string[],
): Promise<void> {
  await requireSession(["admin"]);

  const playlist = await findPlaylistById(playlistId);
  if (!playlist) throw AppError.NotFound("Playlist");

  await updateTrackOrder(orderedTrackIds);

  revalidateTag(playlistTag(playlistId), "default");
}
```

- [ ] **Step 2: Update `packages/api/src/services/track.service.test.ts`**

Update the test file with the new shape. Key patterns:

- Mock track docs must have `ar: { title, slug }` and `en: { title, slug }` instead of `locale`, `contentId`, `title`, `slug`; `playlistId` instead of `playlistContentId`
- `getTracksByPlaylist(locale, playlistContentId)` → `getTracksByPlaylist(playlistId)`
- `getTracksWithUrls(locale, playlistContentId)` → `getTracksWithUrls(playlistId)`
- `createTrack({ locale, title, playlistContentId, ... })` → `createTrack({ ar: { title }, en: { title }, playlistId, ... })`
- `reorderTracks(locale, playlistContentId, ids)` → `reorderTracks(playlistId, ids)`
- `revalidateTag` assertions: `playlistTag(locale, slug)` → `playlistTag(id)`

Example updated mock track doc shape:
```typescript
const mockTrackDoc = {
  _id: { toString: () => "track1234567890123" },
  ar: { title: "عنوان", slug: "عنوان" },
  en: { title: "Title", slug: "title" },
  mediaId: { toString: () => "media1234567890123" },
  playlistId: { toString: () => "playlist12345678901" },
  order: 0,
  createdAt: new Date("2024-01-01"),
  updatedAt: new Date("2024-01-01"),
};
```

- [ ] **Step 3: Run all API tests**

```bash
pnpm turbo run test --filter=@repo/api
```

Expected: all 49+ API tests pass.

- [ ] **Step 4: Commit**

```bash
git add packages/api/src/services/track.service.ts packages/api/src/services/track.service.test.ts
git commit -m "[AhmedMuhammedElsaid][wip]: update track service for embedded locale"
```

---

## Task 8: Write Migration 0005 + Update Runner

**Files:**
- Create: `packages/api/src/db/migrations/0005-embedded-locale.ts`
- Modify: `scripts/migrate.ts`

- [ ] **Step 1: Create `packages/api/src/db/migrations/0005-embedded-locale.ts`**

```typescript
import { getDb } from "../client";
import { PlaylistModel } from "../models/playlist.model";
import { TrackModel } from "../models/track.model";
import { CategoryModel } from "../models/Category.model";

/*
 * Migration 0005: collapse per-locale documents into single embedded-locale docs.
 *
 * Each collection previously stored separate AR and EN documents linked by `contentId`.
 * After this migration each entity is a single document with `ar: {}` and `en: {}` keys.
 *
 * Run order: must execute BEFORE 0001/0002 (ensureIndexes) so the new compound
 * slug indexes build on already-migrated data.
 *
 * Idempotent: documents that already have an `ar` sub-object are skipped.
 */
export const name = "0005-embedded-locale";

export async function up(): Promise<void> {
  const conn = await getDb();
  const db = conn.connection.db!;

  const cats = db.collection("categories");
  const playlists = db.collection("playlists");
  const tracks = db.collection("tracks");

  // Drop all non-_id indexes first so old unique constraints
  // don't block the document mutations below.
  await cats.dropIndexes();
  await playlists.dropIndexes();
  await tracks.dropIndexes();

  // ---- 1. Merge Category documents ----
  // Build contentId → surviving _id map for playlist re-linking.
  const categoryIdMap = new Map<string, unknown>();

  const catContentIds: unknown[] = await cats.distinct("contentId");
  for (const contentId of catContentIds) {
    const docs = await cats.find({ contentId }).toArray();
    const ar = docs.find((d) => d["locale"] === "ar");
    const en = docs.find((d) => d["locale"] === "en");

    // Skip already-migrated documents (no `locale` field means already embedded).
    if (!ar && !en) continue;
    const survivor = ar ?? en!;
    const victim = ar && en ? en : null;

    await cats.updateOne(
      { _id: survivor._id },
      {
        $set: {
          ar: {
            name: ar?.["name"] ?? en!["name"],
            slug: ar?.["slug"] ?? en!["slug"],
            ...(ar?.["description"] ? { description: ar["description"] } : {}),
          },
          en: {
            name: en?.["name"] ?? ar!["name"],
            slug: en?.["slug"] ?? ar!["slug"],
            ...(en?.["description"] ? { description: en["description"] } : {}),
          },
        },
        $unset: { contentId: "", locale: "", name: "", slug: "", description: "" },
      },
    );

    if (victim) await cats.deleteOne({ _id: victim._id });
    categoryIdMap.set(String(contentId), survivor._id);
  }

  // ---- 2. Merge Playlist documents ----
  const playlistIdMap = new Map<string, unknown>();

  const playlistContentIds: unknown[] = await playlists.distinct("contentId");
  for (const contentId of playlistContentIds) {
    const docs = await playlists.find({ contentId }).toArray();
    const ar = docs.find((d) => d["locale"] === "ar");
    const en = docs.find((d) => d["locale"] === "en");

    if (!ar && !en) continue;
    const survivor = ar ?? en!;
    const victim = ar && en ? en : null;

    // Remap categoryIds: old values were category contentIds → new values are category _ids.
    const oldCategoryIds: unknown[] = survivor["categoryIds"] ?? [];
    const newCategoryIds = oldCategoryIds.map(
      (cid) => categoryIdMap.get(String(cid)) ?? cid,
    );

    await playlists.updateOne(
      { _id: survivor._id },
      {
        $set: {
          ar: {
            title: ar?.["title"] ?? en!["title"],
            slug: ar?.["slug"] ?? en!["slug"],
            ...(ar?.["description"] ? { description: ar["description"] } : {}),
          },
          en: {
            title: en?.["title"] ?? ar!["title"],
            slug: en?.["slug"] ?? ar!["slug"],
            ...(en?.["description"] ? { description: en["description"] } : {}),
          },
          categoryIds: newCategoryIds,
        },
        $unset: { contentId: "", locale: "", title: "", slug: "", description: "" },
      },
    );

    if (victim) await playlists.deleteOne({ _id: victim._id });
    playlistIdMap.set(String(contentId), survivor._id);
  }

  // ---- 3. Merge Track documents ----
  const trackContentIds: unknown[] = await tracks.distinct("contentId");
  for (const contentId of trackContentIds) {
    const docs = await tracks.find({ contentId }).toArray();
    const ar = docs.find((d) => d["locale"] === "ar");
    const en = docs.find((d) => d["locale"] === "en");

    if (!ar && !en) continue;
    const survivor = ar ?? en!;
    const victim = ar && en ? en : null;

    // Remap playlistContentId → playlistId (the surviving playlist's _id).
    const oldPlaylistContentId = survivor["playlistContentId"];
    const newPlaylistId =
      playlistIdMap.get(String(oldPlaylistContentId)) ?? oldPlaylistContentId;

    await tracks.updateOne(
      { _id: survivor._id },
      {
        $set: {
          ar: {
            title: ar?.["title"] ?? en!["title"],
            slug: ar?.["slug"] ?? en!["slug"],
            ...(ar?.["description"] ? { description: ar["description"] } : {}),
          },
          en: {
            title: en?.["title"] ?? ar!["title"],
            slug: en?.["slug"] ?? ar!["slug"],
            ...(en?.["description"] ? { description: en["description"] } : {}),
          },
          playlistId: newPlaylistId,
        },
        $unset: {
          contentId: "",
          locale: "",
          title: "",
          slug: "",
          description: "",
          playlistContentId: "",
        },
      },
    );

    if (victim) await tracks.deleteOne({ _id: victim._id });
  }

  // ---- 4. Rebuild indexes on the new schema ----
  await CategoryModel.ensureIndexes();
  await PlaylistModel.ensureIndexes();
  await TrackModel.ensureIndexes();
}
```

- [ ] **Step 2: Update `scripts/migrate.ts`** — add 0005 import and insert it before 0001/0002

Replace the imports section and migrations array:

```typescript
import * as migration0003 from "@repo/api/db/migrations/0003-i18n-backfill";
import * as migration0004 from "@repo/api/db/migrations/0004-i18n-indexes";
import * as migration0005 from "@repo/api/db/migrations/0005-embedded-locale";
import * as migration0001 from "@repo/api/db/migrations/0001-indexes";
import * as migration0002 from "@repo/api/db/migrations/0002-category-indexes";
```

And the migrations array:
```typescript
const migrations: Migration[] = [
  migration0003,
  migration0004,
  migration0005, // merge AR/EN docs → embedded locale; drops old indexes, rebuilds new
  migration0001, // ensureIndexes runs on new schema after 0005 has rebuilt them — no-op
  migration0002, // same
];
```

- [ ] **Step 3: Run migration dry-run to validate**

```bash
pnpm tsx scripts/migrate.ts --dry-run
```

Expected output:
```
[migrate] dry-run mode — no indexes will be created.
[migrate] would run: 0003-i18n-backfill
[migrate] would run: 0004-i18n-indexes
[migrate] would run: 0005-embedded-locale
[migrate] would run: 0001-indexes
[migrate] would run: 0002-category-indexes
[migrate] dry-run complete. No changes made.
```

- [ ] **Step 4: Commit**

```bash
git add packages/api/src/db/migrations/0005-embedded-locale.ts scripts/migrate.ts
git commit -m "[AhmedMuhammedElsaid][wip]: add migration 0005 to merge AR/EN documents"
```

---

## Task 9: Admin Playlist Form Schema, Actions, Pages

**Files:**
- Modify: `apps/admin/features/playlists/schemas/playlist-form.schema.ts`
- Modify: `apps/admin/features/playlists/actions/create-playlist.action.ts`
- Modify: `apps/admin/features/playlists/actions/update-playlist.action.ts`
- Modify: `apps/admin/features/playlists/actions/reorder-tracks.action.ts`
- Modify: `apps/admin/app/playlists/new/page.tsx`
- Modify: `apps/admin/app/playlists/[id]/edit/page.tsx`

- [ ] **Step 1: Replace `apps/admin/features/playlists/schemas/playlist-form.schema.ts`**

```typescript
import { z } from "zod";

export const playlistFormSchema = z.object({
  ar: z.object({
    title: z.string().min(1, "Arabic title is required.").max(200, "Too long."),
    description: z.string().max(2000, "Too long."),
  }),
  en: z.object({
    title: z.string().min(1, "English title is required.").max(200, "Too long."),
    description: z.string().max(2000, "Too long."),
  }),
  status: z.enum(["draft", "published"]),
  categoryIds: z.array(z.string()),
});

export type PlaylistFormValues = z.infer<typeof playlistFormSchema>;
```

- [ ] **Step 2: Replace `apps/admin/features/playlists/actions/create-playlist.action.ts`**

```typescript
"use server";

import { redirect } from "next/navigation";

import { AppError } from "@repo/api/errors";
import { createPlaylist } from "@repo/api/services/playlist";

import {
  playlistFormSchema,
  type PlaylistFormValues,
} from "../schemas/playlist-form.schema";

type CreatePlaylistResult = { error: string } | undefined;

export async function createPlaylistAction(
  input: PlaylistFormValues,
): Promise<CreatePlaylistResult> {
  const parsed = playlistFormSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.errors[0]?.message ?? "Invalid input." };
  }

  try {
    const playlist = await createPlaylist({
      ar: {
        title: parsed.data.ar.title,
        description: parsed.data.ar.description || undefined,
      },
      en: {
        title: parsed.data.en.title,
        description: parsed.data.en.description || undefined,
      },
      status: parsed.data.status,
      categoryIds: parsed.data.categoryIds,
    });
    redirect(`/playlists/${playlist.id}/edit`);
  } catch (error) {
    if (error instanceof AppError) return { error: error.message };
    throw error;
  }
}
```

- [ ] **Step 3: Replace `apps/admin/features/playlists/actions/update-playlist.action.ts`**

```typescript
"use server";

import { AppError } from "@repo/api/errors";
import { updatePlaylist } from "@repo/api/services/playlist";

import { playlistFormSchema } from "../schemas/playlist-form.schema";
import type { PlaylistFormValues } from "../schemas/playlist-form.schema";

export type UpdatePlaylistResult = { error: string } | undefined;

export async function updatePlaylistAction(
  id: string,
  input: PlaylistFormValues,
): Promise<UpdatePlaylistResult> {
  const parsed = playlistFormSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.errors[0]?.message ?? "Invalid input." };
  }

  try {
    await updatePlaylist(id, {
      ar: {
        title: parsed.data.ar.title,
        description: parsed.data.ar.description || undefined,
      },
      en: {
        title: parsed.data.en.title,
        description: parsed.data.en.description || undefined,
      },
      status: parsed.data.status,
      categoryIds: parsed.data.categoryIds,
    });
  } catch (error) {
    if (error instanceof AppError) return { error: error.message };
    throw error;
  }
}
```

- [ ] **Step 4: Replace `apps/admin/features/playlists/actions/reorder-tracks.action.ts`**

```typescript
"use server";

import { AppError } from "@repo/api/errors";
import { reorderTracks } from "@repo/api/services/track";

export type ReorderTracksResult = { error: string } | undefined;

export async function reorderTracksAction(
  playlistId: string,
  orderedTrackIds: string[],
): Promise<ReorderTracksResult> {
  try {
    await reorderTracks(playlistId, orderedTrackIds);
  } catch (error) {
    if (error instanceof AppError) return { error: error.message };
    throw error;
  }
}
```

- [ ] **Step 5: Replace `apps/admin/app/playlists/new/page.tsx`**

```typescript
import Link from "next/link";

import { listCategories } from "@repo/api/services/category";

import { PlaylistForm } from "../../../features/playlists/components/playlist-form";

export const dynamic = "force-dynamic";

export default async function NewPlaylistPage() {
  const categories = await listCategories();
  const availableCategories = categories.map((c) => ({
    id: c.id,
    name: c.en.name,
  }));

  return (
    <main className="container mx-auto px-4 py-8">
      <div className="mb-6 flex items-center gap-4">
        <Link href="/playlists" className="text-sm text-muted-foreground hover:underline">
          ← Playlists
        </Link>
        <h1 className="text-2xl font-semibold">New playlist</h1>
      </div>
      <PlaylistForm mode="create" availableCategories={availableCategories} />
    </main>
  );
}
```

- [ ] **Step 6: Replace `apps/admin/app/playlists/[id]/edit/page.tsx`**

```typescript
import Link from "next/link";
import { notFound } from "next/navigation";

import { requireSession } from "@repo/api/auth";
import { listCategories } from "@repo/api/services/category";
import { getPlaylistById } from "@repo/api/services/playlist";
import { getTracksWithUrls } from "@repo/api/services/track";

import { PlaylistForm } from "../../../../features/playlists/components/playlist-form";
import { PublishToggle } from "../../../../features/playlists/components/publish-toggle";
import { TrackDurationBackfill } from "../../../../features/playlists/components/track-duration-backfill";
import {
  TrackList,
  type SerializedTrack,
} from "../../../../features/playlists/components/track-list";
import { TrackUploader } from "../../../../features/playlists/components/track-uploader";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function EditPlaylistPage({ params }: Props) {
  const { id } = await params;
  const session = await requireSession(["admin"]);
  const playlist = await getPlaylistById(id, session);
  if (!playlist) notFound();

  const [tracks, categories] = await Promise.all([
    getTracksWithUrls(playlist.id),
    listCategories(),
  ]);

  const availableCategories = categories.map((c) => ({
    id: c.id,
    name: c.en.name,
  }));

  const serializedTracks: SerializedTrack[] = tracks.map((t) => ({
    id: t.id,
    title: t.ar.title,
    order: t.order,
    ...(t.durationSecs != null ? { durationSecs: t.durationSecs } : {}),
  }));

  const backfillTracks = tracks.map((t) => ({
    id: t.id,
    srcUrl: t.srcUrl,
    ...(t.durationSecs != null ? { durationSecs: t.durationSecs } : {}),
  }));

  return (
    <main className="container mx-auto px-4 py-8">
      <div className="mb-6 flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link href="/playlists" className="text-sm text-muted-foreground hover:underline">
            ← Playlists
          </Link>
          <h1 className="text-2xl font-semibold">Edit playlist</h1>
        </div>
        <PublishToggle playlistId={playlist.id} initialStatus={playlist.status} />
      </div>
      <PlaylistForm
        mode="edit"
        playlistId={playlist.id}
        availableCategories={availableCategories}
        defaultValues={{
          ar: { title: playlist.ar.title, description: playlist.ar.description ?? "" },
          en: { title: playlist.en.title, description: playlist.en.description ?? "" },
          status: playlist.status,
          categoryIds: playlist.categoryIds ?? [],
        }}
      />

      <hr className="my-8 border-border" />

      <section>
        <h2 className="mb-4 text-lg font-semibold">Tracks</h2>
        <TrackList playlistId={playlist.id} initialTracks={serializedTracks} />
        <TrackDurationBackfill tracks={backfillTracks} />
        <div className="mt-6">
          <TrackUploader playlistId={playlist.id} />
        </div>
      </section>
    </main>
  );
}
```

- [ ] **Step 7: Commit**

```bash
git add apps/admin/features/playlists/schemas/ apps/admin/features/playlists/actions/ apps/admin/app/playlists/
git commit -m "[AhmedMuhammedElsaid][wip]: update admin playlist actions and pages"
```

---

## Task 10: Admin Playlist Form UI

**Files:**
- Modify: `apps/admin/features/playlists/components/playlist-form.tsx`

- [ ] **Step 1: Replace `apps/admin/features/playlists/components/playlist-form.tsx`**

```typescript
"use client";

import { useForm } from "@tanstack/react-form";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@repo/ui/primitives/button";
import { Input } from "@repo/ui/primitives/input";
import { FormField } from "@repo/ui/patterns/form-field";

import { createPlaylistAction } from "../actions/create-playlist.action";
import { updatePlaylistAction } from "../actions/update-playlist.action";
import {
  playlistFormSchema,
  type PlaylistFormValues,
} from "../schemas/playlist-form.schema";

function fieldError(errors: unknown[]): string | undefined {
  const e = errors[0];
  if (!e) return undefined;
  if (typeof e === "string") return e;
  if (typeof e === "object" && e !== null && "message" in e)
    return (e as { message: string }).message;
  return undefined;
}

interface PlaylistFormProps {
  mode: "create" | "edit";
  defaultValues?: Partial<PlaylistFormValues>;
  playlistId?: string;
  availableCategories: { id: string; name: string }[];
}

export function PlaylistForm({
  mode,
  defaultValues,
  playlistId,
  availableCategories,
}: PlaylistFormProps) {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);

  const form = useForm({
    defaultValues: {
      ar: {
        title: defaultValues?.ar?.title ?? "",
        description: defaultValues?.ar?.description ?? "",
      },
      en: {
        title: defaultValues?.en?.title ?? "",
        description: defaultValues?.en?.description ?? "",
      },
      status: defaultValues?.status ?? ("draft" as const),
      categoryIds: defaultValues?.categoryIds ?? [],
    } satisfies PlaylistFormValues,
    validators: { onChange: playlistFormSchema },
    onSubmit: async ({ value }) => {
      setServerError(null);
      const result =
        mode === "create"
          ? await createPlaylistAction(value)
          : await updatePlaylistAction(playlistId!, value);
      if (result?.error) {
        setServerError(result.error);
        return;
      }
      if (mode === "edit") router.push("/playlists");
    },
  });

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        form.handleSubmit();
      }}
      className="flex max-w-xl flex-col gap-6"
      noValidate
    >
      {serverError && (
        <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {serverError}
        </p>
      )}

      <fieldset className="flex flex-col gap-4 rounded-md border border-border p-4">
        <legend className="px-1 text-sm font-medium">Arabic (ar)</legend>

        <form.Field name="ar.title">
          {(field) => (
            <FormField
              label="Title (Arabic)"
              htmlFor="playlist-ar-title"
              error={field.state.meta.isTouched ? fieldError(field.state.meta.errors) : undefined}
            >
              <Input
                id="playlist-ar-title"
                dir="rtl"
                value={field.state.value}
                onChange={(e) => field.handleChange(e.target.value)}
                onBlur={field.handleBlur}
                aria-invalid={field.state.meta.isTouched && field.state.meta.errors.length > 0}
              />
            </FormField>
          )}
        </form.Field>

        <form.Field name="ar.description">
          {(field) => (
            <FormField label="Description (Arabic)" htmlFor="playlist-ar-description">
              <textarea
                id="playlist-ar-description"
                dir="rtl"
                rows={3}
                value={field.state.value}
                onChange={(e) => field.handleChange(e.target.value)}
                onBlur={field.handleBlur}
                className="flex w-full min-w-0 rounded-md border border-input bg-surface px-3 py-2 text-sm text-foreground shadow-1 outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-bg resize-none"
              />
            </FormField>
          )}
        </form.Field>
      </fieldset>

      <fieldset className="flex flex-col gap-4 rounded-md border border-border p-4">
        <legend className="px-1 text-sm font-medium">English (en)</legend>

        <form.Field name="en.title">
          {(field) => (
            <FormField
              label="Title (English)"
              htmlFor="playlist-en-title"
              error={field.state.meta.isTouched ? fieldError(field.state.meta.errors) : undefined}
            >
              <Input
                id="playlist-en-title"
                value={field.state.value}
                onChange={(e) => field.handleChange(e.target.value)}
                onBlur={field.handleBlur}
                aria-invalid={field.state.meta.isTouched && field.state.meta.errors.length > 0}
              />
            </FormField>
          )}
        </form.Field>

        <form.Field name="en.description">
          {(field) => (
            <FormField label="Description (English)" htmlFor="playlist-en-description">
              <textarea
                id="playlist-en-description"
                rows={3}
                value={field.state.value}
                onChange={(e) => field.handleChange(e.target.value)}
                onBlur={field.handleBlur}
                className="flex w-full min-w-0 rounded-md border border-input bg-surface px-3 py-2 text-sm text-foreground shadow-1 outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-bg resize-none"
              />
            </FormField>
          )}
        </form.Field>
      </fieldset>

      <form.Field name="status">
        {(field) => (
          <FormField label="Status" htmlFor="playlist-status">
            <select
              id="playlist-status"
              value={field.state.value}
              onChange={(e) => field.handleChange(e.target.value as PlaylistFormValues["status"])}
              onBlur={field.handleBlur}
              className="flex h-10 w-full min-w-0 rounded-md border border-input bg-surface px-3 py-2 text-sm text-foreground shadow-1 outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
            >
              <option value="draft">Draft</option>
              <option value="published">Published</option>
            </select>
          </FormField>
        )}
      </form.Field>

      {availableCategories.length > 0 && (
        <form.Field name="categoryIds">
          {(field) => (
            <FormField label="Categories" htmlFor="playlist-categories">
              <div id="playlist-categories" className="flex flex-wrap gap-2">
                {availableCategories.map((cat) => {
                  const checked = field.state.value.includes(cat.id);
                  return (
                    <label
                      key={cat.id}
                      className="flex cursor-pointer items-center gap-1.5 rounded-md border border-input bg-surface px-3 py-1.5 text-sm hover:bg-surface-2"
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => {
                          field.handleChange(
                            checked
                              ? field.state.value.filter((id) => id !== cat.id)
                              : [...field.state.value, cat.id],
                          );
                        }}
                        className="size-4"
                      />
                      {cat.name}
                    </label>
                  );
                })}
              </div>
            </FormField>
          )}
        </form.Field>
      )}

      <form.Subscribe selector={(s) => s.isSubmitting}>
        {(isSubmitting) => (
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting
              ? mode === "create" ? "Creating…" : "Saving…"
              : mode === "create" ? "Create playlist" : "Save changes"}
          </Button>
        )}
      </form.Subscribe>
    </form>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/admin/features/playlists/components/playlist-form.tsx
git commit -m "[AhmedMuhammedElsaid][wip]: update admin playlist form UI for dual-locale"
```

---

## Task 11: Admin Category Schema, Actions, Form, Pages

**Files:**
- Modify: `apps/admin/features/categories/schemas/category-form.schema.ts`
- Modify: `apps/admin/features/categories/actions/create-category.action.ts`
- Modify: `apps/admin/features/categories/actions/update-category.action.ts`
- Modify: `apps/admin/features/categories/components/category-form.tsx`
- Modify: `apps/admin/app/categories/new/page.tsx`
- Modify: `apps/admin/app/categories/[id]/edit/page.tsx`

- [ ] **Step 1: Replace `apps/admin/features/categories/schemas/category-form.schema.ts`**

```typescript
import { z } from "zod";

export const categoryFormSchema = z.object({
  ar: z.object({
    name: z.string().min(1, "Arabic name is required.").max(100, "Too long."),
    description: z.string().max(500, "Too long."),
  }),
  en: z.object({
    name: z.string().min(1, "English name is required.").max(100, "Too long."),
    description: z.string().max(500, "Too long."),
  }),
  coverMediaId: z
    .string()
    .regex(/^[0-9a-f]{24}$/, "Invalid ObjectId format.")
    .or(z.literal("")),
});

export type CategoryFormValues = z.infer<typeof categoryFormSchema>;
```

- [ ] **Step 2: Replace `apps/admin/features/categories/actions/create-category.action.ts`**

```typescript
"use server";

import { redirect } from "next/navigation";

import { AppError } from "@repo/api/errors";
import { createCategory } from "@repo/api/services/category";

import {
  categoryFormSchema,
  type CategoryFormValues,
} from "../schemas/category-form.schema";

type CreateCategoryResult = { error: string } | undefined;

export async function createCategoryAction(
  input: CategoryFormValues,
): Promise<CreateCategoryResult> {
  const parsed = categoryFormSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.errors[0]?.message ?? "Invalid input." };
  }

  try {
    await createCategory({
      ar: {
        name: parsed.data.ar.name,
        description: parsed.data.ar.description || undefined,
      },
      en: {
        name: parsed.data.en.name,
        description: parsed.data.en.description || undefined,
      },
      coverMediaId: parsed.data.coverMediaId || undefined,
    });
    redirect("/categories");
  } catch (error) {
    if (error instanceof AppError) return { error: error.message };
    throw error;
  }
}
```

- [ ] **Step 3: Replace `apps/admin/features/categories/actions/update-category.action.ts`**

Read the file first to confirm it exists, then replace:

```typescript
"use server";

import { AppError } from "@repo/api/errors";
import { updateCategory } from "@repo/api/services/category";

import {
  categoryFormSchema,
  type CategoryFormValues,
} from "../schemas/category-form.schema";

export type UpdateCategoryResult = { error: string } | undefined;

export async function updateCategoryAction(
  id: string,
  input: CategoryFormValues,
): Promise<UpdateCategoryResult> {
  const parsed = categoryFormSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.errors[0]?.message ?? "Invalid input." };
  }

  try {
    await updateCategory(id, {
      ar: {
        name: parsed.data.ar.name,
        description: parsed.data.ar.description || undefined,
      },
      en: {
        name: parsed.data.en.name,
        description: parsed.data.en.description || undefined,
      },
      coverMediaId: parsed.data.coverMediaId || undefined,
    });
  } catch (error) {
    if (error instanceof AppError) return { error: error.message };
    throw error;
  }
}
```

- [ ] **Step 4: Replace `apps/admin/features/categories/components/category-form.tsx`**

```typescript
"use client";

import { useForm } from "@tanstack/react-form";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@repo/ui/primitives/button";
import { Input } from "@repo/ui/primitives/input";
import { FormField } from "@repo/ui/patterns/form-field";

import { createCategoryAction } from "../actions/create-category.action";
import { updateCategoryAction } from "../actions/update-category.action";
import {
  categoryFormSchema,
  type CategoryFormValues,
} from "../schemas/category-form.schema";

function fieldError(errors: unknown[]): string | undefined {
  const e = errors[0];
  if (!e) return undefined;
  if (typeof e === "string") return e;
  if (typeof e === "object" && e !== null && "message" in e)
    return (e as { message: string }).message;
  return undefined;
}

interface CategoryFormProps {
  mode: "create" | "edit";
  categoryId?: string;
  initialValues?: Partial<CategoryFormValues>;
}

export function CategoryForm({ mode, categoryId, initialValues }: CategoryFormProps) {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);

  const form = useForm({
    defaultValues: {
      ar: {
        name: initialValues?.ar?.name ?? "",
        description: initialValues?.ar?.description ?? "",
      },
      en: {
        name: initialValues?.en?.name ?? "",
        description: initialValues?.en?.description ?? "",
      },
      coverMediaId: initialValues?.coverMediaId ?? "",
    } satisfies CategoryFormValues,
    validators: { onChange: categoryFormSchema },
    onSubmit: async ({ value }) => {
      setServerError(null);
      const result =
        mode === "create"
          ? await createCategoryAction(value)
          : await updateCategoryAction(categoryId!, value);
      if (result?.error) {
        setServerError(result.error);
        return;
      }
      if (mode === "edit") router.push("/categories");
    },
  });

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        form.handleSubmit();
      }}
      className="flex max-w-xl flex-col gap-6"
      noValidate
    >
      {serverError && (
        <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {serverError}
        </p>
      )}

      <fieldset className="flex flex-col gap-4 rounded-md border border-border p-4">
        <legend className="px-1 text-sm font-medium">Arabic (ar)</legend>

        <form.Field name="ar.name">
          {(field) => (
            <FormField
              label="Name (Arabic)"
              htmlFor="category-ar-name"
              error={field.state.meta.isTouched ? fieldError(field.state.meta.errors) : undefined}
            >
              <Input
                id="category-ar-name"
                dir="rtl"
                value={field.state.value}
                onChange={(e) => field.handleChange(e.target.value)}
                onBlur={field.handleBlur}
                aria-invalid={field.state.meta.isTouched && field.state.meta.errors.length > 0}
              />
            </FormField>
          )}
        </form.Field>

        <form.Field name="ar.description">
          {(field) => (
            <FormField label="Description (Arabic)" htmlFor="category-ar-description">
              <textarea
                id="category-ar-description"
                dir="rtl"
                rows={3}
                value={field.state.value}
                onChange={(e) => field.handleChange(e.target.value)}
                onBlur={field.handleBlur}
                className="flex w-full min-w-0 rounded-md border border-input bg-surface px-3 py-2 text-sm text-foreground shadow-1 outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-bg resize-none"
              />
            </FormField>
          )}
        </form.Field>
      </fieldset>

      <fieldset className="flex flex-col gap-4 rounded-md border border-border p-4">
        <legend className="px-1 text-sm font-medium">English (en)</legend>

        <form.Field name="en.name">
          {(field) => (
            <FormField
              label="Name (English)"
              htmlFor="category-en-name"
              error={field.state.meta.isTouched ? fieldError(field.state.meta.errors) : undefined}
            >
              <Input
                id="category-en-name"
                value={field.state.value}
                onChange={(e) => field.handleChange(e.target.value)}
                onBlur={field.handleBlur}
                aria-invalid={field.state.meta.isTouched && field.state.meta.errors.length > 0}
              />
            </FormField>
          )}
        </form.Field>

        <form.Field name="en.description">
          {(field) => (
            <FormField label="Description (English)" htmlFor="category-en-description">
              <textarea
                id="category-en-description"
                rows={3}
                value={field.state.value}
                onChange={(e) => field.handleChange(e.target.value)}
                onBlur={field.handleBlur}
                className="flex w-full min-w-0 rounded-md border border-input bg-surface px-3 py-2 text-sm text-foreground shadow-1 outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-bg resize-none"
              />
            </FormField>
          )}
        </form.Field>
      </fieldset>

      <form.Field name="coverMediaId">
        {(field) => (
          <FormField
            label="Cover Media ID"
            htmlFor="category-cover-media-id"
            error={field.state.meta.isTouched ? fieldError(field.state.meta.errors) : undefined}
          >
            <Input
              id="category-cover-media-id"
              type="text"
              placeholder="24-character ObjectId (optional)"
              value={field.state.value}
              onChange={(e) => field.handleChange(e.target.value)}
              onBlur={field.handleBlur}
              aria-invalid={field.state.meta.isTouched && field.state.meta.errors.length > 0}
            />
          </FormField>
        )}
      </form.Field>

      <form.Subscribe selector={(s) => s.isSubmitting}>
        {(isSubmitting) => (
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting
              ? mode === "create" ? "Creating…" : "Saving…"
              : mode === "create" ? "Create category" : "Save changes"}
          </Button>
        )}
      </form.Subscribe>
    </form>
  );
}
```

- [ ] **Step 5: Replace `apps/admin/app/categories/new/page.tsx`**

```typescript
import Link from "next/link";

import { CategoryForm } from "../../../features/categories/components/category-form";

export const dynamic = "force-dynamic";

export default function NewCategoryPage() {
  return (
    <main className="container mx-auto px-4 py-8">
      <div className="mb-6 flex items-center gap-4">
        <Link href="/categories" className="text-sm text-muted-foreground hover:underline">
          ← Categories
        </Link>
        <h1 className="text-2xl font-semibold">New category</h1>
      </div>
      <CategoryForm mode="create" />
    </main>
  );
}
```

- [ ] **Step 6: Replace `apps/admin/app/categories/[id]/edit/page.tsx`**

```typescript
import Link from "next/link";
import { notFound } from "next/navigation";

import { requireSession } from "@repo/api/auth";
import { getCategoryById } from "@repo/api/services/category";

import { CategoryForm } from "../../../../features/categories/components/category-form";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function EditCategoryPage({ params }: Props) {
  const { id } = await params;
  await requireSession(["admin"]);
  const category = await getCategoryById(id);
  if (!category) notFound();

  return (
    <main className="container mx-auto px-4 py-8">
      <div className="mb-6 flex items-center gap-4">
        <Link href="/categories" className="text-sm text-muted-foreground hover:underline">
          ← Categories
        </Link>
        <h1 className="text-2xl font-semibold">Edit category</h1>
      </div>
      <CategoryForm
        mode="edit"
        categoryId={category.id}
        initialValues={{
          ar: { name: category.ar.name, description: category.ar.description ?? "" },
          en: { name: category.en.name, description: category.en.description ?? "" },
          coverMediaId: category.coverMediaId ?? "",
        }}
      />
    </main>
  );
}
```

- [ ] **Step 7: Commit**

```bash
git add apps/admin/features/categories/ apps/admin/app/categories/
git commit -m "[AhmedMuhammedElsaid][wip]: update admin category form and pages"
```

---

## Task 12: Admin Track List, Uploader, Hook, Action

**Files:**
- Modify: `apps/admin/features/playlists/actions/create-track.action.ts`
- Modify: `apps/admin/features/playlists/hooks/use-track-upload.ts`
- Modify: `apps/admin/features/playlists/components/track-uploader.tsx`
- Modify: `apps/admin/features/playlists/components/track-list.tsx`

- [ ] **Step 1: Replace `apps/admin/features/playlists/actions/create-track.action.ts`**

```typescript
"use server";

import { AppError } from "@repo/api/errors";
import { createTrack } from "@repo/api/services/track";

export type CreateTrackResult = { error: string } | { trackId: string };

function titleFromFilename(filename: string): string {
  return (
    filename
      .replace(/\.[^.]+$/, "")
      .replace(/[-_]+/g, " ")
      .trim() || filename
  );
}

export async function createTrackAction(input: {
  filename: string;
  playlistId: string;
  mediaId: string;
  durationSecs?: number;
}): Promise<CreateTrackResult> {
  try {
    const title = titleFromFilename(input.filename);
    const track = await createTrack({
      ar: { title },
      en: { title },
      playlistId: input.playlistId,
      mediaId: input.mediaId,
      ...(input.durationSecs != null ? { durationSecs: input.durationSecs } : {}),
    });
    return { trackId: track.id };
  } catch (error) {
    if (error instanceof AppError) return { error: error.message };
    throw error;
  }
}
```

- [ ] **Step 2: Update `apps/admin/features/playlists/hooks/use-track-upload.ts`**

Change the `runUpload` function signature and `useTrackUpload` hook to remove `locale` and replace `playlistContentId` with `playlistId`. The only changed lines are:

In `runUpload`:
```typescript
async function runUpload(
  item: UploadItem,
  playlistId: string,       // was: playlistContentId + locale
  dispatch: React.Dispatch<Action>,
): Promise<void> {
```

In the `createTrackAction` call inside `runUpload` (Step 4 of the upload flow):
```typescript
  const result = await createTrackAction({
    filename: item.file.name,
    playlistId,              // was: playlistContentId + locale
    mediaId,
    ...(durationSecs != null ? { durationSecs } : {}),
  });
```

In `useTrackUpload`:
```typescript
export function useTrackUpload(playlistId: string) {  // was: (playlistContentId, locale)
  // ...
  const addFiles = useCallback(
    (files: File[]) => {
      // ...
      for (const item of newItems) {
        runUpload(item, playlistId, dispatch);  // was: (item, playlistContentId, locale, dispatch)
      }
    },
    [playlistId],
  );

  const retry = useCallback(
    (id: string) => {
      // ...
      runUpload({ ...item, status: "pending", progress: 0, error: undefined }, playlistId, dispatch);
    },
    [playlistId],
  );
```

- [ ] **Step 3: Update `apps/admin/features/playlists/components/track-uploader.tsx`**

Change the Props interface and component signature:
```typescript
interface Props {
  playlistId: string;  // was: playlistContentId + locale
}

export function TrackUploader({ playlistId }: Props) {
  const { items, addFiles, retry } = useTrackUpload(playlistId);
```

- [ ] **Step 4: Update `apps/admin/features/playlists/components/track-list.tsx`**

Change the Props interface, the component signature, and the `reorderTracksAction` call:

```typescript
interface Props {
  playlistId: string;  // was: playlistContentId + locale
  initialTracks: SerializedTrack[];
}

export function TrackList({ playlistId, initialTracks }: Props) {
  // ...
  const result = await reorderTracksAction(
    playlistId,
    reordered.map((t) => t.id),
  );
  // (removed locale arg)
```

- [ ] **Step 5: Commit**

```bash
git add apps/admin/features/playlists/actions/create-track.action.ts apps/admin/features/playlists/hooks/use-track-upload.ts apps/admin/features/playlists/components/track-uploader.tsx apps/admin/features/playlists/components/track-list.tsx
git commit -m "[AhmedMuhammedElsaid][wip]: remove locale from track upload and list components"
```

---

## Task 13: Web App — Types, PlaylistCard, Homepage, Detail Page

**Files:**
- Modify: `apps/web/features/playlists/types.ts`
- Modify: `apps/web/features/playlists/components/playlist-card.tsx`
- Modify: `apps/web/app/[locale]/page.tsx`
- Modify: `apps/web/app/[locale]/playlists/[slug]/page.tsx`

- [ ] **Step 1: Replace `apps/web/features/playlists/types.ts`**

```typescript
import type { Playlist } from "@repo/api/schemas/playlist";
import type { Track } from "@repo/api/schemas/track";
import type { PlayableTrack } from "@repo/api/services/track";

export type SerializedPlaylist = Omit<Playlist, "createdAt" | "updatedAt"> & {
  createdAt: string;
  updatedAt: string;
};

export type SerializedTrack = Omit<Track, "createdAt" | "updatedAt"> & {
  createdAt: string;
  updatedAt: string;
};

export type SerializedPlayableTrack = Omit<
  PlayableTrack,
  "createdAt" | "updatedAt"
> & {
  createdAt: string;
  updatedAt: string;
};

// Locale-resolved shape passed to client components that don't know the locale.
export type DisplayTrack = {
  id: string;
  title: string;
  slug: string;
  description?: string;
  mediaId: string;
  playlistId: string;
  order: number;
  durationSecs?: number;
  srcUrl: string | null;
  createdAt: string;
  updatedAt: string;
};
```

- [ ] **Step 2: Replace `apps/web/features/playlists/components/playlist-card.tsx`**

`PlaylistCard` is a server component so it can call `getLocale()` from next-intl:

```typescript
import { getLocale, getTranslations } from "next-intl/server";

import { Link } from "@/i18n/navigation";
import type { SerializedPlaylist } from "@/features/playlists/types";
import type { Locale } from "@repo/api/schemas/locale";

interface PlaylistCardProps {
  playlist: SerializedPlaylist;
}

export async function PlaylistCard({ playlist }: PlaylistCardProps) {
  const [t, locale] = await Promise.all([
    getTranslations("playlist"),
    getLocale() as Promise<Locale>,
  ]);
  const display = playlist[locale];

  return (
    <Link
      href={`/playlists/${display.slug}`}
      className="rounded-xl border border-border bg-surface hover:bg-surface-2 transition-colors p-5 flex flex-col gap-2"
    >
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-display text-lg font-semibold leading-tight">
          {display.title}
        </h2>
        {playlist.status === "published" && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-success/10 px-2 py-0.5 text-xs font-medium text-success">
            <span aria-hidden="true" className="size-1.5 rounded-full bg-success" />
            {t("published")}
          </span>
        )}
      </div>
      {display.description != null && (
        <p className="text-sm text-text-2 line-clamp-2">{display.description}</p>
      )}
    </Link>
  );
}
```

- [ ] **Step 3: Replace `apps/web/app/[locale]/page.tsx`**

```typescript
import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { getPublishedPlaylists } from "@repo/api/services/playlist";
import { listCategories } from "@repo/api/services/category";
import { LOCALES, type Locale } from "@repo/api/schemas/locale";
import type { Playlist } from "@repo/api/schemas/playlist";

export const dynamic = "force-dynamic";
import { PlaylistCard } from "@/features/playlists/components/playlist-card";
import { CategoryFilterBar } from "@/features/categories/components/category-filter-bar";
import type { SerializedPlaylist } from "@/features/playlists/types";

function serializePlaylist(p: Playlist): SerializedPlaylist {
  return {
    ...p,
    createdAt: typeof p.createdAt === "string" ? p.createdAt : p.createdAt.toISOString(),
    updatedAt: typeof p.updatedAt === "string" ? p.updatedAt : p.updatedAt.toISOString(),
  };
}

const baseUrl = process.env.NEXT_PUBLIC_WEB_URL ?? "http://localhost:3000";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const languages = Object.fromEntries(LOCALES.map((l) => [l, `${baseUrl}/${l}`]));
  return { alternates: { canonical: `${baseUrl}/${locale}`, languages } };
}

export default async function HomePage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: Locale }>;
  searchParams: Promise<{ category?: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { category } = await searchParams;
  const t = await getTranslations("home");

  const categories = await listCategories();

  // Match the ?category= slug against the locale-specific slug field.
  const matchedCategory =
    category != null ? categories.find((c) => c[locale].slug === category) : undefined;
  const categoryId = matchedCategory?.id;

  const playlists = await getPublishedPlaylists(
    categoryId != null ? { categoryId } : undefined,
  );
  const serialized = playlists.map(serializePlaylist);

  // Pass locale-resolved slug + name to the CategoryFilterBar client island.
  const categoryPills = categories.map((c) => ({
    id: c.id,
    slug: c[locale].slug,
    name: c[locale].name,
  }));

  return (
    <section className="mx-auto max-w-6xl px-6 py-16">
      <h1 className="font-display text-3xl tracking-tight">{t("heading")}</h1>
      <CategoryFilterBar categories={categoryPills} activeSlug={category} />
      {serialized.length === 0 ? (
        <p className="text-muted-foreground mt-6">{t("empty")}</p>
      ) : (
        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {serialized.map((playlist) => (
            <PlaylistCard key={playlist.id} playlist={playlist} />
          ))}
        </div>
      )}
    </section>
  );
}
```

- [ ] **Step 4: Replace `apps/web/app/[locale]/playlists/[slug]/page.tsx`**

```typescript
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { getPlaylistBySlug } from "@repo/api/services/playlist";
import { LOCALES } from "@repo/api/schemas/locale";

export const dynamic = "force-dynamic";
import { getTracksWithUrls } from "@repo/api/services/track";
import { getMediaUrlById } from "@repo/api/services/media";
import type { Locale } from "@repo/api/schemas/locale";
import type { Playlist } from "@repo/api/schemas/playlist";
import type { PlayableTrack } from "@repo/api/services/track";
import { TrackListPlayer } from "@/features/playlists/components/track-list-player";
import type {
  SerializedPlaylist,
  DisplayTrack,
} from "@/features/playlists/types";

function serializePlaylist(p: Playlist): SerializedPlaylist {
  return {
    ...p,
    createdAt: typeof p.createdAt === "string" ? p.createdAt : p.createdAt.toISOString(),
    updatedAt: typeof p.updatedAt === "string" ? p.updatedAt : p.updatedAt.toISOString(),
  };
}

function toDisplayTrack(t: PlayableTrack, locale: Locale): DisplayTrack {
  return {
    id: t.id,
    title: t[locale].title,
    slug: t[locale].slug,
    description: t[locale].description,
    mediaId: t.mediaId,
    playlistId: t.playlistId,
    order: t.order,
    ...(t.durationSecs != null ? { durationSecs: t.durationSecs } : {}),
    srcUrl: t.srcUrl,
    createdAt: typeof t.createdAt === "string" ? t.createdAt : t.createdAt.toISOString(),
    updatedAt: typeof t.updatedAt === "string" ? t.updatedAt : t.updatedAt.toISOString(),
  };
}

const baseUrl = process.env.NEXT_PUBLIC_WEB_URL ?? "http://localhost:3000";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: Locale; slug: string }>;
}): Promise<Metadata> {
  const { locale, slug } = await params;
  const t = await getTranslations({ locale, namespace: "metadata" });
  const playlist = await getPlaylistBySlug(locale, slug);

  if (!playlist || playlist.status !== "published") {
    return { title: t("notFound") };
  }

  // hreflang alternates: each locale's slug is already in the single document.
  const languages: Record<string, string> = {};
  for (const l of LOCALES) {
    const altSlug = playlist[l].slug;
    if (altSlug) {
      languages[l] = `${baseUrl}/${l}/playlists/${altSlug}`;
    }
  }

  const tp = await getTranslations({ locale, namespace: "playlist" });
  const display = playlist[locale];
  const canonical = `${baseUrl}/${locale}/playlists/${display.slug}`;
  return {
    title: `${display.title} — Nour`,
    description: display.description ?? tp("listenOn"),
    alternates: { canonical, languages },
    openGraph: {
      type: "website",
      locale,
      url: canonical,
      title: display.title,
      ...(display.description ? { description: display.description } : {}),
    },
  };
}

export default async function PlaylistDetailPage({
  params,
}: {
  params: Promise<{ locale: Locale; slug: string }>;
}) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("playlist");

  const playlist = await getPlaylistBySlug(locale, slug);
  if (!playlist || playlist.status !== "published") notFound();

  const tracks = await getTracksWithUrls(playlist.id);
  const coverUrl = playlist.coverMediaId
    ? await getMediaUrlById(playlist.coverMediaId)
    : null;

  const display = playlist[locale];
  const serializedPlaylist = serializePlaylist(playlist);
  const displayTracks = tracks.map((t) => toDisplayTrack(t, locale));

  const publishedDate = new Date(serializedPlaylist.createdAt).toLocaleDateString(
    locale === "ar" ? "ar" : "en-US",
    { year: "numeric", month: "long", day: "numeric" },
  );

  return (
    <div className="max-w-3xl mx-auto px-6 py-10">
      <header>
        <h1 className="font-display text-4xl tracking-tight">{display.title}</h1>
        {display.description != null && (
          <p className="mt-2 text-text-2">{display.description}</p>
        )}
        <p className="mt-1 text-sm text-text-2">
          {t("trackCount", { count: displayTracks.length })} &middot; {publishedDate}
        </p>
      </header>

      <section aria-labelledby="tracks-heading">
        <h2 id="tracks-heading" className="text-lg font-semibold mt-10 mb-4">
          {t("tracksHeading")}
        </h2>
        <TrackListPlayer
          tracks={displayTracks}
          playlistTitle={display.title}
          coverUrl={coverUrl ?? undefined}
        />
      </section>
    </div>
  );
}
```

- [ ] **Step 5: Update `TrackListPlayer` prop type**

Open `apps/web/features/playlists/components/track-list-player.tsx` and replace the import of `SerializedPlayableTrack` with `DisplayTrack`, and update the `tracks` prop type:

```typescript
import type { DisplayTrack } from "@/features/playlists/types";

// In the component interface:
interface Props {
  tracks: DisplayTrack[];  // was: SerializedPlayableTrack[]
  playlistTitle: string;
  coverUrl?: string;
}
```

- [ ] **Step 6: Commit**

```bash
git add apps/web/
git commit -m "[AhmedMuhammedElsaid][wip]: update web app for embedded locale schema"
```

---

## Task 14: Typecheck, Tests, and Migration Dry Run

**Files:** none changed — verification only

- [ ] **Step 1: Run typecheck across all packages**

```bash
pnpm turbo run typecheck
```

Expected: 0 errors. Fix any type errors before proceeding.

- [ ] **Step 2: Run all tests**

```bash
pnpm turbo run test
```

Expected: all tests pass (API + admin + web suites). Fix any failures before proceeding.

- [ ] **Step 3: Run migration dry-run**

```bash
pnpm tsx scripts/migrate.ts --dry-run
```

Expected: lists all 5 migrations without error.

- [ ] **Step 4: Apply migration against dev/Atlas DB**

```bash
pnpm tsx scripts/migrate.ts
```

Expected: each migration logs `done` in order. Verify in Atlas that:
- Categories have `ar: { name, slug }` and `en: { name, slug }` — no `locale` or `contentId` fields
- Playlists have `ar: { title, slug }` and `en: { title, slug }` — no `locale` or `contentId` fields
- Tracks have `ar: { title, slug }` and `en: { title, slug }` — `playlistId` field, no `playlistContentId`
- Collection counts: playlists, tracks, categories each roughly halved (merged AR+EN pairs)

- [ ] **Step 5: Update `APP_CONTEXT.md`**

Add a new row in the "Completed waves" table:

```
| i18n refactor — embedded locale ✅ | HEAD | Per-locale documents (AR+EN separate, contentId-linked) replaced by single documents with `ar: {}` and `en: {}` sub-objects. `contentId` and `locale` fields removed from all three collections. `track.playlistContentId` → `track.playlistId`. `playlist.categoryIds` now holds category `_id`s (not contentIds). Migration 0005 merges paired docs; inserted before 0001/0002 in runner. Cache tags de-scoped from locale: `PLAYLISTS_HOME`, `playlistTag(id)`, `CATEGORIES`. Services: `getPublishedPlaylists()` no locale param; `listCategories()` no locale param; `getTracksWithUrls(playlistId)` no locale param. Web: `PlaylistCard` calls `getLocale()`; detail page resolves `DisplayTrack[]` from `SerializedPlayableTrack[]` before passing to `TrackListPlayer`. `getPlaylistSlugForLocale` removed — use `playlist.ar.slug`/`playlist.en.slug` directly. |
```

- [ ] **Step 6: Final commit**

```bash
git add APP_CONTEXT.md
git commit -m "[AhmedMuhammedElsaid][docs]: record embedded-locale refactor in APP_CONTEXT"
```

---

## Done

All tasks complete when:
- `pnpm turbo run typecheck` → 0 errors
- `pnpm turbo run test` → all green
- Atlas documents show embedded `ar`/`en` objects, no `locale`/`contentId` fields
- Admin can create/edit playlists and categories with both locale fields on one form
- Web homepage renders correct locale title/slug per URL prefix
- Web detail page renders correct locale title and track names
