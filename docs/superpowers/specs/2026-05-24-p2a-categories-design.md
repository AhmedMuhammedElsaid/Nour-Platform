# P2-A: Categories — Design Spec

> **Status**: Approved  
> **Date**: 2026-05-24  
> **Scope**: Categories feature only. Scholars deferred to a future wave. Sentry wiring is a separate standalone task.

---

## 1. Summary

Add a Category resource to the platform. Admins manage categories via a full CRUD section in the admin CMS. Playlists can belong to multiple categories (many-to-many). The public homepage gains a URL-param-driven filter bar that narrows the playlist grid by category.

---

## 2. Definition of Done (per PLAN.md §1)

Every ticket in this wave is done when:

- [ ] TypeScript strict passes — no `any`, no `as` casts without comment.
- [ ] Zod schema lives in `packages/api/src/schemas/category.ts`.
- [ ] Service has `requireSession(['admin'])` on every mutating method + `revalidateTag` after mutations.
- [ ] UI components use Tailwind tokens only — no hex codes, no arbitrary values.
- [ ] At least one unit test + one integration test per ticket.
- [ ] Manual smoke pass: create category in admin → assign to playlist → filter appears on homepage.

---

## 3. Exit Criteria

A wave is complete when:

- Admin can create, edit, and delete a category with name, slug, description, and optional cover image.
- Deleting a category silently removes it from all playlists (`$pull`) with no orphaned references.
- Playlist create/edit form shows a category multi-select; saved selections persist on reload.
- Homepage renders a filter bar; selecting a category narrows the grid to matching playlists.
- Selecting "All" restores the full unfiltered grid.
- Homepage with `?category=unknown-slug` shows an empty state (not a 404 or error).
- All tests green; lint and typecheck clean.

---

## 4. Data Model

### 4.1 New `Category` collection

| Field | Type | Constraints |
|---|---|---|
| `_id` | ObjectId | auto |
| `name` | string | required, 1–100 chars |
| `slug` | string | required, unique, URL-safe |
| `description` | string | optional, max 500 chars |
| `coverMediaId` | ObjectId | optional, ref → Media |
| `createdAt` | Date | Mongoose timestamps |
| `updatedAt` | Date | Mongoose timestamps |

### 4.2 Playlist document changes

Add one field to the existing `playlists` collection:

| Field | Type | Default |
|---|---|---|
| `categoryIds` | ObjectId[] | `[]` |

### 4.3 Indexes (migration `0002-category-indexes`)

- `categories`: `{ slug: 1 }` — unique
- `playlists`: `{ categoryIds: 1 }` — powers homepage filter query

---

## 5. Service Layer (`packages/api/src/services/`)

### 5.1 New `category.service.ts`

| Method | Auth | Behaviour |
|---|---|---|
| `listCategories()` | public | All categories sorted by name; tagged `'categories'` |
| `getCategoryBySlug(slug)` | public | Single lookup; `AppError` (404) if not found |
| `createCategory(input)` | `requireSession(['admin'])` | Slugifies name if slug omitted; appends `-2`, `-3` on collision (same pattern as `playlist.service.ts`); revalidates `'categories'` |
| `updateCategory(id, input)` | `requireSession(['admin'])` | Partial patch; revalidates `'categories'` |
| `deleteCategory(id)` | `requireSession(['admin'])` | Hard delete; `$pull` categoryId from all playlists in same operation; revalidates `'categories'` + `'playlists:home'` |

### 5.2 Updates to `playlist.service.ts`

- `createPlaylist` and `updatePlaylist` accept `categoryIds?: string[]`; service validates each ID exists in the Category collection before saving (unknown IDs → `AppError`).
- `getPublishedPlaylists(filter?: { categoryId?: string })` — adds `{ categoryIds: { $in: [id] } }` when filter is present. Returns `[]` (not an error) when no playlists match.

### 5.3 New `category.repo.ts` (`packages/api/src/repositories/`)

Methods: `findAll`, `findBySlug`, `findById`, `create`, `updateById`, `deleteById`. All return `.lean()` plain objects — no Mongoose `Document` types escape this layer.

### 5.4 Cache tags (`packages/api/src/cache/tags.ts`)

Add: `CATEGORIES = 'categories'`

---

## 6. Admin CMS (`apps/admin/`)

### 6.1 Route tree

```
app/categories/
  page.tsx              RSC — lists all categories → CategoriesTable
  new/page.tsx          RSC shell → CategoryForm (create mode)
  [id]/edit/page.tsx    RSC shell, loads category by id → CategoryForm (edit mode)
```

### 6.2 Feature folder `features/categories/`

| File | Role |
|---|---|
| `components/categories-table.tsx` | TanStack Table client island; columns: name, slug, description (truncated), cover thumbnail, actions (edit / delete). Mirrors `playlists-table.tsx`. |
| `components/category-form.tsx` | TanStack Form + Zod; fields: name (typing auto-slugifies until slug is manually edited), slug (manual override), description, cover image. |
| `schemas/category-form.schema.ts` | Zod form schema; mirrors `playlist-form.schema.ts` pattern. |
| `actions/create-category.action.ts` | Wraps `categoryService.createCategory`; uses `actionResult` helper. |
| `actions/update-category.action.ts` | Wraps `categoryService.updateCategory`. |
| `actions/delete-category.action.ts` | Wraps `categoryService.deleteCategory`. |

