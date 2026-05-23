# Design: admin/playlists-list (ticket 3.1)

**Date:** 2026-05-23  
**Ticket:** 3.1 `admin/playlists-list`  
**Model:** Sonnet 4.6

---

## What we're building

An admin list page at `/playlists` showing all playlists with a client-side status filter and links to the edit page (created in 3.2).

---

## Architecture

### RSC page
`apps/admin/app/playlists/page.tsx`
- Server component; no `"use client"`
- Calls `getAllPlaylists()` from `@repo/api/services/playlist.service`
- Passes the lean DTO array as a prop to `<PlaylistsTable>`
- Suspense boundary wraps the table for loading state

### Client island
`apps/admin/features/playlists/components/playlists-table.tsx`
- `"use client"` — needed for TanStack Table interactivity (sorting, filtering)
- TanStack Table v8 (no Virtual — under 100 rows per spec)
- Status filter rendered as a `<select>` above the table (All / Draft / Published)
- Uses TanStack Table's built-in `setColumnFilters` on the `status` column

---

## Columns

| Column | Behaviour |
|---|---|
| Title | Clickable link → `/playlists/[id]/edit` |
| Status | Badge chip (draft = muted, published = accent) |
| Track count | Plain number from `trackIds.length` |
| Created | Formatted date string |
| Actions | "Edit" link to `/playlists/[id]/edit` |

---

## Data flow

```
RSC page
  └─ getAllPlaylists()          ← @repo/api/services/playlist.service
       └─ playlistRepo.findAll() → .lean() DTOs
  └─ <PlaylistsTable data={playlists} />
       └─ TanStack Table        (client filter / sort)
```

No TanStack Query — data is a server prop. No client refetch needed on this page.

---

## Styling

- Table primitives from `packages/ui/src/primitives/` where available
- Status badge uses tokens from `tokens.css` — no hex colors
- Logical spacing properties (`ms-`, `me-`) for RTL safety

---

## Tests required (CLAUDE.md §9)

- RTL component test for `<PlaylistsTable>` — renders rows, status filter hides non-matching rows

---

## New dependency

`@tanstack/react-table` must be added to `apps/admin/package.json`.  
Pre-approved by CLAUDE.md §4.1 ("Data tables use TanStack Table") — no ADR required.

---

## Out of scope

- Pagination (< 100 rows for MVP)
- Delete action (not in ticket; added in 3.5 or later)
- TanStack Query / client-side refetch (RSC handles initial load)
