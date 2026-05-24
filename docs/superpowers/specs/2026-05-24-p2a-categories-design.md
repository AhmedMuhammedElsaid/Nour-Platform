# P2-A: Categories — Design Spec

> **Status**: Approved  
> **Date**: 2026-05-24  
> **Scope**: Categories feature only. Scholars deferred to a future wave. Sentry wiring is a separate standalone task.

---

## 1. Summary

Add a Category resource to the platform. Admins manage categories via a full CRUD section in the admin CMS. Playlists can belong to multiple categories (many-to-many). The public homepage gains a URL-param-driven filter bar that narrows the playlist grid by category.

---

## 2. Data Model

### 2.1 New `Category` collection

| Field | Type | Constraints |
|---|---|---|
| `_id` | ObjectId | auto |
| `name` | string | required, 1–100 chars |
| `slug` | string | required, unique, URL-safe |
| `description` | string | optional, max 500 chars |
| `coverMediaId` | ObjectId | optional, ref → Media |
| `createdAt` | Date | Mongoose timestamps |
| `updatedAt` | Date | Mongoose timestamps |

### 2.2 Playlist document changes

Add one field to the existing `playlists` collection:

| Field | Type | Default |
|---|---|---|
| `categoryIds` | ObjectId[] | `[]` |

### 2.3 Indexes (migration `0002-category-indexes`)

- `categories`: `{ slug: 1 }` — unique
- `playlists`: `{ categoryIds: 1 }` — powers homepage filter query

---

## 3. Service Layer (`packages/api/src/services/`)

### 3.1 New `category.service.ts`

| Method | Auth | Behaviour |
|---|---|---|
| `listCategories()` | public | All categories sorted by name; tagged `'categories'` |
| `getCategoryBySlug(slug)` | public | Single lookup; `AppError` if not found |
| `createCategory(input)` | `requireSession(['admin'])` | Auto-slugifies name when slug omitted; revalidates `'categories'` |
| `updateCategory(id, input)` | `requireSession(['admin'])` | Partial patch; revalidates `'categories'` |
| `deleteCategory(id)` | `requireSession(['admin'])` | `$pull` categoryId from all playlists; revalidates `'categories'` + `'playlists:home'` |

### 3.2 Updates to `playlist.service.ts`

- `createPlaylist` and `updatePlaylist` accept `categoryIds?: string[]`; service validates each ID exists in the Category collection (unknown IDs → `AppError`).
- `getPublishedPlaylists(filter?: { categoryId?: string })` — adds `{ categoryIds: { $in: [id] } }` when filter is present.

### 3.3 New `category.repo.ts` (`packages/api/src/repositories/`)

Methods: `findAll`, `findBySlug`, `findById`, `create`, `updateById`, `deleteById`. All return `.lean()` plain objects.

### 3.4 Cache tags (`packages/api/src/cache/tags.ts`)

Add: `CATEGORIES = 'categories'`

---

## 4. Admin CMS (`apps/admin/`)

### 4.1 Route tree

```
app/categories/
  page.tsx              RSC — lists all categories → CategoriesTable
  new/page.tsx          RSC shell → CategoryForm (create mode)
  [id]/edit/page.tsx    RSC shell, loads category by id → CategoryForm (edit mode)
```

### 4.2 Feature folder `features/categories/`

| File | Role |
|---|---|
| `components/categories-table.tsx` | TanStack Table client island; columns: name, slug, description (truncated), cover, actions. Mirrors `playlists-table.tsx`. |
| `components/category-form.tsx` | TanStack Form + Zod; fields: name (auto-slugifies to slug), slug (manual override), description, cover image (MediaPicker). |
| `schemas/category-form.schema.ts` | Zod form schema. |
| `actions/create-category.action.ts` | Wraps `categoryService.createCategory`; uses `actionResult` helper. |
| `actions/update-category.action.ts` | Wraps `categoryService.updateCategory`. |
| `actions/delete-category.action.ts` | Wraps `categoryService.deleteCategory`. |

### 4.3 Playlist edit form (`features/playlists/components/playlist-form.tsx`)

Add a `categoryIds` multi-select field. Categories are fetched server-side in the RSC page and passed as `availableCategories: { id: string; name: string }[]` prop. Rendered as a checkbox group using the existing `FormField` primitive from `@repo/ui/patterns/form-field`.

### 4.4 Admin nav

Add "Categories" link alongside the existing "Playlists" link in the sidebar.

---

## 5. Public Web (`apps/web/`)

### 5.1 Homepage (`app/page.tsx`)

1. Read `searchParams.category` (RSC prop).
2. Fetch `listCategories()` and `getPublishedPlaylists({ categoryId })` in parallel.
3. Pass categories to `CategoryFilterBar`; pass filtered playlists to the existing playlist grid.

### 5.2 New component `features/categories/components/category-filter-bar.tsx`

- `"use client"` — uses `useRouter` / `useSearchParams` to push URL param on click.
- Horizontal pill list of category names + "All" pill to clear the param.
- Active pill derives from current `?category=slug`.
- First render is server-rendered (filtered grid arrives from RSC); JS enhances navigation.

### 5.3 URL shape

`/?category=<slug>` — single active category at a time. Bookmarkable and shareable.

---

## 6. Tests

| Layer | Tests |
|---|---|
| `category.service.ts` | Unit: create happy path; slug collision → `AppError`; `deleteCategory` `$pull` side-effect; `listCategories` sorted order |
| `create-category.action.ts` | Integration: happy path with mocked admin session; non-admin → rejected |
| `categories-table.tsx` | RTL: rows render; delete confirmation dialog |
| `category-form.tsx` | RTL: slug auto-derives from name; submit fires action |
| `category-filter-bar.tsx` | RTL: clicking a pill updates `?category` param; "All" clears it |
| E2E (Playwright) | Admin creates category → assigns to playlist → homepage filter shows filtered result |

---

## 7. Out of Scope

- Dedicated `/categories/[slug]` public pages — deferred.
- Scholar profiles — dropped from P2-A, future wave.
- Sentry SDK wiring — separate standalone task.
- Category ordering / drag-drop — deferred.
- Category icons / emoji field — deferred.