**Cover image:** the category form reuses the existing `<MediaPicker>` / upload flow already present in the playlist form — admin uploads a new image via the same 2-step presign → confirm handshake, producing a confirmed `Media` document. `coverMediaId` stores the resulting Media `_id`. No new upload infrastructure needed.

### 6.3 Playlist edit form (`features/playlists/components/playlist-form.tsx`)

Add a `categoryIds` multi-select field. Categories are fetched server-side in the RSC page and passed as `availableCategories: { id: string; name: string }[]` prop. Rendered as a checkbox group using the existing `FormField` primitive from `@repo/ui/patterns/form-field`.

### 6.4 Admin nav

Add "Categories" link to the admin sidebar alongside the existing "Playlists" link.

---

## 7. Public Web (`apps/web/`)

### 7.1 Homepage (`app/page.tsx`)

1. Read `searchParams.category` (RSC prop — Next.js passes `searchParams` to page components).
2. Fetch `listCategories()` and `getPublishedPlaylists({ categoryId })` in parallel (both cached; no waterfall).
3. Pass categories to `CategoryFilterBar`; pass filtered playlists to the existing playlist grid.
4. If `?category` param matches no known category slug, `getPublishedPlaylists` returns `[]` and the grid renders an empty state message — no error, no 404.

### 7.2 New component `features/categories/components/category-filter-bar.tsx`

- `"use client"` — uses `useRouter` / `useSearchParams` to push URL param on click.
- Horizontal pill list of category names + "All" pill that clears the param.
- Active pill derived from current `?category=slug`; no local state — reads from and writes to URL only.
- On first render the server has already applied the filter; JS enhances subsequent clicks to avoid full-page reload.

### 7.3 URL shape

`/?category=<slug>` — single active category at a time. Bookmarkable and shareable.

### 7.4 Empty state

When the filtered playlist grid is empty (unknown slug or genuinely empty category), render a simple inline message: *"No playlists in this category yet."* — not a separate page, not an error boundary.

---

## 8. Model Assignments (per PLAN.md §2 rubric)

| Ticket | Recommended model | Reason |
|---|---|---|
| Zod schema + Mongoose model + repo (`category.ts`, `Category.model.ts`, `category.repo.ts`) | **Sonnet** | First instance of schema+model+repo triple for Phase 2, but the pattern is now mature from MVP. |
| Migration `0002-category-indexes` | **Haiku** | Mechanical clone of `0001-indexes`. |
| `category.service.ts` | **Sonnet** | CRUD service; follows `playlist.service.ts` exactly. |
| Admin CRUD pages + `CategoryForm` + actions | **Sonnet** | Sibling pattern: `playlists-create-edit` is the reference. |
| Playlist form update (`categoryIds` multi-select) | **Haiku** | Additive field to an existing form; no new pattern. |
| `CategoryFilterBar` + homepage wiring | **Sonnet** | New client island + RSC integration; first instance of URL-param filter. |
| Tests | **Sonnet** | Writing tests for completed code. |

---

## 9. Tests

| Layer | Tests |
|---|---|
| `category.service.ts` | Unit: create happy path; slug collision appends `-2`; `deleteCategory` verifies `$pull` side-effect on playlists; `listCategories` returns sorted by name |
| `create-category.action.ts` | Integration: happy path with mocked admin session; non-admin session → rejected with `AppError` |
| `categories-table.tsx` | RTL: rows render with correct columns; delete confirmation dialog blocks accidental deletion |
| `category-form.tsx` | RTL: slug auto-derives from name input; manual slug edit freezes auto-derive; submit fires action |
| `category-filter-bar.tsx` | RTL: clicking a category pill pushes `?category=slug` to URL; clicking "All" clears the param |
| E2E (Playwright) | Admin creates a category → assigns it to a published playlist → homepage filter bar shows category → clicking it shows only that playlist |

---

## 10. Token Budget Estimate

| Sub-task | Estimate |
|---|---|
| Schema + model + repo + migration | ~40–60k |
| Service (`category.service.ts` + playlist update) | ~60–80k |
| Admin CMS (pages + form + table + actions) | ~120–160k |
| Playlist form update | ~20–30k |
| Public web (`CategoryFilterBar` + homepage wiring) | ~60–80k |
| Tests | ~60–80k |
| **Total** | **~360–490k** |

---

## 11. Out of Scope

- Dedicated `/categories/[slug]` public pages — deferred.
- Scholar profiles — dropped from P2-A, future wave.
- Sentry SDK wiring — separate standalone task.
- Category ordering / drag-drop — deferred.
- Category icons / emoji field — deferred.
- Playlist count per category in the filter bar — deferred.
- Soft-delete / archive for categories — deferred; hard delete with `$pull` is sufficient for now.
